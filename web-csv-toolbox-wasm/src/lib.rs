use csv::ReaderBuilder;
use serde_json::json;
use wasm_bindgen::prelude::*;

#[cfg(test)]
use serde_json::Value;

/// Parse CSV string to JSON array
///
/// # Arguments
///
/// * `input` - CSV string to parse
/// * `delimiter` - Delimiter character (e.g., b',' for comma)
///
/// # Returns
///
/// JSON string representation of the parsed CSV data
fn parse_csv_to_json(input: &str, delimiter: u8) -> Result<String, String> {
    let mut rdr = ReaderBuilder::new()
        .has_headers(true)
        .delimiter(delimiter)
        .from_reader(input.as_bytes());

    let headers = rdr
        .headers()
        .map_err(|e| format!("Failed to read headers: {}", e))?
        .clone();

    let mut records = Vec::new();

    for result in rdr.records() {
        let record = result.map_err(|e| format!("Failed to read record: {}", e))?;
        let json_record: serde_json::Value = headers
            .iter()
            .zip(record.iter())
            .map(|(header, field)| (header.to_string(), json!(field)))
            .collect::<serde_json::Map<String, serde_json::Value>>()
            .into();
        records.push(json_record);
    }

    serde_json::to_string(&records).map_err(|e| format!("Failed to serialize JSON: {}", e))
}

/// Parse CSV string to array synchronously (WASM binding)
///
/// # Arguments
///
/// * `input` - CSV string to parse
/// * `delimiter` - Delimiter character (e.g., b',' for comma)
///
/// # Returns
///
/// Result containing JsValue with the JSON string representation of parsed CSV data.
///
/// # Errors
///
/// Returns a JsError if parsing fails, which will be thrown as a JavaScript error.
#[wasm_bindgen(js_name = parseStringToArraySync)]
pub fn parse_string_to_array_sync(
    input: &str,
    delimiter: u8,
) -> Result<JsValue, wasm_bindgen::JsError> {
    parse_csv_to_json(input, delimiter)
        .map(|json_str| JsValue::from_str(&json_str))
        .map_err(|err| wasm_bindgen::JsError::new(&err))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_csv() {
        let input = ["name,age", "Alice,30", "Bob,25"].join("\n");

        let result = parse_csv_to_json(&input, b',').unwrap();
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
        let result = parse_csv_to_json(input, b',').unwrap();
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

        let result = parse_csv_to_json(&input, b',').unwrap();
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

        let result = parse_csv_to_json(&input, b'\t').unwrap();
        let parsed: Vec<Value> = serde_json::from_str(&result).unwrap();

        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0]["name"], "Alice");
        assert_eq!(parsed[0]["age"], "30");
    }

    #[test]
    fn test_parse_csv_with_empty_fields() {
        let input = ["name,age,email", "Alice,30,", "Bob,,bob@example.com"].join("\n");

        let result = parse_csv_to_json(&input, b',').unwrap();
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

        let result = parse_csv_to_json(&input, b',').unwrap();
        let parsed: Vec<Value> = serde_json::from_str(&result).unwrap();

        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0]["name"], "Alice");
        assert_eq!(parsed[1]["name"], "Bob");
    }

    #[test]
    fn test_parse_csv_with_unicode() {
        let input = ["名前,年齢", "太郎,30", "花子,25"].join("\n");

        let result = parse_csv_to_json(&input, b',').unwrap();
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

        let result = parse_csv_to_json(&input, b',');
        // The csv crate will fail on incomplete rows by default
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_empty_input() {
        let input = "";
        let result = parse_csv_to_json(input, b',');
        // Empty input can be parsed as a CSV with no headers and no data
        // The csv crate treats this as valid
        assert!(result.is_ok());
        let parsed: Vec<Value> = serde_json::from_str(&result.unwrap()).unwrap();
        assert_eq!(parsed.len(), 0);
    }

    #[test]
    fn test_parse_headers_only() {
        let input = "name,age,email";
        let result = parse_csv_to_json(input, b',').unwrap();
        let parsed: Vec<Value> = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed.len(), 0);
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
        let result = parse_string_to_array_sync(input, b',');
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
        let result = parse_string_to_array_sync(input, b',');
        assert!(result.is_err());

        let error = result.unwrap_err();
        let error_message = format!("{:?}", error);
        assert!(error_message.contains("Failed to read record"));
    }

    #[wasm_bindgen_test]
    fn test_parse_string_to_array_sync_empty() {
        let input = "name,age";
        let result = parse_string_to_array_sync(input, b',');
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
        let result = parse_string_to_array_sync(input, b',');
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
        let result = parse_string_to_array_sync(input, b'\t');
        assert!(result.is_ok());

        let js_value = result.unwrap();
        let json_str = js_value.as_string().unwrap();
        let parsed: Vec<serde_json::Value> = serde_json::from_str(&json_str).unwrap();

        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0]["name"], "Alice");
        assert_eq!(parsed[0]["age"], "30");
    }
}
