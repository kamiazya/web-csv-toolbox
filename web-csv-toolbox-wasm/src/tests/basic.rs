use serde_json::Value;

use crate::csv_json::parse_csv_to_json;

#[test]
fn test_parse_simple_csv() {
    let input = ["name,age", "Alice,30", "Bob,25"].join("\n");

    let result = parse_csv_to_json(&input, b',', 10485760, None).unwrap();
    let parsed: Vec<Value> = serde_json::from_str(&result).unwrap();

    assert_eq!(parsed.len(), 2);
    assert_eq!(parsed[0]["name"], "Alice");
    assert_eq!(parsed[0]["age"], "30");
    assert_eq!(parsed[1]["name"], "Bob");
    assert_eq!(parsed[1]["age"], "25");
}

#[test]
fn test_parse_empty_csv() {
    let input = "name,age";
    let result = parse_csv_to_json(input, b',', 10485760, None).unwrap();
    let parsed: Vec<Value> = serde_json::from_str(&result).unwrap();

    assert_eq!(parsed.len(), 0);
}

#[test]
fn test_parse_csv_with_quotes() {
    let input = [
        "name,description",
        r#"Alice,"Hello, World""#,
        r#"Bob,"Test ""quoted"" text""#,
    ]
    .join("\n");

    let result = parse_csv_to_json(&input, b',', 10485760, None).unwrap();
    let parsed: Vec<Value> = serde_json::from_str(&result).unwrap();

    assert_eq!(parsed.len(), 2);
    assert_eq!(parsed[0]["name"], "Alice");
    assert_eq!(parsed[0]["description"], "Hello, World");
    assert_eq!(parsed[1]["name"], "Bob");
    assert_eq!(parsed[1]["description"], "Test \"quoted\" text");
}

#[test]
fn test_parse_csv_with_different_delimiter() {
    let input = ["name\tage", "Alice\t30", "Bob\t25"].join("\n");

    let result = parse_csv_to_json(&input, b'\t', 10485760, None).unwrap();
    let parsed: Vec<Value> = serde_json::from_str(&result).unwrap();

    assert_eq!(parsed.len(), 2);
    assert_eq!(parsed[0]["name"], "Alice");
    assert_eq!(parsed[0]["age"], "30");
}

#[test]
fn test_parse_csv_with_empty_fields() {
    let input = ["name,age,email", "Alice,30,", "Bob,,bob@example.com"].join("\n");

    let result = parse_csv_to_json(&input, b',', 10485760, None).unwrap();
    let parsed: Vec<Value> = serde_json::from_str(&result).unwrap();

    assert_eq!(parsed.len(), 2);
    assert_eq!(parsed[0]["name"], "Alice");
    assert_eq!(parsed[0]["age"], "30");
    assert_eq!(parsed[0]["email"], "");
    assert_eq!(parsed[1]["name"], "Bob");
    assert_eq!(parsed[1]["age"], "");
    assert_eq!(parsed[1]["email"], "bob@example.com");
}

#[test]
fn test_parse_csv_with_single_column() {
    let input = ["name", "Alice", "Bob"].join("\n");

    let result = parse_csv_to_json(&input, b',', 10485760, None).unwrap();
    let parsed: Vec<Value> = serde_json::from_str(&result).unwrap();

    assert_eq!(parsed.len(), 2);
    assert_eq!(parsed[0]["name"], "Alice");
    assert_eq!(parsed[1]["name"], "Bob");
}

#[test]
fn test_parse_csv_with_unicode() {
    let input = ["名前,年齢", "太郎,30", "花子,25"].join("\n");

    let result = parse_csv_to_json(&input, b',', 10485760, None).unwrap();
    let parsed: Vec<Value> = serde_json::from_str(&result).unwrap();

    assert_eq!(parsed.len(), 2);
    assert_eq!(parsed[0]["名前"], "太郎");
    assert_eq!(parsed[0]["年齢"], "30");
    assert_eq!(parsed[1]["名前"], "花子");
    assert_eq!(parsed[1]["年齢"], "25");
}

#[test]
fn test_parse_empty_input() {
    let input = "";
    let result = parse_csv_to_json(input, b',', 10485760, None);
    // csv crate handles empty input gracefully, returning empty array
    assert!(result.is_ok());
    let parsed: Vec<Value> = serde_json::from_str(&result.unwrap()).unwrap();
    assert_eq!(parsed.len(), 0);
}

#[test]
fn test_parse_headers_only() {
    let input = "a,b,c";
    let result = parse_csv_to_json(input, b',', 10485760, None).unwrap();
    let parsed: Vec<Value> = serde_json::from_str(&result).unwrap();
    assert_eq!(parsed.len(), 0);
}

#[test]
fn test_parse_incomplete_row() {
    let input = ["name,age,city", "Alice,30,NYC", "Bob,25"].join("\n");
    let result = parse_csv_to_json(&input, b',', 10485760, None);
    // csv crate is strict - incomplete rows cause an error
    assert!(result.is_err());
    let error_msg = result.unwrap_err();
    assert!(error_msg.contains("Failed to read record"));
}

#[test]
fn test_input_size_limit_exceeded() {
    let input = "a,b,c\n1,2,3";
    let result = parse_csv_to_json(input, b',', 5, None);
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("exceeds maximum allowed size"));
}

#[test]
fn test_input_size_within_limit() {
    let input = "a,b\n1,2";
    let result = parse_csv_to_json(input, b',', 100, None);
    assert!(result.is_ok());
}

#[test]
fn test_error_with_source() {
    let input = "a,b,c\n1,2,3";
    let result = parse_csv_to_json(input, b',', 5, Some("test.csv"));
    assert!(result.is_err());
    let error = result.unwrap_err();
    assert!(error.contains("in \"test.csv\""));
}

#[test]
fn test_error_without_source() {
    let input = "a,b,c\n1,2,3";
    let result = parse_csv_to_json(input, b',', 5, None);
    assert!(result.is_err());
    let error = result.unwrap_err();
    assert!(!error.contains("in \""));
}

#[test]
fn test_size_limit_error_with_source() {
    let input = "name,age\nAlice,30";
    let result = parse_csv_to_json(input, b',', 5, Some("data.csv"));
    assert!(result.is_err());
    let error = result.unwrap_err();
    assert!(error.contains("in \"data.csv\""));
    assert!(error.contains("exceeds maximum allowed size"));
}
