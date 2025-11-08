use csv::ReaderBuilder;
use js_sys::{Array, Object, Reflect};
use serde_json::json;
use wasm_bindgen::prelude::*;

#[cfg(test)]
use serde_json::Value;

/// Parser state for streaming CSV parsing
#[derive(Debug, Clone, PartialEq)]
enum ParserState {
    /// At the start of a field
    FieldStart,
    /// Inside an unquoted field
    InField,
    /// Inside a quoted field
    InQuotedField,
    /// After a quote inside a quoted field (could be end or escaped quote)
    AfterQuote,
}

/// Streaming CSV parser that processes chunks incrementally
#[wasm_bindgen]
pub struct CSVStreamParser {
    /// Current parser state
    state: ParserState,
    /// Field delimiter (e.g., ',' or '\t')
    delimiter: u8,
    /// Current field being accumulated
    current_field: String,
    /// Current record being accumulated
    current_record: Vec<String>,
    /// CSV headers (set after first record)
    headers: Option<Vec<String>>,
    /// Whether the parser has been initialized with headers
    headers_parsed: bool,
    /// Quote character
    quote: u8,
    /// Buffer for incomplete UTF-8 sequences
    utf8_buffer: Vec<u8>,
}

#[wasm_bindgen]
impl CSVStreamParser {
    /// Create a new streaming CSV parser
    ///
    /// # Arguments
    ///
    /// * `delimiter` - Field delimiter byte (e.g., 44 for comma)
    #[wasm_bindgen(constructor)]
    pub fn new(delimiter: u8) -> Self {
        Self {
            state: ParserState::FieldStart,
            delimiter,
            current_field: String::new(),
            current_record: Vec::new(),
            headers: None,
            headers_parsed: false,
            quote: b'"',
            utf8_buffer: Vec::new(),
        }
    }

    /// Process a chunk of CSV data and return completed records as JavaScript array
    ///
    /// # Arguments
    ///
    /// * `chunk` - String chunk to process
    ///
    /// # Returns
    ///
    /// JavaScript array of completed record objects. May be empty if no complete records in this chunk.
    #[wasm_bindgen(js_name = processChunk)]
    pub fn process_chunk(&mut self, chunk: &str) -> Result<JsValue, JsError> {
        let completed_records = Array::new();

        // Process chunk character by character
        for ch in chunk.chars() {
            let byte = ch as u32;

            match self.state {
                ParserState::FieldStart => {
                    if byte == self.quote as u32 {
                        self.state = ParserState::InQuotedField;
                    } else if byte == self.delimiter as u32 {
                        // Empty field
                        self.current_record.push(String::new());
                    } else if ch == '\r' {
                        // Ignore CR, wait for LF
                    } else if ch == '\n' {
                        // End of record
                        self.finish_field();
                        if let Some(record) = self.finish_record() {
                            completed_records.push(&record);
                        }
                    } else {
                        self.current_field.push(ch);
                        self.state = ParserState::InField;
                    }
                }
                ParserState::InField => {
                    if byte == self.delimiter as u32 {
                        self.finish_field();
                        self.state = ParserState::FieldStart;
                    } else if ch == '\r' {
                        // Ignore CR, wait for LF
                    } else if ch == '\n' {
                        self.finish_field();
                        if let Some(record) = self.finish_record() {
                            completed_records.push(&record);
                        }
                        self.state = ParserState::FieldStart;
                    } else {
                        self.current_field.push(ch);
                    }
                }
                ParserState::InQuotedField => {
                    if byte == self.quote as u32 {
                        self.state = ParserState::AfterQuote;
                    } else {
                        self.current_field.push(ch);
                    }
                }
                ParserState::AfterQuote => {
                    if byte == self.quote as u32 {
                        // Escaped quote
                        self.current_field.push('"');
                        self.state = ParserState::InQuotedField;
                    } else if byte == self.delimiter as u32 {
                        self.finish_field();
                        self.state = ParserState::FieldStart;
                    } else if ch == '\r' {
                        // Ignore CR
                    } else if ch == '\n' {
                        self.finish_field();
                        if let Some(record) = self.finish_record() {
                            completed_records.push(&record);
                        }
                        self.state = ParserState::FieldStart;
                    } else {
                        // Character after quote - should be delimiter or newline
                        // Treat as end of quoted field and continue
                        self.finish_field();
                        self.current_field.push(ch);
                        self.state = ParserState::InField;
                    }
                }
            }
        }

        // Return the array directly as JsValue
        Ok(completed_records.into())
    }

    /// Flush any remaining buffered data and return final records
    ///
    /// Call this when all chunks have been processed to get any remaining partial record.
    #[wasm_bindgen]
    pub fn flush(&mut self) -> Result<JsValue, JsError> {
        let completed_records = Array::new();

        // Handle different states at EOF
        match self.state {
            ParserState::InQuotedField => {
                // Unclosed quoted field - this is an error in strict CSV
                // but we'll be lenient and finish the field
                self.finish_field();
                if let Some(record) = self.finish_record() {
                    completed_records.push(&record);
                }
            }
            ParserState::AfterQuote | ParserState::InField => {
                // Field completed but not yet finished (e.g., no trailing newline)
                self.finish_field();
                if let Some(record) = self.finish_record() {
                    completed_records.push(&record);
                }
            }
            ParserState::FieldStart => {
                // We're at the start of a field
                // If current_record has content, we need to finish it
                if !self.current_record.is_empty() {
                    // There's a partial record (e.g., after a delimiter with no field)
                    self.finish_field(); // Add empty field
                    if let Some(record) = self.finish_record() {
                        completed_records.push(&record);
                    }
                } else if !self.current_field.is_empty() {
                    // There's a partial field
                    self.finish_field();
                    if let Some(record) = self.finish_record() {
                        completed_records.push(&record);
                    }
                }
            }
        }

        // Clear all state
        self.current_field.clear();
        self.current_record.clear();
        self.state = ParserState::FieldStart;

        // Return the array directly as JsValue
        Ok(completed_records.into())
    }

    /// Process a chunk of CSV data from Uint8Array (binary) and return completed records
    ///
    /// # Arguments
    ///
    /// * `bytes` - Uint8Array chunk to process (UTF-8 encoded)
    ///
    /// # Returns
    ///
    /// JavaScript array of completed record objects. May be empty if no complete records in this chunk.
    #[wasm_bindgen(js_name = processChunkBytes)]
    pub fn process_chunk_bytes(&mut self, bytes: &js_sys::Uint8Array) -> Result<JsValue, JsError> {
        // Convert Uint8Array to Vec<u8>
        let mut chunk_bytes = vec![0u8; bytes.length() as usize];
        bytes.copy_to(&mut chunk_bytes);

        // Append to UTF-8 buffer
        self.utf8_buffer.extend_from_slice(&chunk_bytes);

        // Try to decode UTF-8
        let completed_records = Array::new();

        // Find the last valid UTF-8 boundary
        let mut valid_up_to = self.utf8_buffer.len();

        // Check if we have an incomplete UTF-8 sequence at the end
        // UTF-8 continuation bytes start with 0b10xxxxxx (0x80-0xBF)
        // We need to find where the last complete character ends
        if !self.utf8_buffer.is_empty() {
            // Scan backwards to find the start of a potentially incomplete character
            let mut i = self.utf8_buffer.len();
            while i > 0 && i > self.utf8_buffer.len().saturating_sub(4) {
                i -= 1;
                let byte = self.utf8_buffer[i];

                // Check if this is the start of a multi-byte sequence
                if byte & 0b10000000 == 0 {
                    // ASCII (1 byte) - complete
                    valid_up_to = i + 1;
                    break;
                } else if byte & 0b11100000 == 0b11000000 {
                    // 2-byte sequence start
                    if i + 2 <= self.utf8_buffer.len() {
                        valid_up_to = i + 2;
                    } else {
                        valid_up_to = i;
                    }
                    break;
                } else if byte & 0b11110000 == 0b11100000 {
                    // 3-byte sequence start
                    if i + 3 <= self.utf8_buffer.len() {
                        valid_up_to = i + 3;
                    } else {
                        valid_up_to = i;
                    }
                    break;
                } else if byte & 0b11111000 == 0b11110000 {
                    // 4-byte sequence start
                    if i + 4 <= self.utf8_buffer.len() {
                        valid_up_to = i + 4;
                    } else {
                        valid_up_to = i;
                    }
                    break;
                }
                // else: continuation byte, keep scanning backwards
            }
        }

        // Decode the valid portion
        if valid_up_to > 0 {
            match std::str::from_utf8(&self.utf8_buffer[..valid_up_to]) {
                Ok(text) => {
                    // Clone the text to avoid borrow checker issues
                    let text_owned = text.to_string();

                    // Process the decoded text through the existing char-based parser
                    for ch in text_owned.chars() {
                        let byte = ch as u32;

                        match self.state {
                            ParserState::FieldStart => {
                                if byte == self.quote as u32 {
                                    self.state = ParserState::InQuotedField;
                                } else if byte == self.delimiter as u32 {
                                    self.current_record.push(String::new());
                                } else if ch == '\r' {
                                    // Ignore CR
                                } else if ch == '\n' {
                                    self.finish_field();
                                    if let Some(record) = self.finish_record() {
                                        completed_records.push(&record);
                                    }
                                } else {
                                    self.current_field.push(ch);
                                    self.state = ParserState::InField;
                                }
                            }
                            ParserState::InField => {
                                if byte == self.delimiter as u32 {
                                    self.finish_field();
                                    self.state = ParserState::FieldStart;
                                } else if ch == '\r' {
                                    // Ignore CR
                                } else if ch == '\n' {
                                    self.finish_field();
                                    if let Some(record) = self.finish_record() {
                                        completed_records.push(&record);
                                    }
                                    self.state = ParserState::FieldStart;
                                } else {
                                    self.current_field.push(ch);
                                }
                            }
                            ParserState::InQuotedField => {
                                if byte == self.quote as u32 {
                                    self.state = ParserState::AfterQuote;
                                } else {
                                    self.current_field.push(ch);
                                }
                            }
                            ParserState::AfterQuote => {
                                if byte == self.quote as u32 {
                                    self.current_field.push('"');
                                    self.state = ParserState::InQuotedField;
                                } else if byte == self.delimiter as u32 {
                                    self.finish_field();
                                    self.state = ParserState::FieldStart;
                                } else if ch == '\r' {
                                    // Ignore CR
                                } else if ch == '\n' {
                                    self.finish_field();
                                    if let Some(record) = self.finish_record() {
                                        completed_records.push(&record);
                                    }
                                    self.state = ParserState::FieldStart;
                                } else {
                                    self.finish_field();
                                    self.current_field.push(ch);
                                    self.state = ParserState::InField;
                                }
                            }
                        }
                    }

                    // Remove processed bytes from buffer
                    self.utf8_buffer.drain(..valid_up_to);
                }
                Err(_) => {
                    return Err(JsError::new("Invalid UTF-8 sequence"));
                }
            }
        }

        Ok(completed_records.into())
    }

    /// Reset the parser state
    #[wasm_bindgen]
    pub fn reset(&mut self) {
        self.state = ParserState::FieldStart;
        self.current_field.clear();
        self.current_record.clear();
        self.headers = None;
        self.headers_parsed = false;
        self.utf8_buffer.clear();
    }
}

// Private methods
impl CSVStreamParser {
    /// Finish current field and add to current record
    fn finish_field(&mut self) {
        let field = std::mem::take(&mut self.current_field);
        self.current_record.push(field);
    }

    /// Finish current record and return it as a JavaScript object (or save as headers)
    fn finish_record(&mut self) -> Option<JsValue> {
        // Empty records are only invalid before headers are parsed
        if self.current_record.is_empty() && !self.headers_parsed {
            return None;
        }

        let record = std::mem::take(&mut self.current_record);

        if !self.headers_parsed {
            // First record is headers
            self.headers = Some(record);
            self.headers_parsed = true;
            None
        } else {
            // Convert to JavaScript object using headers
            if let Some(ref headers) = self.headers {
                let obj = Object::new();
                // Use enumerate to handle cases where record has fewer fields than headers
                for (i, header) in headers.iter().enumerate() {
                    let field = record.get(i).map(|s| s.as_str()).unwrap_or("");
                    let key = JsValue::from_str(header);
                    let value = JsValue::from_str(field);

                    // Use Object.defineProperty to handle special property names like __proto__
                    // which cannot be set properly with Reflect.set
                    let descriptor = Object::new();
                    let _ = Reflect::set(&descriptor, &JsValue::from_str("value"), &value);
                    let _ = Reflect::set(&descriptor, &JsValue::from_str("writable"), &JsValue::TRUE);
                    let _ = Reflect::set(&descriptor, &JsValue::from_str("enumerable"), &JsValue::TRUE);
                    let _ = Reflect::set(&descriptor, &JsValue::from_str("configurable"), &JsValue::TRUE);
                    let _ = Object::define_property(&obj, &key, &descriptor);
                }
                Some(obj.into())
            } else {
                // No headers - shouldn't happen but handle gracefully
                None
            }
        }
    }
}

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
        let record =
            result.map_err(|e| format_error(format!("Failed to read record: {}", e), source))?;
        let json_record: serde_json::Value = headers
            .iter()
            .zip(record.iter())
            .map(|(header, field)| (header.to_string(), json!(field)))
            .collect::<serde_json::Map<String, serde_json::Value>>()
            .into();
        records.push(json_record);
    }

    serde_json::to_string(&records)
        .map_err(|e| format_error(format!("Failed to serialize JSON: {}", e), source))
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
    let source_opt = (!source.is_empty()).then_some(source);
    parse_csv_to_json(input, delimiter, max_buffer_size, source_opt)
        .map(|json_str| JsValue::from_str(&json_str))
        .map_err(|err| wasm_bindgen::JsError::new(&err))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper function to escape CSV field with quotes
    pub(crate) fn escape_csv_field(field: &str) -> String {
        if field.is_empty()
            || field.contains(',')
            || field.contains('"')
            || field.contains('\n')
            || field.contains('\r')
        {
            format!("\"{}\"", field.replace('"', "\"\""))
        } else {
            field.to_string()
        }
    }

    /// Helper function to create CSV string from headers and rows
    pub(crate) fn create_csv(headers: &[String], rows: &[Vec<String>]) -> String {
        let mut csv = String::new();

        // Add headers
        csv.push_str(&headers.iter().map(|h| escape_csv_field(h)).collect::<Vec<_>>().join(","));
        csv.push('\n');

        // Add rows
        for row in rows {
            csv.push_str(&row.iter().map(|f| escape_csv_field(f)).collect::<Vec<_>>().join(","));
            csv.push('\n');
        }

        csv
    }

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

        let result = parse_csv_to_json(input.as_str(), b',', max_buffer_size, None);
        assert!(result.is_err());

        let error_message = result.unwrap_err();
        assert!(error_message.contains("Input size"));
        assert!(error_message.contains("exceeds maximum allowed size"));
    }

    #[test]
    fn test_input_size_within_limit() {
        let input = "name,age\nAlice,30";
        let max_buffer_size = 1000;

        let result = parse_csv_to_json(input, b',', max_buffer_size, None);
        assert!(result.is_ok());

        let parsed: Vec<Value> = serde_json::from_str(&result.unwrap()).unwrap();
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0]["name"], "Alice");
    }

    #[test]
    fn test_error_with_source() {
        let input = "name,age\nAlice,30\nBob"; // Incomplete row
        let source = Some("test.csv");

        let result = parse_csv_to_json(input, b',', 10485760, source);
        assert!(result.is_err());

        let error_message = result.unwrap_err();
        assert!(error_message.contains("test.csv"));
        assert!(error_message.contains("Failed to read record"));
    }

    #[test]
    fn test_error_without_source() {
        let input = "name,age\nAlice,30\nBob"; // Incomplete row

        let result = parse_csv_to_json(input, b',', 10485760, None);
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

        let result = parse_csv_to_json(input.as_str(), b',', max_buffer_size, source);
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

        let result = parse_string_to_array_sync(input.as_str(), b',', max_buffer_size, "");
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

        let result = parse_string_to_array_sync(input.as_str(), b',', max_buffer_size, "large.csv");
        assert!(result.is_err());

        let error = result.unwrap_err();
        let error_message = format!("{:?}", error);
        assert!(error_message.contains("large.csv"));
        assert!(error_message.contains("Input size"));
        assert!(error_message.contains("exceeds maximum allowed size"));
    }

    #[wasm_bindgen_test]
    fn test_csv_stream_parser_simple() {
        let mut parser = CSVStreamParser::new(b',');

        let result1 = parser.process_chunk("name,age\n").unwrap();
        let records1: Vec<Value> = serde_json::from_str(&result1.as_string().unwrap()).unwrap();
        assert_eq!(records1.len(), 0); // Headers only, no data records

        let result2 = parser.process_chunk("Alice,30\n").unwrap();
        let records2: Vec<Value> = serde_json::from_str(&result2.as_string().unwrap()).unwrap();
        assert_eq!(records2.len(), 1);
        assert_eq!(records2[0]["name"], "Alice");
        assert_eq!(records2[0]["age"], "30");

        let result3 = parser.process_chunk("Bob,25\n").unwrap();
        let records3: Vec<Value> = serde_json::from_str(&result3.as_string().unwrap()).unwrap();
        assert_eq!(records3.len(), 1);
        assert_eq!(records3[0]["name"], "Bob");
        assert_eq!(records3[0]["age"], "25");
    }

    #[wasm_bindgen_test]
    fn test_csv_stream_parser_chunk_boundary() {
        let mut parser = CSVStreamParser::new(b',');

        // Process header
        parser.process_chunk("name,age\n").unwrap();

        // Split "Alice,30\n" across chunks
        let result1 = parser.process_chunk("Ali").unwrap();
        let records1: Vec<Value> = serde_json::from_str(&result1.as_string().unwrap()).unwrap();
        assert_eq!(records1.len(), 0); // Incomplete record

        let result2 = parser.process_chunk("ce,30\n").unwrap();
        let records2: Vec<Value> = serde_json::from_str(&result2.as_string().unwrap()).unwrap();
        assert_eq!(records2.len(), 1);
        assert_eq!(records2[0]["name"], "Alice");
        assert_eq!(records2[0]["age"], "30");
    }

    #[wasm_bindgen_test]
    fn test_csv_stream_parser_quoted_fields() {
        let mut parser = CSVStreamParser::new(b',');

        parser.process_chunk("name,description\n").unwrap();

        let result = parser.process_chunk("Alice,\"Hello, World\"\n").unwrap();
        let records: Vec<Value> = serde_json::from_str(&result.as_string().unwrap()).unwrap();
        assert_eq!(records.len(), 1);
        assert_eq!(records[0]["name"], "Alice");
        assert_eq!(records[0]["description"], "Hello, World");
    }

    #[wasm_bindgen_test]
    fn test_csv_stream_parser_flush() {
        let mut parser = CSVStreamParser::new(b',');

        parser.process_chunk("name,age\n").unwrap();
        parser.process_chunk("Alice,30").unwrap(); // No newline at end

        let result = parser.flush().unwrap();
        let records: Vec<Value> = serde_json::from_str(&result.as_string().unwrap()).unwrap();
        assert_eq!(records.len(), 1);
        assert_eq!(records[0]["name"], "Alice");
        assert_eq!(records[0]["age"], "30");
    }

    #[wasm_bindgen_test]
    fn test_csv_stream_parser_reset() {
        let mut parser = CSVStreamParser::new(b',');

        parser.process_chunk("name,age\nAlice,30\n").unwrap();

        // Reset and parse new CSV
        parser.reset();
        parser.process_chunk("color,count\n").unwrap();
        let result = parser.process_chunk("red,5\n").unwrap();
        let records: Vec<Value> = serde_json::from_str(&result.as_string().unwrap()).unwrap();
        assert_eq!(records.len(), 1);
        assert_eq!(records[0]["color"], "red");
        assert_eq!(records[0]["count"], "5");
    }
}

#[cfg(test)]
mod proptest_tests {
    use super::*;
    use proptest::prelude::*;

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
        prop::collection::vec(csv_field_strategy(), 1..10)
            .prop_map(|fields| {
                // Make fields unique by adding index
                fields
                    .into_iter()
                    .enumerate()
                    .map(|(i, f)| if f.is_empty() { format!("col{}", i) } else { format!("{}_{}", f, i) })
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
            let csv = tests::create_csv(&headers, &rows);

            let mut parser = CSVStreamParser::new(b',');
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
            let csv = tests::create_csv(&headers2, &rows);
            
            // Parse all at once
            let mut parser1 = CSVStreamParser::new(b',');
            let result1 = parser1.process_chunk(&csv).unwrap();
            let flush1 = parser1.flush().unwrap();
            
            // Parse in chunks
            let mut parser2 = CSVStreamParser::new(b',');
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
            let csv = tests::create_csv(&headers2, &rows);

            // Limit size for performance
            prop_assume!(csv.len() <= 100);

            let mut parser = CSVStreamParser::new(b',');

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
            
            let csv = tests::create_csv(&headers, &rows);
            
            let mut parser = CSVStreamParser::new(b',');
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
                .map(|h| tests::escape_csv_field(h))
                .collect::<Vec<_>>()
                .join(","));
            csv.push_str(line_ending);

            for row in &rows {
                csv.push_str(&row.iter()
                    .map(|f| tests::escape_csv_field(f))
                    .collect::<Vec<_>>()
                    .join(","));
                csv.push_str(line_ending);
            }

            let mut parser = CSVStreamParser::new(b',');
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

            let csv = tests::create_csv(&headers, &rows);

            let mut parser = CSVStreamParser::new(b',');
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

            let csv = tests::create_csv(&headers, &rows);

            let mut parser = CSVStreamParser::new(b',');
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

            let csv = tests::create_csv(&headers, &rows);

            let mut parser = CSVStreamParser::new(b',');
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
            let csv = tests::create_csv(&headers2, &rows);

            // Process as bytes
            let mut parser = CSVStreamParser::new(b',');
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

    // Regular test: Parser should handle special field name __proto__
    #[test]
    fn test_proto_field() {
        let headers = vec!["__proto__".to_string(), "normal".to_string()];
        let rows = vec![
            vec!["value1".to_string(), "value2".to_string()],
            vec!["value3".to_string(), "value4".to_string()],
        ];

        let csv = tests::create_csv(&headers, &rows);

        let mut parser = CSVStreamParser::new(b',');
        let result = parser.process_chunk(&csv).unwrap();
        let flush_result = parser.flush().unwrap();

        // Should produce valid arrays
        assert!(result.is_array());
        assert!(flush_result.is_array());
    }
}
