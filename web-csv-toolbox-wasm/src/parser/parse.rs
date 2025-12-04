//! High-performance CSV parser
//!
//! This module provides a high-performance CSV parser that uses SIMD scanning
//! for delimiter detection, providing ~3-5x speedup.
//!
//! # Architecture
//!
//! The parser works in two phases:
//! 1. **Scanning**: Quickly identify separator positions (delimiters and newlines)
//!    while tracking quote state using XOR parity.
//! 2. **Field Extraction**: Extract field content based on separator positions,
//!    handling quote unescaping as needed.
//!
//! # Output Format
//!
//! Returns data in Flat format for efficient WASM↔JS boundary crossing:
//! - `headers`: Header row fields
//! - `fieldData`: All field values in a flat array
//! - `actualFieldCounts`: Per-record field counts (for sparse records)

use super::scan::{pack_separator, unescape_field, CsvScanner, SEP_LF};

/// Parse CSV bytes and return structured data
///
/// # Arguments
/// * `input` - CSV input bytes
/// * `delimiter` - Field delimiter character
/// * `quote` - Quote character
/// * `max_field_count` - Maximum allowed number of fields per record
///
/// # Returns
/// Result containing tuple of (headers, records, actual_field_counts) or error message
pub fn parse_csv(
    input: &[u8],
    delimiter: u8,
    quote: u8,
    max_field_count: usize,
) -> Result<(Vec<String>, Vec<String>, Vec<usize>), String> {
    let mut scanner = CsvScanner::with_options(delimiter, quote);
    let scan_result = scanner.scan(input, 0);

    let mut headers: Vec<String> = Vec::new();
    let mut field_data: Vec<String> = Vec::new();
    let mut actual_field_counts: Vec<usize> = Vec::new();

    if scan_result.separators.is_empty() && input.is_empty() {
        return Ok((headers, field_data, actual_field_counts));
    }

    // Check for unclosed quotes (invalid CSV syntax)
    if scan_result.end_in_quote != 0 {
        return Err("Unexpected EOF while parsing quoted field".to_string());
    }

    // Extract fields from separator positions
    let mut field_start = 0usize;
    let mut current_record: Vec<&[u8]> = Vec::new();
    let mut is_header_row = true;

    // Create optional virtual separator for inputs without trailing newline
    let virtual_sep = if !input.is_empty() && input[input.len() - 1] != b'\n' {
        Some(pack_separator(input.len() as u32, SEP_LF))
    } else {
        None
    };

    // Iterate over separators without cloning, chaining virtual separator if needed
    for &packed in scan_result.separators.iter().chain(virtual_sep.iter()) {
        let offset = super::scan::unpack_offset(packed) as usize;
        let sep_type = super::scan::unpack_type(packed);

        // Extract field bytes
        let field_end = offset.min(input.len());
        let field_bytes = if field_start <= field_end {
            &input[field_start..field_end]
        } else {
            &input[0..0]
        };

        // Strip CR from CRLF
        let field_bytes = if !field_bytes.is_empty() && field_bytes[field_bytes.len() - 1] == b'\r'
        {
            &field_bytes[..field_bytes.len() - 1]
        } else {
            field_bytes
        };

        current_record.push(field_bytes);

        // Move start to after separator
        field_start = offset + 1;

        // If line feed, complete the record
        if sep_type == SEP_LF {
            if is_header_row {
                // First row is headers
                for field in &current_record {
                    let unescaped = unescape_field(field, quote);
                    // Option A: Check UTF-8 validity first to avoid unnecessary cloning
                    let field_str = match std::str::from_utf8(&unescaped) {
                        Ok(s) => s.to_string(),  // Valid UTF-8 - single allocation
                        Err(_) => String::from_utf8_lossy(&unescaped).into_owned(),  // Invalid - fallback
                    };
                    headers.push(field_str);
                }

                // Validate field count
                if headers.len() > max_field_count {
                    return Err(format!(
                        "Field count ({}) exceeds maximum allowed ({})",
                        headers.len(),
                        max_field_count
                    ));
                }

                is_header_row = false;
            } else {
                // Data row
                let actual_count = current_record.len();

                // Validate field count to prevent memory exhaustion attacks
                if actual_count > max_field_count {
                    return Err(format!(
                        "Data row field count ({}) exceeds maximum allowed ({})",
                        actual_count,
                        max_field_count
                    ));
                }

                actual_field_counts.push(actual_count);

                // Ensure we have header_len fields
                for (i, field) in current_record.iter().enumerate() {
                    if i < headers.len() {
                        let unescaped = unescape_field(field, quote);
                        // Option A: Check UTF-8 validity first to avoid unnecessary cloning
                        let field_str = match std::str::from_utf8(&unescaped) {
                            Ok(s) => s.to_string(),  // Valid UTF-8 - single allocation
                            Err(_) => String::from_utf8_lossy(&unescaped).into_owned(),  // Invalid - fallback
                        };
                        field_data.push(field_str);
                    }
                }

                // Fill missing fields with empty strings
                for _ in actual_count..headers.len() {
                    field_data.push(String::new());
                }
            }

            current_record.clear();
        }
    }

    // Handle trailing record (no final newline)
    if !current_record.is_empty() {
        if is_header_row {
            for field in &current_record {
                let unescaped = unescape_field(field, quote);
                // Option A: Check UTF-8 validity first to avoid unnecessary cloning
                let field_str = match std::str::from_utf8(&unescaped) {
                    Ok(s) => s.to_string(),  // Valid UTF-8 - single allocation
                    Err(_) => String::from_utf8_lossy(&unescaped).into_owned(),  // Invalid - fallback
                };
                headers.push(field_str);
            }

            // Validate field count
            if headers.len() > max_field_count {
                return Err(format!(
                    "Field count ({}) exceeds maximum allowed ({})",
                    headers.len(),
                    max_field_count
                ));
            }
        } else {
            let actual_count = current_record.len();

            // Validate field count to prevent memory exhaustion attacks
            if actual_count > max_field_count {
                return Err(format!(
                    "Data row field count ({}) exceeds maximum allowed ({})",
                    actual_count,
                    max_field_count
                ));
            }

            actual_field_counts.push(actual_count);

            for (i, field) in current_record.iter().enumerate() {
                if i < headers.len() {
                    let unescaped = unescape_field(field, quote);
                    // Option A: Check UTF-8 validity first to avoid unnecessary cloning
                    let field_str = match std::str::from_utf8(&unescaped) {
                        Ok(s) => s.to_string(),  // Valid UTF-8 - single allocation
                        Err(_) => String::from_utf8_lossy(&unescaped).into_owned(),  // Invalid - fallback
                    };
                    field_data.push(field_str);
                }
            }

            for _ in actual_count..headers.len() {
                field_data.push(String::new());
            }
        }
    }

    Ok((headers, field_data, actual_field_counts))
}

/// Parse CSV string and return structured data
pub fn parse_csv_str(
    input: &str,
    delimiter: u8,
    quote: u8,
    max_field_count: usize,
) -> Result<(Vec<String>, Vec<String>, Vec<usize>), String> {
    parse_csv(input.as_bytes(), delimiter, quote, max_field_count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_csv() {
        let csv = "a,b,c\n1,2,3\n";
        let (headers, fields, counts) = parse_csv_str(csv, b',', b'"', 1000).unwrap();

        assert_eq!(headers, vec!["a", "b", "c"]);
        assert_eq!(fields, vec!["1", "2", "3"]);
        assert_eq!(counts, vec![3]);
    }

    #[test]
    fn test_quoted_fields() {
        let csv = "a,b\n\"hello, world\",test\n";
        let (headers, fields, counts) = parse_csv_str(csv, b',', b'"', 1000).unwrap();

        assert_eq!(headers, vec!["a", "b"]);
        assert_eq!(fields, vec!["hello, world", "test"]);
        assert_eq!(counts, vec![2]);
    }

    #[test]
    fn test_escaped_quotes() {
        let csv = "a,b\n\"hello \"\"world\"\"\",test\n";
        let (headers, fields, counts) = parse_csv_str(csv, b',', b'"', 1000).unwrap();

        assert_eq!(headers, vec!["a", "b"]);
        assert_eq!(fields, vec!["hello \"world\"", "test"]);
        assert_eq!(counts, vec![2]);
    }

    #[test]
    fn test_crlf() {
        let csv = "a,b\r\n1,2\r\n";
        let (headers, fields, counts) = parse_csv_str(csv, b',', b'"', 1000).unwrap();

        assert_eq!(headers, vec!["a", "b"]);
        assert_eq!(fields, vec!["1", "2"]);
        assert_eq!(counts, vec![2]);
    }

    #[test]
    fn test_sparse_record() {
        let csv = "a,b,c\n1,2\n";
        let (headers, fields, counts) = parse_csv_str(csv, b',', b'"', 1000).unwrap();

        assert_eq!(headers, vec!["a", "b", "c"]);
        assert_eq!(fields, vec!["1", "2", ""]);
        assert_eq!(counts, vec![2]); // actual count is 2
    }

    #[test]
    fn test_no_trailing_newline() {
        let csv = "a,b\n1,2";
        let (headers, fields, counts) = parse_csv_str(csv, b',', b'"', 1000).unwrap();

        assert_eq!(headers, vec!["a", "b"]);
        assert_eq!(fields, vec!["1", "2"]);
        assert_eq!(counts, vec![2]);
    }

    #[test]
    fn test_max_field_count_validation() {
        let csv = "a,b,c\n1,2,3\n";

        // Should succeed with limit of 3
        let result = parse_csv_str(csv, b',', b'"', 3);
        assert!(result.is_ok());

        // Should fail with limit of 2
        let result = parse_csv_str(csv, b',', b'"', 2);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Field count (3) exceeds maximum allowed (2)"));
    }
}
