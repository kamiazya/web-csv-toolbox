//! Security and correctness tests for CSV parser
//!
//! Tests for:
//! - max_field_count enforcement (Issue #1)
//! - Unclosed quote detection (Issue #2)
//! - Bit mask correctness for large files (Issue #3)

#[cfg(test)]
mod tests {
    use crate::parser::scan::{pack_separator, unpack_offset, unpack_type, SEP_DELIMITER, SEP_LF};
    use crate::parser::{parse_csv, parse_csv_str};

    // =========================================================================
    // Issue #1: max_field_count enforcement on data rows
    // =========================================================================

    #[test]
    fn test_max_field_count_header_only() {
        // Header with more fields than max_field_count should fail
        let input = "a,b,c,d,e,f";
        let result = parse_csv_str(input, b',', b'"', 3);
        assert!(
            result.is_err(),
            "Header exceeding max_field_count should fail"
        );
        assert!(result.unwrap_err().contains("exceeds maximum"));
    }

    #[test]
    fn test_max_field_count_data_row_exceeds() {
        // Data row with more fields than max_field_count should fail
        let input = "a,b\n1,2,3,4,5";
        let result = parse_csv_str(input, b',', b'"', 3);
        assert!(
            result.is_err(),
            "Data row exceeding max_field_count should fail"
        );
        let err_msg = result.unwrap_err();
        assert!(
            err_msg.contains("Data row"),
            "Error should mention data row"
        );
        assert!(
            err_msg.contains("exceeds maximum"),
            "Error should mention limit"
        );
    }

    #[test]
    fn test_max_field_count_data_row_exact_limit() {
        // Data row at exactly max_field_count should succeed
        let input = "a,b,c\n1,2,3";
        let result = parse_csv_str(input, b',', b'"', 3);
        assert!(result.is_ok(), "Data row at max_field_count should succeed");
        let (headers, _field_data, counts) = result.unwrap();
        assert_eq!(headers.len(), 3);
        assert_eq!(counts[0], 3);
    }

    #[test]
    fn test_max_field_count_multiple_rows() {
        // Multiple data rows, second one exceeds
        let input = "a,b,c\n1,2,3\n4,5,6,7,8";
        let result = parse_csv_str(input, b',', b'"', 5);
        assert!(result.is_err(), "Second data row exceeding max should fail");
    }

    #[test]
    fn test_max_field_count_trailing_record() {
        // Trailing record (no final newline) should also be checked
        let input = "a,b\n1,2,3,4,5,6,7";
        let result = parse_csv_str(input, b',', b'"', 5);
        assert!(result.is_err(), "Trailing record exceeding max should fail");
    }

    #[test]
    fn test_max_field_count_sparse_record() {
        // Sparse record (fewer fields than header) should succeed
        let input = "a,b,c,d,e\n1,2\n3,4,5,6,7";
        let result = parse_csv_str(input, b',', b'"', 5);
        assert!(result.is_ok(), "Sparse record within limit should succeed");
        let (_, _field_data, counts) = result.unwrap();
        assert_eq!(counts[0], 2);
        assert_eq!(counts[1], 5);
    }

    // =========================================================================
    // Issue #2: Unclosed quote detection
    // =========================================================================

    #[test]
    fn test_unclosed_quote_at_eof() {
        // Quote opened but never closed
        let input = b"a,b\n\"1,2";
        let result = parse_csv(input, b',', b'"', 100);
        assert!(result.is_err(), "Unclosed quote at EOF should fail");
        let err_msg = result.unwrap_err();
        assert!(
            err_msg.contains("quoted") || err_msg.contains("EOF"),
            "Error should mention quoted field or EOF: {}",
            err_msg
        );
    }

    #[test]
    fn test_unclosed_quote_with_newline() {
        // Quote opened, newline inside, but never closed
        let input = b"a,b\n\"1,2\n3,4";
        let result = parse_csv(input, b',', b'"', 100);
        assert!(result.is_err(), "Unclosed quote with newline should fail");
    }

    #[test]
    fn test_unclosed_quote_empty_field() {
        // Empty quoted field without closing quote
        let input = b"a,b\n\"";
        let result = parse_csv(input, b',', b'"', 100);
        assert!(result.is_err(), "Unclosed empty quoted field should fail");
    }

    #[test]
    fn test_properly_closed_quote() {
        // Properly closed quote should succeed
        let input = b"a,b\n\"1,2\",3";
        let result = parse_csv(input, b',', b'"', 100);
        assert!(result.is_ok(), "Properly closed quote should succeed");
        let (_, field_data, _) = result.unwrap();
        assert_eq!(field_data[0], "1,2");
        assert_eq!(field_data[1], "3");
    }

    #[test]
    fn test_escaped_quote() {
        // Escaped quote ("") should not be treated as unclosed
        let input = b"a,b\n\"hello\"\"world\",test";
        let result = parse_csv(input, b',', b'"', 100);
        assert!(result.is_ok(), "Escaped quote should succeed");
        let (_, field_data, _) = result.unwrap();
        assert_eq!(field_data[0], "hello\"world");
    }

    #[test]
    fn test_quote_at_end_of_file() {
        // Quote at end of file (properly closed)
        let input = b"a,b\n1,\"test\"";
        let result = parse_csv(input, b',', b'"', 100);
        assert!(result.is_ok(), "Closed quote at EOF should succeed");
    }

    // =========================================================================
    // Issue #3: Bit mask correctness for large files
    // =========================================================================

    #[test]
    fn test_separator_packing_small_offset() {
        // Test small offsets (< 2^30)
        let offset = 1000u32;
        let packed_delim = pack_separator(offset, SEP_DELIMITER);
        let packed_lf = pack_separator(offset, SEP_LF);

        assert_eq!(unpack_offset(packed_delim), offset);
        assert_eq!(unpack_type(packed_delim), SEP_DELIMITER);

        assert_eq!(unpack_offset(packed_lf), offset);
        assert_eq!(unpack_type(packed_lf), SEP_LF);
    }

    #[test]
    fn test_separator_packing_at_1gb_boundary() {
        // Test at 2^30 (1GB boundary) - bit 30 set
        let offset = 1_073_741_824u32; // 2^30
        let packed_delim = pack_separator(offset, SEP_DELIMITER);
        let packed_lf = pack_separator(offset, SEP_LF);

        assert_eq!(
            unpack_offset(packed_delim),
            offset,
            "Offset at 1GB boundary should be preserved for delimiter"
        );
        assert_eq!(
            unpack_type(packed_delim),
            SEP_DELIMITER,
            "Type should be delimiter"
        );

        assert_eq!(
            unpack_offset(packed_lf),
            offset,
            "Offset at 1GB boundary should be preserved for LF"
        );
        assert_eq!(unpack_type(packed_lf), SEP_LF, "Type should be LF");
    }

    #[test]
    fn test_separator_packing_above_1gb() {
        // Test above 1GB
        let offset = 1_500_000_000u32; // 1.5GB
        let packed = pack_separator(offset, SEP_LF);

        assert_eq!(
            unpack_offset(packed),
            offset,
            "Offset above 1GB should be preserved"
        );
        assert_eq!(unpack_type(packed), SEP_LF);
    }

    #[test]
    fn test_separator_packing_max_offset() {
        // Test maximum offset (2GB - 1, all bits 0-30 set)
        let offset = 0x7FFF_FFFFu32; // 2^31 - 1
        let packed = pack_separator(offset, SEP_DELIMITER);

        assert_eq!(
            unpack_offset(packed),
            offset,
            "Maximum offset should be preserved"
        );
        assert_eq!(unpack_type(packed), SEP_DELIMITER);
    }

    #[test]
    fn test_separator_type_distinction() {
        // Ensure delimiter and LF are correctly distinguished
        let offset = 1_234_567_890u32;
        let packed_delim = pack_separator(offset, SEP_DELIMITER);
        let packed_lf = pack_separator(offset, SEP_LF);

        assert_ne!(
            packed_delim, packed_lf,
            "Delimiter and LF should pack differently"
        );
        assert_eq!(unpack_type(packed_delim), SEP_DELIMITER);
        assert_eq!(unpack_type(packed_lf), SEP_LF);
    }

    #[test]
    fn test_bit_30_does_not_interfere_with_type() {
        // Critical: bit 30 should not interfere with type detection
        // Old buggy code: (sep >> 30) & 0x3 would see bit 30 as part of type
        // Correct code: sep >> 31 uses only bit 31

        let offset_with_bit30 = 0x4000_0000u32; // Bit 30 set, bits 0-29 clear
        let packed_lf = pack_separator(offset_with_bit30, SEP_LF);

        // With buggy mask (sep >> 30) & 0x3:
        //   Result would be 0b11 (3), not matching SEP_LF (1)
        // With correct mask sep >> 31:
        //   Result is 0b1, correctly matching SEP_LF

        assert_eq!(
            unpack_type(packed_lf),
            SEP_LF,
            "Bit 30 in offset should not interfere with type detection"
        );
        assert_eq!(
            unpack_offset(packed_lf),
            offset_with_bit30,
            "Offset with bit 30 should be preserved"
        );
    }
}
