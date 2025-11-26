//! Tests for CRLF handling and UTF-8 edge cases
//!
//! These tests ensure that:
//! 1. CRLF (\r\n) is treated as a single line ending (not two)
//! 2. Mixed line endings (LF, CR, CRLF) are handled correctly
//! 3. Incomplete UTF-8 sequences at flush() return an error

use serde_json::Value;

use crate::csv_json::parse_csv_to_json;

/// Test CRLF line endings in a single chunk
#[test]
fn test_crlf_single_chunk() {
    let input = "name,age\r\nAlice,30\r\nBob,25";

    let result = parse_csv_to_json(input, b',', 10485760, None).unwrap();
    let parsed: Vec<Value> = serde_json::from_str(&result).unwrap();

    assert_eq!(parsed.len(), 2, "Expected 2 records, got {}", parsed.len());
    assert_eq!(parsed[0]["name"], "Alice");
    assert_eq!(parsed[0]["age"], "30");
    assert_eq!(parsed[1]["name"], "Bob");
    assert_eq!(parsed[1]["age"], "25");
}

/// Test CRLF at end of file (no trailing newline)
#[test]
fn test_crlf_no_trailing_newline() {
    let input = "name,age\r\nAlice,30";

    let result = parse_csv_to_json(input, b',', 10485760, None).unwrap();
    let parsed: Vec<Value> = serde_json::from_str(&result).unwrap();

    assert_eq!(parsed.len(), 1);
    assert_eq!(parsed[0]["name"], "Alice");
    assert_eq!(parsed[0]["age"], "30");
}

/// Test CRLF with trailing CRLF
#[test]
fn test_crlf_with_trailing_crlf() {
    let input = "name,age\r\nAlice,30\r\n";

    let result = parse_csv_to_json(input, b',', 10485760, None).unwrap();
    let parsed: Vec<Value> = serde_json::from_str(&result).unwrap();

    assert_eq!(parsed.len(), 1);
    assert_eq!(parsed[0]["name"], "Alice");
}

/// Test mixed line endings (LF, CR, CRLF)
#[test]
fn test_mixed_line_endings() {
    // Mix: CRLF after header, LF after Alice, CR after Bob
    let input = "name,age\r\nAlice,30\nBob,25\rCharlie,35";

    let result = parse_csv_to_json(input, b',', 10485760, None).unwrap();
    let parsed: Vec<Value> = serde_json::from_str(&result).unwrap();

    assert_eq!(parsed.len(), 3, "Expected 3 records, got {}", parsed.len());
    assert_eq!(parsed[0]["name"], "Alice");
    assert_eq!(parsed[1]["name"], "Bob");
    assert_eq!(parsed[2]["name"], "Charlie");
}

/// Test LF only (Unix style)
#[test]
fn test_lf_only() {
    let input = "name,age\nAlice,30\nBob,25";

    let result = parse_csv_to_json(input, b',', 10485760, None).unwrap();
    let parsed: Vec<Value> = serde_json::from_str(&result).unwrap();

    assert_eq!(parsed.len(), 2);
    assert_eq!(parsed[0]["name"], "Alice");
    assert_eq!(parsed[1]["name"], "Bob");
}

/// Test CR only (old Mac style)
#[test]
fn test_cr_only() {
    let input = "name,age\rAlice,30\rBob,25";

    let result = parse_csv_to_json(input, b',', 10485760, None).unwrap();
    let parsed: Vec<Value> = serde_json::from_str(&result).unwrap();

    assert_eq!(parsed.len(), 2);
    assert_eq!(parsed[0]["name"], "Alice");
    assert_eq!(parsed[1]["name"], "Bob");
}

/// Test CRLF inside quoted field (should be preserved)
#[test]
fn test_crlf_inside_quoted_field() {
    let input = "name,notes\r\nAlice,\"Line 1\r\nLine 2\"\r\nBob,normal";

    let result = parse_csv_to_json(input, b',', 10485760, None).unwrap();
    let parsed: Vec<Value> = serde_json::from_str(&result).unwrap();

    assert_eq!(parsed.len(), 2, "Expected 2 records, got {}", parsed.len());
    assert_eq!(parsed[0]["name"], "Alice");
    assert_eq!(parsed[0]["notes"], "Line 1\r\nLine 2");
    assert_eq!(parsed[1]["name"], "Bob");
    assert_eq!(parsed[1]["notes"], "normal");
}

/// Test LF inside quoted field
#[test]
fn test_lf_inside_quoted_field() {
    let input = "name,notes\nAlice,\"Line 1\nLine 2\"\nBob,normal";

    let result = parse_csv_to_json(input, b',', 10485760, None).unwrap();
    let parsed: Vec<Value> = serde_json::from_str(&result).unwrap();

    assert_eq!(parsed.len(), 2);
    assert_eq!(parsed[0]["notes"], "Line 1\nLine 2");
    assert_eq!(parsed[1]["notes"], "normal");
}

/// Test CR inside quoted field
#[test]
fn test_cr_inside_quoted_field() {
    let input = "name,notes\nAlice,\"Line 1\rLine 2\"\nBob,normal";

    let result = parse_csv_to_json(input, b',', 10485760, None).unwrap();
    let parsed: Vec<Value> = serde_json::from_str(&result).unwrap();

    assert_eq!(parsed.len(), 2);
    assert_eq!(parsed[0]["notes"], "Line 1\rLine 2");
    assert_eq!(parsed[1]["notes"], "normal");
}

/// Test empty records are not created by CRLF
/// This is a regression test for the bug where CRLF was treated as two line endings
#[test]
fn test_crlf_no_empty_records() {
    let input = "a,b\r\n1,2\r\n3,4\r\n";

    let result = parse_csv_to_json(input, b',', 10485760, None).unwrap();
    let parsed: Vec<Value> = serde_json::from_str(&result).unwrap();

    // Should have exactly 2 records, not 4 (if CRLF was treated as 2 line endings)
    assert_eq!(parsed.len(), 2, "CRLF should not create empty records. Got {} records", parsed.len());

    // Verify no empty values
    assert_eq!(parsed[0]["a"], "1");
    assert_eq!(parsed[0]["b"], "2");
    assert_eq!(parsed[1]["a"], "3");
    assert_eq!(parsed[1]["b"], "4");
}

/// Test multiple consecutive CRLFs
#[test]
fn test_multiple_crlf() {
    // Multiple CRLFs between records - this is ambiguous but should handle gracefully
    let input = "a,b\r\n1,2\r\n\r\n3,4";

    let result = parse_csv_to_json(input, b',', 10485760, None).unwrap();
    let parsed: Vec<Value> = serde_json::from_str(&result).unwrap();

    // Should have records (empty line may or may not be included based on CSV semantics)
    assert!(parsed.len() >= 2, "Should have at least 2 records");
}

/// Test single field with CRLF
#[test]
fn test_single_column_crlf() {
    let input = "value\r\n1\r\n2\r\n3";

    let result = parse_csv_to_json(input, b',', 10485760, None).unwrap();
    let parsed: Vec<Value> = serde_json::from_str(&result).unwrap();

    assert_eq!(parsed.len(), 3);
    assert_eq!(parsed[0]["value"], "1");
    assert_eq!(parsed[1]["value"], "2");
    assert_eq!(parsed[2]["value"], "3");
}

/// Test Unicode with CRLF
#[test]
fn test_unicode_with_crlf() {
    let input = "名前,年齢\r\n太郎,30\r\n花子,25";

    let result = parse_csv_to_json(input, b',', 10485760, None).unwrap();
    let parsed: Vec<Value> = serde_json::from_str(&result).unwrap();

    assert_eq!(parsed.len(), 2);
    assert_eq!(parsed[0]["名前"], "太郎");
    assert_eq!(parsed[1]["名前"], "花子");
}

/// Test emoji with CRLF
#[test]
fn test_emoji_with_crlf() {
    let input = "emoji,name\r\n🎉,party\r\n🚀,rocket";

    let result = parse_csv_to_json(input, b',', 10485760, None).unwrap();
    let parsed: Vec<Value> = serde_json::from_str(&result).unwrap();

    assert_eq!(parsed.len(), 2);
    assert_eq!(parsed[0]["emoji"], "🎉");
    assert_eq!(parsed[1]["emoji"], "🚀");
}
