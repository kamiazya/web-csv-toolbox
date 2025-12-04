//! SIMD-accelerated CSV parser
//!
//! This module provides a high-performance CSV parser that uses SIMD scanning
//! for delimiter detection, providing ~3-5x speedup over the csv-core based parser.
//!
//! # Architecture
//!
//! The parser works in two phases:
//! 1. **SIMD Scanning**: Quickly identify separator positions (delimiters and newlines)
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

use super::scanner::{pack_separator, unescape_field, SimdScanner, SEP_LF};

/// Parse CSV bytes and return structured data
///
/// # Arguments
/// * `input` - CSV input bytes
/// * `delimiter` - Field delimiter character
/// * `quote` - Quote character
///
/// # Returns
/// Tuple of (headers, records, actual_field_counts)
pub fn parse_csv_simd(
    input: &[u8],
    delimiter: u8,
    quote: u8,
) -> (Vec<String>, Vec<String>, Vec<usize>) {
    let mut scanner = SimdScanner::with_options(delimiter, quote);
    let scan_result = scanner.scan(input, 0);

    let mut headers: Vec<String> = Vec::new();
    let mut field_data: Vec<String> = Vec::new();
    let mut actual_field_counts: Vec<usize> = Vec::new();

    if scan_result.separators.is_empty() && input.is_empty() {
        return (headers, field_data, actual_field_counts);
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
        let offset = super::scanner::unpack_offset(packed) as usize;
        let sep_type = super::scanner::unpack_type(packed);

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
                    headers.push(String::from_utf8_lossy(&unescaped).into_owned());
                }
                is_header_row = false;
            } else {
                // Data row
                let actual_count = current_record.len();
                actual_field_counts.push(actual_count);

                // Ensure we have header_len fields
                for (i, field) in current_record.iter().enumerate() {
                    if i < headers.len() {
                        let unescaped = unescape_field(field, quote);
                        field_data.push(String::from_utf8_lossy(&unescaped).into_owned());
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
                headers.push(String::from_utf8_lossy(&unescaped).into_owned());
            }
        } else {
            let actual_count = current_record.len();
            actual_field_counts.push(actual_count);

            for (i, field) in current_record.iter().enumerate() {
                if i < headers.len() {
                    let unescaped = unescape_field(field, quote);
                    field_data.push(String::from_utf8_lossy(&unescaped).into_owned());
                }
            }

            for _ in actual_count..headers.len() {
                field_data.push(String::new());
            }
        }
    }

    (headers, field_data, actual_field_counts)
}

/// Parse CSV string and return structured data
pub fn parse_csv_str_simd(
    input: &str,
    delimiter: u8,
    quote: u8,
) -> (Vec<String>, Vec<String>, Vec<usize>) {
    parse_csv_simd(input.as_bytes(), delimiter, quote)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_csv() {
        let csv = "a,b,c\n1,2,3\n";
        let (headers, fields, counts) = parse_csv_str_simd(csv, b',', b'"');

        assert_eq!(headers, vec!["a", "b", "c"]);
        assert_eq!(fields, vec!["1", "2", "3"]);
        assert_eq!(counts, vec![3]);
    }

    #[test]
    fn test_quoted_fields() {
        let csv = "a,b\n\"hello, world\",test\n";
        let (headers, fields, counts) = parse_csv_str_simd(csv, b',', b'"');

        assert_eq!(headers, vec!["a", "b"]);
        assert_eq!(fields, vec!["hello, world", "test"]);
        assert_eq!(counts, vec![2]);
    }

    #[test]
    fn test_escaped_quotes() {
        let csv = "a,b\n\"hello \"\"world\"\"\",test\n";
        let (headers, fields, counts) = parse_csv_str_simd(csv, b',', b'"');

        assert_eq!(headers, vec!["a", "b"]);
        assert_eq!(fields, vec!["hello \"world\"", "test"]);
        assert_eq!(counts, vec![2]);
    }

    #[test]
    fn test_crlf() {
        let csv = "a,b\r\n1,2\r\n";
        let (headers, fields, counts) = parse_csv_str_simd(csv, b',', b'"');

        assert_eq!(headers, vec!["a", "b"]);
        assert_eq!(fields, vec!["1", "2"]);
        assert_eq!(counts, vec![2]);
    }

    #[test]
    fn test_sparse_record() {
        let csv = "a,b,c\n1,2\n";
        let (headers, fields, counts) = parse_csv_str_simd(csv, b',', b'"');

        assert_eq!(headers, vec!["a", "b", "c"]);
        assert_eq!(fields, vec!["1", "2", ""]);
        assert_eq!(counts, vec![2]); // actual count is 2
    }

    #[test]
    fn test_no_trailing_newline() {
        let csv = "a,b\n1,2";
        let (headers, fields, counts) = parse_csv_str_simd(csv, b',', b'"');

        assert_eq!(headers, vec!["a", "b"]);
        assert_eq!(fields, vec!["1", "2"]);
        assert_eq!(counts, vec![2]);
    }
}
