use js_sys::{Array, Object, Reflect};
use wasm_bindgen::prelude::*;

/// Parser state for streaming CSV parsing
#[derive(Debug, Clone, PartialEq)]
pub(crate) enum ParserState {
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
pub struct CSVParser {
    /// Current parser state
    pub(crate) state: ParserState,
    /// Field delimiter (e.g., ',' or '\t')
    pub(crate) delimiter: u8,
    /// Current field being accumulated
    pub(crate) current_field: String,
    /// Current record being accumulated
    pub(crate) current_record: Vec<String>,
    /// CSV headers (set after first record)
    pub(crate) headers: Option<Vec<String>>,
    /// Whether the parser has been initialized with headers
    pub(crate) headers_parsed: bool,
    /// Quote character
    pub(crate) quote: u8,
    /// Buffer for incomplete UTF-8 sequences
    pub(crate) utf8_buffer: Vec<u8>,
    /// Maximum field count per record
    pub(crate) max_field_count: usize,
}

#[wasm_bindgen]
impl CSVParser {
    /// Create a new streaming CSV parser with options from JavaScript object
    ///
    /// # Arguments
    ///
    /// * `options` - JavaScript object with optional fields:
    ///   - `delimiter`: string (default: ",")
    ///   - `quote`: string (default: "\"")
    ///   - `maxFieldCount`: number (default: 100000)
    ///   - `header`: array of strings (optional)
    ///
    /// # Example (JavaScript)
    /// ```javascript
    /// const parser = new CSVParser({
    ///   delimiter: ',',
    ///   quote: '"',
    ///   maxFieldCount: 100000,
    ///   header: ['id', 'name', 'email']
    /// });
    /// ```
    #[wasm_bindgen(constructor)]
    pub fn new(options: JsValue) -> Result<CSVParser, JsError> {
        // Default values
        let mut delimiter = b',';
        let mut quote = b'"';
        let mut max_field_count = 100000;
        let mut headers: Option<Vec<String>> = None;
        let mut headers_parsed = false;

        // Parse options if provided
        if !options.is_undefined() && !options.is_null() {
            let obj = js_sys::Object::from(options);

            // Get delimiter
            if let Ok(val) = Reflect::get(&obj, &JsValue::from_str("delimiter")) {
                if let Some(s) = val.as_string() {
                    if s.len() != 1 {
                        return Err(JsError::new("delimiter must be a single character"));
                    }
                    delimiter = s.as_bytes()[0];
                }
            }

            // Get quote
            if let Ok(val) = Reflect::get(&obj, &JsValue::from_str("quote")) {
                if let Some(s) = val.as_string() {
                    if s.len() != 1 {
                        return Err(JsError::new("quote must be a single character"));
                    }
                    quote = s.as_bytes()[0];
                }
            }

            // Get maxFieldCount
            if let Ok(val) = Reflect::get(&obj, &JsValue::from_str("maxFieldCount")) {
                if let Some(n) = val.as_f64() {
                    if n <= 0.0 {
                        return Err(JsError::new("maxFieldCount must be positive"));
                    }
                    max_field_count = n as usize;
                }
            }

            // Get header
            if let Ok(val) = Reflect::get(&obj, &JsValue::from_str("header")) {
                if !val.is_undefined() && !val.is_null() {
                    let headers_array = js_sys::Array::from(&val);
                    let mut headers_vec = Vec::new();

                    for i in 0..headers_array.length() {
                        let item = headers_array.get(i);
                        if let Some(s) = item.as_string() {
                            headers_vec.push(s);
                        } else {
                            return Err(JsError::new("All header items must be strings"));
                        }
                    }

                    headers = Some(headers_vec);
                    headers_parsed = true;
                }
            }
        }

        Ok(Self {
            state: ParserState::FieldStart,
            delimiter,
            current_field: String::new(),
            current_record: Vec::new(),
            headers,
            headers_parsed,
            quote,
            utf8_buffer: Vec::new(),
            max_field_count,
        })
    }

    /// Create a new streaming CSV parser with custom options
    ///
    /// # Arguments
    ///
    /// * `delimiter` - Field delimiter byte (e.g., 44 for comma)
    /// * `quote` - Quote character byte (e.g., 34 for double quote)
    /// * `max_field_count` - Maximum number of fields per record
    #[wasm_bindgen(js_name = withOptions)]
    pub fn with_options(delimiter: u8, quote: u8, max_field_count: usize) -> Self {
        Self {
            state: ParserState::FieldStart,
            delimiter,
            current_field: String::new(),
            current_record: Vec::new(),
            headers: None,
            headers_parsed: false,
            quote,
            utf8_buffer: Vec::new(),
            max_field_count,
        }
    }

    /// Create a new streaming CSV parser with custom header
    ///
    /// # Arguments
    ///
    /// * `delimiter` - Field delimiter byte (e.g., 44 for comma)
    /// * `quote` - Quote character byte (e.g., 34 for double quote)
    /// * `max_field_count` - Maximum number of fields per record
    /// * `headers` - Custom headers as JavaScript array of strings
    #[wasm_bindgen(js_name = withCustomHeader)]
    pub fn with_custom_header(
        delimiter: u8,
        quote: u8,
        max_field_count: usize,
        headers: JsValue,
    ) -> Result<CSVParser, JsError> {
        // Convert JsValue to Vec<String>
        let headers_array = js_sys::Array::from(&headers);
        let mut headers_vec = Vec::new();

        for i in 0..headers_array.length() {
            let item = headers_array.get(i);
            if let Some(s) = item.as_string() {
                headers_vec.push(s);
            } else {
                return Err(JsError::new("All header items must be strings"));
            }
        }

        Ok(Self {
            state: ParserState::FieldStart,
            delimiter,
            current_field: String::new(),
            current_record: Vec::new(),
            headers: Some(headers_vec),
            headers_parsed: true, // Headers are already set
            quote,
            utf8_buffer: Vec::new(),
            max_field_count,
        })
    }

    /// Process a chunk of CSV data
    ///
    /// # Arguments
    ///
    /// * `chunk` - String chunk of CSV data to process
    ///
    /// # Returns
    ///
    /// Array of completed records as JsValue objects
    #[wasm_bindgen(js_name = processChunk)]
    pub fn process_chunk(&mut self, chunk: &str) -> Result<JsValue, JsError> {
        let completed_records = Array::new();

        for ch in chunk.chars() {
            match self.state {
                ParserState::FieldStart => {
                    if ch == self.quote as char {
                        self.state = ParserState::InQuotedField;
                    } else if ch == self.delimiter as char {
                        self.finish_field().map_err(|e| JsError::new(&e))?;
                    } else if ch == '\n' || ch == '\r' {
                        if !self.current_field.is_empty() || !self.current_record.is_empty() {
                            self.finish_field().map_err(|e| JsError::new(&e))?;
                            if let Some(record) = self.finish_record() {
                                completed_records.push(&record);
                            }
                        }
                    } else {
                        self.current_field.push(ch);
                        self.state = ParserState::InField;
                    }
                }
                ParserState::InField => {
                    if ch == self.delimiter as char {
                        self.finish_field().map_err(|e| JsError::new(&e))?;
                        self.state = ParserState::FieldStart;
                    } else if ch == '\n' || ch == '\r' {
                        self.finish_field().map_err(|e| JsError::new(&e))?;
                        if let Some(record) = self.finish_record() {
                            completed_records.push(&record);
                        }
                        self.state = ParserState::FieldStart;
                    } else {
                        self.current_field.push(ch);
                    }
                }
                ParserState::InQuotedField => {
                    if ch == self.quote as char {
                        self.state = ParserState::AfterQuote;
                    } else {
                        self.current_field.push(ch);
                    }
                }
                ParserState::AfterQuote => {
                    if ch == self.quote as char {
                        // Escaped quote
                        self.current_field.push(ch);
                        self.state = ParserState::InQuotedField;
                    } else if ch == self.delimiter as char {
                        self.finish_field().map_err(|e| JsError::new(&e))?;
                        self.state = ParserState::FieldStart;
                    } else if ch == '\n' || ch == '\r' {
                        self.finish_field().map_err(|e| JsError::new(&e))?;
                        if let Some(record) = self.finish_record() {
                            completed_records.push(&record);
                        }
                        self.state = ParserState::FieldStart;
                    } else {
                        // After closing quote, ignore other characters until delimiter/newline
                        self.state = ParserState::InField;
                    }
                }
            }
        }

        Ok(completed_records.into())
    }

    /// Process a chunk of binary CSV data (Uint8Array)
    ///
    /// # Arguments
    ///
    /// * `bytes` - Uint8Array chunk of CSV data to process
    ///
    /// # Returns
    ///
    /// Array of completed records as JsValue objects
    #[wasm_bindgen(js_name = processChunkBytes)]
    pub fn process_chunk_bytes(&mut self, bytes: &js_sys::Uint8Array) -> Result<JsValue, JsError> {
        // Copy bytes from Uint8Array to Vec<u8>
        let mut chunk_bytes = vec![0u8; bytes.length() as usize];
        bytes.copy_to(&mut chunk_bytes);

        // Append to UTF-8 buffer
        self.utf8_buffer.extend_from_slice(&chunk_bytes);

        // Find the last complete UTF-8 character boundary
        let mut valid_up_to = self.utf8_buffer.len();

        // Check if we have incomplete UTF-8 sequence at the end
        if !self.utf8_buffer.is_empty() {
            let mut i = self.utf8_buffer.len();
            while i > 0 && i > self.utf8_buffer.len().saturating_sub(4) {
                i -= 1;
                let byte = self.utf8_buffer[i];

                // Check for start of a multi-byte sequence
                if (byte & 0b1000_0000) == 0 {
                    // Single-byte character (ASCII), we're at a boundary
                    valid_up_to = i + 1;
                    break;
                } else if (byte & 0b1110_0000) == 0b1100_0000 {
                    // Start of 2-byte sequence
                    if i + 2 <= self.utf8_buffer.len() {
                        valid_up_to = i + 2;
                    } else {
                        valid_up_to = i;
                    }
                    break;
                } else if (byte & 0b1111_0000) == 0b1110_0000 {
                    // Start of 3-byte sequence
                    if i + 3 <= self.utf8_buffer.len() {
                        valid_up_to = i + 3;
                    } else {
                        valid_up_to = i;
                    }
                    break;
                } else if (byte & 0b1111_1000) == 0b1111_0000 {
                    // Start of 4-byte sequence
                    if i + 4 <= self.utf8_buffer.len() {
                        valid_up_to = i + 4;
                    } else {
                        valid_up_to = i;
                    }
                    break;
                }
            }
        }

        // Process complete UTF-8 portion
        // Convert to owned String to end the immutable borrow before calling process_chunk
        let text = std::str::from_utf8(&self.utf8_buffer[..valid_up_to])
            .map_err(|e| JsError::new(&format!("Invalid UTF-8: {}", e)))?
            .to_string();

        // Process the valid text
        let result = self.process_chunk(&text)?;

        // Keep incomplete UTF-8 bytes for next chunk
        self.utf8_buffer.drain(..valid_up_to);

        Ok(result)
    }

    /// Flush any remaining data in the parser
    ///
    /// Call this when the stream ends to get the last record
    ///
    /// # Returns
    ///
    /// Array of final records as JsValue objects
    #[wasm_bindgen]
    pub fn flush(&mut self) -> Result<JsValue, JsError> {
        let completed_records = Array::new();

        // Handle any remaining data based on current state
        match self.state {
            ParserState::InQuotedField => {
                // Unclosed quoted field - finish it
                self.finish_field().map_err(|e| JsError::new(&e))?;
                if let Some(record) = self.finish_record() {
                    completed_records.push(&record);
                }
            }
            ParserState::AfterQuote | ParserState::InField => {
                // Finish current field and record
                self.finish_field().map_err(|e| JsError::new(&e))?;
                if let Some(record) = self.finish_record() {
                    completed_records.push(&record);
                }
            }
            ParserState::FieldStart => {
                // If we have a current record or field, finish it
                if !self.current_record.is_empty() {
                    self.finish_field().map_err(|e| JsError::new(&e))?;
                    if let Some(record) = self.finish_record() {
                        completed_records.push(&record);
                    }
                } else if !self.current_field.is_empty() {
                    self.finish_field().map_err(|e| JsError::new(&e))?;
                    if let Some(record) = self.finish_record() {
                        completed_records.push(&record);
                    }
                }
            }
        }

        // Reset parser state
        self.state = ParserState::FieldStart;
        self.current_field.clear();
        self.current_record.clear();
        self.utf8_buffer.clear();

        Ok(completed_records.into())
    }
}

impl CSVParser {
    /// Finish the current field and add it to the current record
    pub(crate) fn finish_field(&mut self) -> Result<(), String> {
        if self.current_record.len() >= self.max_field_count {
            return Err(format!(
                "Field count limit exceeded: maximum {} fields allowed per record",
                self.max_field_count
            ));
        }
        let field = std::mem::take(&mut self.current_field);
        self.current_record.push(field);
        Ok(())
    }

    /// Finish the current record and return it as a JsValue
    /// Returns None if the record should not be emitted (e.g., headers)
    pub(crate) fn finish_record(&mut self) -> Option<JsValue> {
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
            // Subsequent records are data
            if let Some(ref headers) = self.headers {
                let obj = Object::new();
                for (i, header) in headers.iter().enumerate() {
                    let field = record.get(i).map(|s| s.as_str()).unwrap_or("");
                    let key = JsValue::from_str(header);
                    let value = JsValue::from_str(field);

                    // Use Object.defineProperty to handle special property names like __proto__
                    // which cannot be set properly with Reflect.set
                    let descriptor = Object::new();
                    let _ = Reflect::set(&descriptor, &JsValue::from_str("value"), &value);
                    let _ =
                        Reflect::set(&descriptor, &JsValue::from_str("writable"), &JsValue::TRUE);
                    let _ = Reflect::set(
                        &descriptor,
                        &JsValue::from_str("enumerable"),
                        &JsValue::TRUE,
                    );
                    let _ = Reflect::set(
                        &descriptor,
                        &JsValue::from_str("configurable"),
                        &JsValue::TRUE,
                    );
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
