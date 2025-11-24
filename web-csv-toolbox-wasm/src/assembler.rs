use js_sys::{Array, Object, Reflect};
use wasm_bindgen::prelude::*;

/// CSV Record Assembler for assembling tokens into records
#[wasm_bindgen]
pub struct CSVRecordAssemblerLegacy {
    /// Current record being assembled (array of field values)
    current_record: Vec<String>,
    /// CSV headers
    headers: Option<Vec<String>>,
    /// Whether headers have been parsed
    headers_parsed: bool,
    /// Maximum field count per record
    max_field_count: usize,
    /// Output format: "object" or "array"
    output_format: String,
}

#[wasm_bindgen]
impl CSVRecordAssemblerLegacy {
    /// Create a new CSV record assembler
    ///
    /// # Arguments
    ///
    /// * `options` - JavaScript object with optional fields:
    ///   - `header`: array of strings (optional - custom headers)
    ///   - `maxFieldCount`: number (default: 100000)
    ///   - `outputFormat`: "object" | "array" (default: "object")
    #[wasm_bindgen(constructor)]
    pub fn new(options: JsValue) -> Result<CSVRecordAssemblerLegacy, JsError> {
        let mut headers: Option<Vec<String>> = None;
        let mut headers_parsed = false;
        let mut max_field_count = 100000;
        let mut output_format = "object".to_string();

        // Parse options if provided
        if !options.is_undefined() && !options.is_null() {
            let obj = Object::from(options);

            // Get header
            if let Ok(val) = Reflect::get(&obj, &"header".into()) {
                if !val.is_undefined() && !val.is_null() {
                    let headers_array = Array::from(&val);
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

            // Get maxFieldCount
            if let Ok(val) = Reflect::get(&obj, &"maxFieldCount".into()) {
                if let Some(n) = val.as_f64() {
                    if n <= 0.0 {
                        return Err(JsError::new("maxFieldCount must be positive"));
                    }
                    max_field_count = n as usize;
                }
            }

            // Get outputFormat
            if let Ok(val) = Reflect::get(&obj, &"outputFormat".into()) {
                if let Some(s) = val.as_string() {
                    if s != "object" && s != "array" {
                        return Err(JsError::new("outputFormat must be 'object' or 'array'"));
                    }
                    output_format = s;
                }
            }
        }

        Ok(Self {
            current_record: Vec::new(),
            headers,
            headers_parsed,
            max_field_count,
            output_format,
        })
    }

    /// Assemble tokens into CSV records
    ///
    /// # Arguments
    ///
    /// * `tokens` - Array of token objects or undefined to flush
    ///
    /// # Returns
    ///
    /// Array of record objects (or arrays if outputFormat is "array")
    #[wasm_bindgen]
    pub fn assemble(&mut self, tokens: Option<JsValue>) -> Result<JsValue, JsError> {
        let records = Array::new();

        if let Some(tokens_value) = tokens {
            let tokens_array = Array::from(&tokens_value);

            for i in 0..tokens_array.length() {
                let token = tokens_array.get(i);
                self.process_token(&token, &records)?;
            }
        } else {
            // Flush mode - emit final record if any
            if !self.current_record.is_empty() {
                if let Some(record) = self.create_record()? {
                    records.push(&record);
                }
                self.current_record.clear();
            }
        }

        Ok(records.into())
    }
}

impl CSVRecordAssemblerLegacy {
    /// Process a single token
    fn process_token(&mut self, token: &JsValue, records: &Array) -> Result<(), JsError> {
        let obj = Object::from(token.clone());

        // Get token type
        let token_type = Reflect::get(&obj, &"type".into())
            .map_err(|_| JsError::new("Token must have 'type' property"))?
            .as_string()
            .ok_or_else(|| JsError::new("Token 'type' must be a string"))?;

        match token_type.as_str() {
            "field" => {
                // Get field value
                let value = Reflect::get(&obj, &"value".into())
                    .map_err(|_| JsError::new("Field token must have 'value' property"))?
                    .as_string()
                    .ok_or_else(|| JsError::new("Field 'value' must be a string"))?;

                // Check field count limit
                if self.current_record.len() >= self.max_field_count {
                    return Err(JsError::new(&format!(
                        "Field count limit exceeded: maximum {} fields allowed per record",
                        self.max_field_count
                    )));
                }

                self.current_record.push(value);
            }
            "field-delimiter" => {
                // Field delimiter doesn't add to record, just marks field boundary
                // The field itself was already added as a "field" token
            }
            "record-delimiter" => {
                // Emit record
                if let Some(record) = self.create_record()? {
                    records.push(&record);
                }
                self.current_record.clear();
            }
            _ => {
                return Err(JsError::new(&format!("Unknown token type: {}", token_type)));
            }
        }

        Ok(())
    }

    /// Create a record from current fields
    fn create_record(&mut self) -> Result<Option<JsValue>, JsError> {
        // Empty record
        if self.current_record.is_empty() && !self.headers_parsed {
            return Ok(None);
        }

        let record = std::mem::take(&mut self.current_record);

        if !self.headers_parsed {
            // First record is headers
            self.headers = Some(record);
            self.headers_parsed = true;
            Ok(None)
        } else {
            // Subsequent records are data
            if self.output_format == "array" {
                // Return as array
                let arr = Array::new();
                for field in &record {
                    arr.push(&JsValue::from_str(field));
                }
                Ok(Some(arr.into()))
            } else {
                // Return as object
                if let Some(ref headers) = self.headers {
                    let obj = Object::new();
                    for (i, header) in headers.iter().enumerate() {
                        let field = record.get(i).map(|s| s.as_str()).unwrap_or("");
                        let key = JsValue::from_str(header);
                        let value = JsValue::from_str(field);

                        // Use Object.defineProperty to handle special property names like __proto__
                        let descriptor = Object::new();
                        let _ = Reflect::set(&descriptor, &"value".into(), &value);
                        let _ = Reflect::set(&descriptor, &"writable".into(), &JsValue::TRUE);
                        let _ = Reflect::set(&descriptor, &"enumerable".into(), &JsValue::TRUE);
                        let _ = Reflect::set(&descriptor, &"configurable".into(), &JsValue::TRUE);
                        let _ = Object::define_property(&obj, &key, &descriptor);
                    }
                    Ok(Some(obj.into()))
                } else {
                    // No headers - shouldn't happen but handle gracefully
                    Ok(None)
                }
            }
        }
    }
}
