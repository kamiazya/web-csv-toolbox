use js_sys::{Array, Object, Reflect};
use wasm_bindgen::prelude::*;

/// Lexer state for CSV parsing
#[derive(Debug, Clone, PartialEq)]
pub(crate) enum LexerState {
    /// At the start of a field
    FieldStart,
    /// Inside an unquoted field
    InField,
    /// Inside a quoted field
    InQuotedField,
    /// After a quote inside a quoted field (could be end or escaped quote)
    AfterQuote,
}

/// Position in the CSV input
#[derive(Debug, Clone, Copy)]
pub(crate) struct Position {
    pub line: usize,
    pub column: usize,
    pub offset: usize,
}

impl Position {
    pub fn new() -> Self {
        Self {
            line: 1,
            column: 1,
            offset: 0,
        }
    }

    pub fn to_js_object(&self) -> Object {
        let obj = Object::new();
        let _ = Reflect::set(&obj, &"line".into(), &JsValue::from_f64(self.line as f64));
        let _ = Reflect::set(&obj, &"column".into(), &JsValue::from_f64(self.column as f64));
        let _ = Reflect::set(&obj, &"offset".into(), &JsValue::from_f64(self.offset as f64));
        obj
    }
}

/// CSV Lexer for tokenizing binary input
#[wasm_bindgen]
pub struct BinaryCSVLexerLegacy {
    /// Current lexer state
    state: LexerState,
    /// Field delimiter
    delimiter: u8,
    /// Quote character
    quote: u8,
    /// Current position
    position: Position,
    /// Start position of current token
    token_start: Position,
    /// Current field value being accumulated
    current_field: String,
    /// Buffer for incomplete UTF-8 sequences
    utf8_buffer: Vec<u8>,
    /// Current row number
    row_number: usize,
}

#[wasm_bindgen]
impl BinaryCSVLexerLegacy {
    /// Create a new binary CSV lexer
    ///
    /// # Arguments
    ///
    /// * `options` - JavaScript object with optional fields:
    ///   - `delimiter`: string (default: ",")
    ///   - `quotation`: string (default: "\"")
    #[wasm_bindgen(constructor)]
    pub fn new(options: JsValue) -> Result<BinaryCSVLexerLegacy, JsError> {
        let mut delimiter = b',';
        let mut quote = b'"';

        // Parse options if provided
        if !options.is_undefined() && !options.is_null() {
            let obj = Object::from(options);

            // Get delimiter
            if let Ok(val) = Reflect::get(&obj, &"delimiter".into()) {
                if let Some(s) = val.as_string() {
                    if s.len() != 1 {
                        return Err(JsError::new("delimiter must be a single character"));
                    }
                    delimiter = s.as_bytes()[0];
                }
            }

            // Get quotation
            if let Ok(val) = Reflect::get(&obj, &"quotation".into()) {
                if let Some(s) = val.as_string() {
                    if s.len() != 1 {
                        return Err(JsError::new("quotation must be a single character"));
                    }
                    quote = s.as_bytes()[0];
                }
            }
        }

        Ok(Self {
            state: LexerState::FieldStart,
            delimiter,
            quote,
            position: Position::new(),
            token_start: Position::new(),
            current_field: String::new(),
            utf8_buffer: Vec::new(),
            row_number: 1,
        })
    }

    /// Lex a chunk of binary CSV data
    ///
    /// # Arguments
    ///
    /// * `chunk` - Optional Uint8Array chunk to lex
    ///
    /// # Returns
    ///
    /// Array of token objects with structure:
    /// - type: "field" | "field-delimiter" | "record-delimiter"
    /// - value: string
    /// - location: { start: Position, end: Position, rowNumber: number }
    #[wasm_bindgen]
    pub fn lex(&mut self, chunk: Option<js_sys::Uint8Array>) -> Result<JsValue, JsError> {
        let tokens = Array::new();

        if let Some(chunk) = chunk {
            // Convert Uint8Array to bytes
            let mut chunk_bytes = vec![0u8; chunk.length() as usize];
            chunk.copy_to(&mut chunk_bytes);

            // Append to UTF-8 buffer
            self.utf8_buffer.extend_from_slice(&chunk_bytes);

            // Find the last complete UTF-8 character boundary
            let valid_up_to = self.find_utf8_boundary();

            // Process complete UTF-8 portion
            let text = std::str::from_utf8(&self.utf8_buffer[..valid_up_to])
                .map_err(|e| JsError::new(&format!("Invalid UTF-8: {}", e)))?
                .to_string();

            // Process the text and collect tokens
            self.process_text(&text, &tokens)?;

            // Keep incomplete UTF-8 bytes for next chunk
            self.utf8_buffer.drain(..valid_up_to);
        } else {
            // Flush mode - emit final field token if any
            if !self.current_field.is_empty() || self.state != LexerState::FieldStart {
                self.emit_field_token(&tokens);
            }
        }

        Ok(tokens.into())
    }
}

impl BinaryCSVLexerLegacy {
    /// Find UTF-8 character boundary
    fn find_utf8_boundary(&self) -> usize {
        let mut valid_up_to = self.utf8_buffer.len();

        if !self.utf8_buffer.is_empty() {
            let mut i = self.utf8_buffer.len();
            while i > 0 && i > self.utf8_buffer.len().saturating_sub(4) {
                i -= 1;
                let byte = self.utf8_buffer[i];

                if (byte & 0b1000_0000) == 0 {
                    valid_up_to = i + 1;
                    break;
                } else if (byte & 0b1110_0000) == 0b1100_0000 {
                    valid_up_to = if i + 2 <= self.utf8_buffer.len() { i + 2 } else { i };
                    break;
                } else if (byte & 0b1111_0000) == 0b1110_0000 {
                    valid_up_to = if i + 3 <= self.utf8_buffer.len() { i + 3 } else { i };
                    break;
                } else if (byte & 0b1111_1000) == 0b1111_0000 {
                    valid_up_to = if i + 4 <= self.utf8_buffer.len() { i + 4 } else { i };
                    break;
                }
            }
        }

        valid_up_to
    }

    /// Process text and emit tokens
    fn process_text(&mut self, text: &str, tokens: &Array) -> Result<(), JsError> {
        for ch in text.chars() {
            match self.state {
                LexerState::FieldStart => {
                    self.token_start = self.position;

                    if ch == self.quote as char {
                        self.state = LexerState::InQuotedField;
                    } else if ch == self.delimiter as char {
                        self.emit_field_token(tokens);
                        self.emit_field_delimiter_token(tokens);
                    } else if ch == '\n' || ch == '\r' {
                        self.emit_field_token(tokens);
                        self.emit_record_delimiter_token(tokens, ch);
                    } else {
                        self.current_field.push(ch);
                        self.state = LexerState::InField;
                    }
                }
                LexerState::InField => {
                    if ch == self.delimiter as char {
                        self.emit_field_token(tokens);
                        self.emit_field_delimiter_token(tokens);
                        self.state = LexerState::FieldStart;
                    } else if ch == '\n' || ch == '\r' {
                        self.emit_field_token(tokens);
                        self.emit_record_delimiter_token(tokens, ch);
                        self.state = LexerState::FieldStart;
                    } else {
                        self.current_field.push(ch);
                    }
                }
                LexerState::InQuotedField => {
                    if ch == self.quote as char {
                        self.state = LexerState::AfterQuote;
                    } else {
                        self.current_field.push(ch);
                    }
                }
                LexerState::AfterQuote => {
                    if ch == self.quote as char {
                        // Escaped quote
                        self.current_field.push(ch);
                        self.state = LexerState::InQuotedField;
                    } else if ch == self.delimiter as char {
                        self.emit_field_token(tokens);
                        self.emit_field_delimiter_token(tokens);
                        self.state = LexerState::FieldStart;
                    } else if ch == '\n' || ch == '\r' {
                        self.emit_field_token(tokens);
                        self.emit_record_delimiter_token(tokens, ch);
                        self.state = LexerState::FieldStart;
                    } else {
                        self.state = LexerState::InField;
                    }
                }
            }

            // Update position
            self.position.offset += ch.len_utf8();
            if ch == '\n' {
                self.position.line += 1;
                self.position.column = 1;
            } else {
                self.position.column += 1;
            }
        }

        Ok(())
    }

    /// Emit a field token
    fn emit_field_token(&mut self, tokens: &Array) {
        let token = Object::new();
        let _ = Reflect::set(&token, &"type".into(), &"field".into());
        let _ = Reflect::set(&token, &"value".into(), &self.current_field.as_str().into());
        let _ = Reflect::set(&token, &"location".into(), &self.create_location());
        tokens.push(&token.into());

        self.current_field.clear();
    }

    /// Emit a field delimiter token
    fn emit_field_delimiter_token(&mut self, tokens: &Array) {
        let token = Object::new();
        let _ = Reflect::set(&token, &"type".into(), &"field-delimiter".into());
        let _ = Reflect::set(&token, &"value".into(), &(self.delimiter as char).to_string().into());
        let _ = Reflect::set(&token, &"location".into(), &self.create_location());
        tokens.push(&token.into());
    }

    /// Emit a record delimiter token
    fn emit_record_delimiter_token(&mut self, tokens: &Array, ch: char) {
        let token = Object::new();
        let _ = Reflect::set(&token, &"type".into(), &"record-delimiter".into());
        let _ = Reflect::set(&token, &"value".into(), &ch.to_string().into());
        let _ = Reflect::set(&token, &"location".into(), &self.create_location());
        tokens.push(&token.into());

        self.row_number += 1;
    }

    /// Create location object
    fn create_location(&self) -> JsValue {
        let location = Object::new();
        let _ = Reflect::set(&location, &"start".into(), &self.token_start.to_js_object().into());
        let _ = Reflect::set(&location, &"end".into(), &self.position.to_js_object().into());
        let _ = Reflect::set(&location, &"rowNumber".into(), &JsValue::from_f64(self.row_number as f64));
        location.into()
    }
}
