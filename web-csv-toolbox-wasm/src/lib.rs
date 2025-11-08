use csv::ReaderBuilder;
use serde_json::json;
use wasm_bindgen::prelude::*;

#[cfg(test)]
use serde_json::Value;

/// Formats error message with optional source identifier
///
/// Takes ownership of the message String to avoid unnecessary allocation
/// when source is None.
fn format_error(message: String, source: Option<&str>) -> String {
    match source {
        Some(src) => format!("{} in \"{}\"", message, src),
        None => message,
    }
}

/// Parse CSV string to JSON array
///
/// # Arguments
///
/// * `input` - CSV string to parse
/// * `delimiter` - Delimiter character (e.g., b',' for comma)
/// * `max_buffer_size` - Maximum allowed input size in bytes
/// * `source` - Optional source identifier for error reporting (e.g., filename)
///
/// # Returns
///
/// JSON string representation of the parsed CSV data
fn parse_csv_to_json(
    input: &str,
    delimiter: u8,
    max_buffer_size: usize,
    source: Option<&str>,
) -> Result<String, String> {
    // Validate input size to prevent memory exhaustion attacks
    if input.len() > max_buffer_size {
        return Err(format_error(
            format!(
                "Input size ({} bytes) exceeds maximum allowed size ({} bytes)",
                input.len(),
                max_buffer_size
            ),
            source,
        ));
    }

    let mut rdr = ReaderBuilder::new()
        .has_headers(true)
        .delimiter(delimiter)
        .from_reader(input.as_bytes());

    let headers = rdr
        .headers()
        .map_err(|e| format_error(format!("Failed to read headers: {}", e), source))?
        .clone();

    let mut records = Vec::new();

    for result in rdr.records() {
        let record = result.map_err(|e| format_error(format!("Failed to read record: {}", e), source))?;
        let json_record: serde_json::Value = headers
            .iter()
            .zip(record.iter())
            .map(|(header, field)| (header.to_string(), json!(field)))
            .collect::<serde_json::Map<String, serde_json::Value>>()
            .into();
        records.push(json_record);
    }

    serde_json::to_string(&records).map_err(|e| {
        format_error(format!("Failed to serialize JSON: {}", e), source)
    })
}

/// Parse CSV string to array synchronously (WASM binding)
///
/// # Arguments
///
/// * `input` - CSV string to parse
/// * `delimiter` - Delimiter character (e.g., b',' for comma)
/// * `max_buffer_size` - Maximum allowed input size in bytes
/// * `source` - Optional source identifier for error reporting (e.g., filename). Pass empty string for None.
///
/// # Returns
///
/// Result containing JsValue with the JSON string representation of parsed CSV data.
///
/// # Errors
///
/// Returns a JsError if parsing fails or input size exceeds limit, which will be thrown as a JavaScript error.
#[wasm_bindgen(js_name = parseStringToArraySync)]
pub fn parse_string_to_array_sync(
    input: &str,
    delimiter: u8,
    max_buffer_size: usize,
    source: &str,
) -> Result<JsValue, wasm_bindgen::JsError> {
    let source_opt = if source.is_empty() { None } else { Some(source) };
    parse_csv_to_json(input, delimiter, max_buffer_size, source_opt)
        .map(|json_str| JsValue::from_str(&json_str))
        .map_err(|err| wasm_bindgen::JsError::new(&err))
}

#[cfg(test)]
mod tests {
    use super::*;

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
    fn test_parse_incomplete_row() {
        // Incomplete row - missing age for Bob
        let input = ["name,age", "Alice,30", "Bob"].join("\n");

        let result = parse_csv_to_json(&input, b',', 10485760, None);
        // The csv crate will fail on incomplete rows by default
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_empty_input() {
        let input = "";
        let result = parse_csv_to_json(input, b',', 10485760, None);
        // Empty input can be parsed as a CSV with no headers and no data
        // The csv crate treats this as valid
        assert!(result.is_ok());
        let parsed: Vec<Value> = serde_json::from_str(&result.unwrap()).unwrap();
        assert_eq!(parsed.len(), 0);
    }

    #[test]
    fn test_parse_headers_only() {
        let input = "name,age,email";
        let result = parse_csv_to_json(input, b',', 10485760, None).unwrap();
        let parsed: Vec<Value> = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed.len(), 0);
    }

    #[test]
    fn test_input_size_limit_exceeded() {
        // Create a CSV that exceeds the size limit
        let input = "a,b,c\n".repeat(100);
        let max_buffer_size = 10; // Very small limit to ensure failure

        let result = parse_csv_to_json(&input, b',', max_buffer_size, None);
        assert!(result.is_err());

        let error_message = result.unwrap_err();
        assert!(error_message.contains("Input size"));
        assert!(error_message.contains("exceeds maximum allowed size"));
    }

    #[test]
    fn test_input_size_within_limit() {
        let input = "name,age\nAlice,30";
        let max_buffer_size = 1000;

        let result = parse_csv_to_json(&input, b',', max_buffer_size, None);
        assert!(result.is_ok());

        let parsed: Vec<Value> = serde_json::from_str(&result.unwrap()).unwrap();
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0]["name"], "Alice");
    }

    #[test]
    fn test_error_with_source() {
        let input = "name,age\nAlice,30\nBob"; // Incomplete row
        let source = Some("test.csv");

        let result = parse_csv_to_json(&input, b',', 10485760, source);
        assert!(result.is_err());

        let error_message = result.unwrap_err();
        assert!(error_message.contains("test.csv"));
        assert!(error_message.contains("Failed to read record"));
    }

    #[test]
    fn test_error_without_source() {
        let input = "name,age\nAlice,30\nBob"; // Incomplete row

        let result = parse_csv_to_json(&input, b',', 10485760, None);
        assert!(result.is_err());

        let error_message = result.unwrap_err();
        assert!(!error_message.contains("in \""));
        assert!(error_message.contains("Failed to read record"));
    }

    #[test]
    fn test_size_limit_error_with_source() {
        let input = "a,b,c\n".repeat(100);
        let max_buffer_size = 10;
        let source = Some("large.csv");

        let result = parse_csv_to_json(&input, b',', max_buffer_size, source);
        assert!(result.is_err());

        let error_message = result.unwrap_err();
        assert!(error_message.contains("large.csv"));
        assert!(error_message.contains("Input size"));
        assert!(error_message.contains("exceeds maximum allowed size"));
    }
}

#[cfg(all(test, target_arch = "wasm32"))]
mod wasm_tests {
    use super::*;
    use wasm_bindgen_test::*;

    wasm_bindgen_test_configure!(run_in_browser);

    #[wasm_bindgen_test]
    fn test_parse_string_to_array_sync_success() {
        let input = "name,age\nAlice,30\nBob,25";
        let result = parse_string_to_array_sync(input, b',', 10485760, "");
        assert!(result.is_ok());

        let js_value = result.unwrap();
        let json_str = js_value.as_string().unwrap();
        let parsed: Vec<serde_json::Value> = serde_json::from_str(&json_str).unwrap();

        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0]["name"], "Alice");
        assert_eq!(parsed[0]["age"], "30");
        assert_eq!(parsed[1]["name"], "Bob");
        assert_eq!(parsed[1]["age"], "25");
    }

    #[wasm_bindgen_test]
    fn test_parse_string_to_array_sync_error() {
        // Incomplete row - missing age for Bob
        let input = "name,age\nAlice,30\nBob";
        let result = parse_string_to_array_sync(input, b',', 10485760, "");
        assert!(result.is_err());

        let error = result.unwrap_err();
        let error_message = format!("{:?}", error);
        assert!(error_message.contains("Failed to read record"));
    }

    #[wasm_bindgen_test]
    fn test_parse_string_to_array_sync_empty() {
        let input = "name,age";
        let result = parse_string_to_array_sync(input, b',', 10485760, "");
        assert!(result.is_ok());

        let js_value = result.unwrap();
        let json_str = js_value.as_string().unwrap();
        let parsed: Vec<serde_json::Value> = serde_json::from_str(&json_str).unwrap();
        assert_eq!(parsed.len(), 0);
    }

    #[wasm_bindgen_test]
    fn test_parse_string_to_array_sync_with_quotes() {
        let input = r#"name,description
Alice,"Hello, World"
Bob,"Test ""quoted"" text""#;
        let result = parse_string_to_array_sync(input, b',', 10485760, "");
        assert!(result.is_ok());

        let js_value = result.unwrap();
        let json_str = js_value.as_string().unwrap();
        let parsed: Vec<serde_json::Value> = serde_json::from_str(&json_str).unwrap();

        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0]["name"], "Alice");
        assert_eq!(parsed[0]["description"], "Hello, World");
        assert_eq!(parsed[1]["name"], "Bob");
        assert_eq!(parsed[1]["description"], "Test \"quoted\" text");
    }

    #[wasm_bindgen_test]
    fn test_parse_string_to_array_sync_different_delimiter() {
        let input = "name\tage\nAlice\t30\nBob\t25";
        let result = parse_string_to_array_sync(input, b'\t', 10485760, "");
        assert!(result.is_ok());

        let js_value = result.unwrap();
        let json_str = js_value.as_string().unwrap();
        let parsed: Vec<serde_json::Value> = serde_json::from_str(&json_str).unwrap();

        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0]["name"], "Alice");
        assert_eq!(parsed[0]["age"], "30");
    }

    #[wasm_bindgen_test]
    fn test_parse_string_to_array_sync_size_limit_exceeded() {
        // Create a CSV that exceeds the size limit
        let input = "a,b,c\n".repeat(100);
        let max_buffer_size = 10; // Very small limit to ensure failure

        let result = parse_string_to_array_sync(&input, b',', max_buffer_size, "");
        assert!(result.is_err());

        let error = result.unwrap_err();
        let error_message = format!("{:?}", error);
        assert!(error_message.contains("Input size"));
        assert!(error_message.contains("exceeds maximum allowed size"));
    }

    #[wasm_bindgen_test]
    fn test_parse_string_to_array_sync_size_within_limit() {
        let input = "name,age\nAlice,30";
        let max_buffer_size = 1000;

        let result = parse_string_to_array_sync(input, b',', max_buffer_size, "");
        assert!(result.is_ok());

        let js_value = result.unwrap();
        let json_str = js_value.as_string().unwrap();
        let parsed: Vec<serde_json::Value> = serde_json::from_str(&json_str).unwrap();

        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0]["name"], "Alice");
        assert_eq!(parsed[0]["age"], "30");
    }

    #[wasm_bindgen_test]
    fn test_parse_string_to_array_sync_with_source() {
        let input = "name,age\nAlice,30\nBob"; // Incomplete row
        let result = parse_string_to_array_sync(input, b',', 10485760, "users.csv");
        assert!(result.is_err());

        let error = result.unwrap_err();
        let error_message = format!("{:?}", error);
        assert!(error_message.contains("users.csv"));
        assert!(error_message.contains("Failed to read record"));
    }

    #[wasm_bindgen_test]
    fn test_parse_string_to_array_sync_size_limit_with_source() {
        let input = "a,b,c\n".repeat(100);
        let max_buffer_size = 10;

        let result = parse_string_to_array_sync(&input, b',', max_buffer_size, "large.csv");
        assert!(result.is_err());

        let error = result.unwrap_err();
        let error_message = format!("{:?}", error);
        assert!(error_message.contains("large.csv"));
        assert!(error_message.contains("Input size"));
        assert!(error_message.contains("exceeds maximum allowed size"));
    }
}
