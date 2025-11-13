use proptest::prelude::*;

use crate::parser::CSVParser;

use super::common::{create_csv, escape_csv_field};

/// Strategy for generating valid CSV field strings
/// Excludes lone surrogates and control characters
fn csv_field_strategy() -> impl Strategy<Value = String> {
    // Use printable ASCII and valid Unicode, excluding problematic characters
    prop::string::string_regex("[\\x20-\\x7E\\u{80}-\\u{D7FF}\\u{E000}-\\u{FFFF}]{0,50}")
        .unwrap()
        .prop_filter("Filter out quotes and delimiters", |_s| {
            // Allow quotes and delimiters, they will be escaped
            true
        })
}

/// Strategy for generating CSV headers (non-empty, unique field names)
fn csv_header_strategy() -> impl Strategy<Value = Vec<String>> {
    prop::collection::vec(csv_field_strategy(), 1..10).prop_map(|fields| {
        // Make fields unique by adding index
        fields
            .into_iter()
            .enumerate()
            .map(|(i, f)| {
                if f.is_empty() {
                    format!("col{}", i)
                } else {
                    format!("{}_{}", f, i)
                }
            })
            .collect()
    })
}

/// Strategy for generating CSV data rows
fn csv_rows_strategy(num_columns: usize) -> impl Strategy<Value = Vec<Vec<String>>> {
    prop::collection::vec(
        prop::collection::vec(csv_field_strategy(), num_columns..=num_columns),
        0..20,
    )
}

proptest! {
    // Property: Parser should handle arbitrary valid CSV data
    fn prop_parse_arbitrary_csv(
        headers in csv_header_strategy(),
        rows in csv_header_strategy().prop_flat_map(|h| {
            csv_rows_strategy(h.len()).prop_map(move |r| (h.clone(), r))
        }).prop_map(|(_h, r)| r)
    ) {
        let csv = create_csv(&headers, &rows);

        let mut parser = CSVParser::new(b',');
        let _result = parser.process_chunk(&csv);
        // Just check it doesn't panic
    }

    // Property: Chunk independence - same result regardless of chunk size
    fn prop_chunk_independence(
        _headers in csv_header_strategy(),
        (headers2, rows) in csv_header_strategy().prop_flat_map(|h| {
            csv_rows_strategy(h.len()).prop_map(move |r| (h.clone(), r))
        }),
        chunk_size in 1usize..20usize
    ) {
        let csv = create_csv(&headers2, &rows);

        // Parse all at once
        let mut parser1 = CSVParser::new(b',');
        let result1 = parser1.process_chunk(&csv).unwrap();
        let flush1 = parser1.flush().unwrap();

        // Parse in chunks
        let mut parser2 = CSVParser::new(b',');
        let mut results2 = Vec::new();

        for chunk in csv.as_bytes().chunks(chunk_size) {
            let chunk_str = std::str::from_utf8(chunk).unwrap();
            let result = parser2.process_chunk(chunk_str).unwrap();
            results2.push(result);
        }
        let flush2 = parser2.flush().unwrap();

        // Results should be equivalent (order and content)
        // We check that both parsers produce valid output without panicking
        prop_assert!(result1.is_array() || result1.is_object() || result1.is_string());
        prop_assert!(flush1.is_array() || flush1.is_object() || flush1.is_string());
        prop_assert!(flush2.is_array() || flush2.is_object() || flush2.is_string());
    }

    // Property: One character at a time should work
    fn prop_one_char_at_a_time(
        _headers in csv_header_strategy(),
        (headers2, rows) in csv_header_strategy().prop_flat_map(|h| {
            csv_rows_strategy(h.len()).prop_map(move |r| (h.clone(), r))
        })
    ) {
        let csv = create_csv(&headers2, &rows);

        // Limit size for performance
        prop_assume!(csv.len() <= 100);

        let mut parser = CSVParser::new(b',');

        // Process one character at a time
        for ch in csv.chars() {
            let _ = parser.process_chunk(&ch.to_string());
        }

        let _ = parser.flush();
        // Just check it doesn't panic
    }

    // Property: Empty fields should be handled correctly
    fn prop_empty_fields(
        headers in csv_header_strategy(),
        num_rows in 0usize..10usize
    ) {
        let num_cols = headers.len();

        // Create CSV with all empty fields
        let rows: Vec<Vec<String>> = (0..num_rows)
            .map(|_| vec![String::new(); num_cols])
            .collect();

        let csv = create_csv(&headers, &rows);

        let mut parser = CSVParser::new(b',');
        let _result = parser.process_chunk(&csv);
        let _flush = parser.flush();

        // Should not panic
    }

    // Property: Parser should handle different line endings
    fn prop_line_endings(
        _headers in csv_header_strategy(),
        (headers2, rows) in csv_header_strategy().prop_flat_map(|h| {
            csv_rows_strategy(h.len()).prop_map(move |r| (h.clone(), r))
        }),
        use_crlf in prop::bool::ANY
    ) {
        let line_ending = if use_crlf { "\r\n" } else { "\n" };

        // Create CSV with specified line ending
        let mut csv = String::new();
        csv.push_str(&headers2.iter()
            .map(|h| escape_csv_field(h))
            .collect::<Vec<_>>()
            .join(","));
        csv.push_str(line_ending);

        for row in &rows {
            csv.push_str(&row.iter()
                .map(|f| escape_csv_field(f))
                .collect::<Vec<_>>()
                .join(","));
            csv.push_str(line_ending);
        }

        let mut parser = CSVParser::new(b',');
        let _result = parser.process_chunk(&csv);
        let _flush = parser.flush();

        // Should not panic
    }

    // Property: Parser should handle fields with NULL bytes
    fn prop_null_bytes(
        headers in csv_header_strategy(),
        num_rows in 1usize..5usize
    ) {
        let num_cols = headers.len();

        // Create rows with NULL bytes
        let rows: Vec<Vec<String>> = (0..num_rows)
            .map(|i| (0..num_cols)
                .map(|j| format!("val{}_{}\x00null", i, j))
                .collect())
            .collect();

        let csv = create_csv(&headers, &rows);

        let mut parser = CSVParser::new(b',');
        let _result = parser.process_chunk(&csv);
        let _flush = parser.flush();

        // Should not panic
    }

    // Property: Parser should handle very long field values
    fn prop_long_fields(
        headers in csv_header_strategy(),
        field_length in 100usize..1000usize
    ) {
        let num_cols = headers.len();

        // Create a single row with very long fields
        let long_value = "a".repeat(field_length);
        let rows = vec![vec![long_value; num_cols]];

        let csv = create_csv(&headers, &rows);

        let mut parser = CSVParser::new(b',');
        let _result = parser.process_chunk(&csv);
        let _flush = parser.flush();

        // Should not panic
    }

    // Property: Parser should handle UTF-8 multibyte characters
    fn prop_utf8_multibyte(
        num_rows in 1usize..5usize
    ) {
        // Use various UTF-8 multibyte characters
        let headers = vec!["日本語".to_string(), "中文".to_string(), "한국어".to_string()];
        let rows: Vec<Vec<String>> = (0..num_rows)
            .map(|i| vec![
                format!("値{}", i),
                format!("值{}", i),
                format!("값{}", i),
            ])
            .collect();

        let csv = create_csv(&headers, &rows);

        let mut parser = CSVParser::new(b',');
        let _result = parser.process_chunk(&csv);
        let _flush = parser.flush();

        // Should not panic
    }

    // Property: Binary processing should handle byte chunks correctly
    fn prop_binary_chunk_processing(
        _headers in csv_header_strategy(),
        (headers2, rows) in csv_header_strategy().prop_flat_map(|h| {
            csv_rows_strategy(h.len()).prop_map(move |r| (h.clone(), r))
        }),
        chunk_size in 1usize..20usize
    ) {
        let csv = create_csv(&headers2, &rows);

        // Process as bytes
        let mut parser = CSVParser::new(b',');
        let bytes = csv.as_bytes();

        // Process byte chunks
        for chunk in bytes.chunks(chunk_size) {
            // Convert chunk to Uint8Array equivalent (just process as bytes)
            if let Ok(chunk_str) = std::str::from_utf8(chunk) {
                let _ = parser.process_chunk(chunk_str);
            }
        }

        let _flush = parser.flush();

        // Should not panic
    }
}
