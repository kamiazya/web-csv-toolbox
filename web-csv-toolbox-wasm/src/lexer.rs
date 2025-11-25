use js_sys::{Array, Object, Reflect};
use wasm_bindgen::prelude::*;

/// Token type constants - must match TypeScript's TokenType enum
/// in src/core/constants.ts
const TOKEN_TYPE_FIELD: u32 = 0;
const TOKEN_TYPE_FIELD_DELIMITER: u32 = 1;
const TOKEN_TYPE_RECORD_DELIMITER: u32 = 2;

/// Flat tokens result for optimized boundary crossing
/// Returns raw token data that can be assembled on JS side
/// Arrays are pre-converted to JsValue to avoid repeated conversions
#[wasm_bindgen]
pub struct FlatTokensResult {
    types_array: JsValue,
    values_array: JsValue,
    lines_array: JsValue,
    columns_array: JsValue,
    offsets_array: JsValue,
    token_count: usize,
}

#[wasm_bindgen]
impl FlatTokensResult {
    /// Create new FlatTokensResult with pre-converted JS arrays
    pub(crate) fn new(
        types: Vec<u32>,
        values: Vec<String>,
        lines: Vec<usize>,
        columns: Vec<usize>,
        offsets: Vec<usize>,
    ) -> Self {
        let token_count = types.len();

        // Convert to JS arrays once
        // Token types are now numeric (0=Field, 1=FieldDelimiter, 2=RecordDelimiter)
        let types_array = {
            let arr = Array::new();
            for &t in &types {
                arr.push(&JsValue::from_f64(t as f64));
            }
            arr.into()
        };

        let values_array = {
            let arr = Array::new();
            for v in &values {
                arr.push(&JsValue::from_str(v));
            }
            arr.into()
        };

        let lines_array = {
            let arr = Array::new();
            for &line in &lines {
                arr.push(&JsValue::from_f64(line as f64));
            }
            arr.into()
        };

        let columns_array = {
            let arr = Array::new();
            for &col in &columns {
                arr.push(&JsValue::from_f64(col as f64));
            }
            arr.into()
        };

        let offsets_array = {
            let arr = Array::new();
            for &offset in &offsets {
                arr.push(&JsValue::from_f64(offset as f64));
            }
            arr.into()
        };

        Self {
            types_array,
            values_array,
            lines_array,
            columns_array,
            offsets_array,
            token_count,
        }
    }

    /// Get token types as JS array
    #[wasm_bindgen(getter)]
    pub fn types(&self) -> JsValue {
        self.types_array.clone()
    }

    /// Get token values as JS array
    #[wasm_bindgen(getter)]
    pub fn values(&self) -> JsValue {
        self.values_array.clone()
    }

    /// Get line numbers as JS array
    #[wasm_bindgen(getter)]
    pub fn lines(&self) -> JsValue {
        self.lines_array.clone()
    }

    /// Get column numbers as JS array
    #[wasm_bindgen(getter)]
    pub fn columns(&self) -> JsValue {
        self.columns_array.clone()
    }

    /// Get byte offsets as JS array
    #[wasm_bindgen(getter)]
    pub fn offsets(&self) -> JsValue {
        self.offsets_array.clone()
    }

    /// Get total token count
    #[wasm_bindgen(getter = tokenCount)]
    pub fn token_count(&self) -> usize {
        self.token_count
    }
}

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

    pub fn to_js_object(self) -> Object {
        let obj = Object::new();
        let _ = Reflect::set(&obj, &"line".into(), &JsValue::from_f64(self.line as f64));
        let _ = Reflect::set(
            &obj,
            &"column".into(),
            &JsValue::from_f64(self.column as f64),
        );
        let _ = Reflect::set(
            &obj,
            &"offset".into(),
            &JsValue::from_f64(self.offset as f64),
        );
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

    /// Lex a chunk of binary CSV data using Truly Flat optimization
    ///
    /// Returns raw token data as flat arrays for minimal WASM↔JS boundary crossing.
    /// Token assembly happens on the JS side.
    ///
    /// # Arguments
    ///
    /// * `chunk` - Optional Uint8Array chunk to lex
    ///
    /// # Returns
    ///
    /// FlatTokensResult with arrays:
    /// - types: ["field", "field-delimiter", "record-delimiter", ...]
    /// - values: [field_value, delimiter_char, newline_char, ...]
    /// - lines: [start_line, ...]
    /// - columns: [start_column, ...]
    /// - offsets: [start_offset, ...]
    #[wasm_bindgen(js_name = "lexFlat")]
    pub fn lex_flat(
        &mut self,
        chunk: Option<js_sys::Uint8Array>,
    ) -> Result<FlatTokensResult, JsError> {
        let mut types: Vec<u32> = Vec::new();
        let mut values: Vec<String> = Vec::new();
        let mut lines: Vec<usize> = Vec::new();
        let mut columns: Vec<usize> = Vec::new();
        let mut offsets: Vec<usize> = Vec::new();

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

            // Process the text and collect flat token data
            self.process_text_flat(
                &text,
                &mut types,
                &mut values,
                &mut lines,
                &mut columns,
                &mut offsets,
            )?;

            // Keep incomplete UTF-8 bytes for next chunk
            self.utf8_buffer.drain(..valid_up_to);
        } else {
            // Flush mode - emit final field token if any
            if !self.current_field.is_empty() || self.state != LexerState::FieldStart {
                self.emit_field_token_flat(
                    &mut types,
                    &mut values,
                    &mut lines,
                    &mut columns,
                    &mut offsets,
                );
            }
        }

        Ok(FlatTokensResult::new(
            types, values, lines, columns, offsets,
        ))
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
                    valid_up_to = if i + 2 <= self.utf8_buffer.len() {
                        i + 2
                    } else {
                        i
                    };
                    break;
                } else if (byte & 0b1111_0000) == 0b1110_0000 {
                    valid_up_to = if i + 3 <= self.utf8_buffer.len() {
                        i + 3
                    } else {
                        i
                    };
                    break;
                } else if (byte & 0b1111_1000) == 0b1111_0000 {
                    valid_up_to = if i + 4 <= self.utf8_buffer.len() {
                        i + 4
                    } else {
                        i
                    };
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
        let _ = Reflect::set(
            &token,
            &"value".into(),
            &(self.delimiter as char).to_string().into(),
        );
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
        let _ = Reflect::set(
            &location,
            &"start".into(),
            &self.token_start.to_js_object().into(),
        );
        let _ = Reflect::set(
            &location,
            &"end".into(),
            &self.position.to_js_object().into(),
        );
        let _ = Reflect::set(
            &location,
            &"rowNumber".into(),
            &JsValue::from_f64(self.row_number as f64),
        );
        location.into()
    }

    // ========== Flat token methods for Truly Flat optimization ==========

    /// Process text and collect flat token data
    fn process_text_flat(
        &mut self,
        text: &str,
        types: &mut Vec<u32>,
        values: &mut Vec<String>,
        lines: &mut Vec<usize>,
        columns: &mut Vec<usize>,
        offsets: &mut Vec<usize>,
    ) -> Result<(), JsError> {
        for ch in text.chars() {
            match self.state {
                LexerState::FieldStart => {
                    self.token_start = self.position;

                    if ch == self.quote as char {
                        self.state = LexerState::InQuotedField;
                    } else if ch == self.delimiter as char {
                        self.emit_field_token_flat(types, values, lines, columns, offsets);
                        self.emit_field_delimiter_token_flat(
                            types, values, lines, columns, offsets,
                        );
                    } else if ch == '\n' || ch == '\r' {
                        self.emit_field_token_flat(types, values, lines, columns, offsets);
                        self.emit_record_delimiter_token_flat(
                            ch, types, values, lines, columns, offsets,
                        );
                    } else {
                        self.current_field.push(ch);
                        self.state = LexerState::InField;
                    }
                }
                LexerState::InField => {
                    if ch == self.delimiter as char {
                        self.emit_field_token_flat(types, values, lines, columns, offsets);
                        self.emit_field_delimiter_token_flat(
                            types, values, lines, columns, offsets,
                        );
                        self.state = LexerState::FieldStart;
                    } else if ch == '\n' || ch == '\r' {
                        self.emit_field_token_flat(types, values, lines, columns, offsets);
                        self.emit_record_delimiter_token_flat(
                            ch, types, values, lines, columns, offsets,
                        );
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
                        self.emit_field_token_flat(types, values, lines, columns, offsets);
                        self.emit_field_delimiter_token_flat(
                            types, values, lines, columns, offsets,
                        );
                        self.state = LexerState::FieldStart;
                    } else if ch == '\n' || ch == '\r' {
                        self.emit_field_token_flat(types, values, lines, columns, offsets);
                        self.emit_record_delimiter_token_flat(
                            ch, types, values, lines, columns, offsets,
                        );
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

    /// Emit a field token (flat)
    fn emit_field_token_flat(
        &mut self,
        types: &mut Vec<u32>,
        values: &mut Vec<String>,
        lines: &mut Vec<usize>,
        columns: &mut Vec<usize>,
        offsets: &mut Vec<usize>,
    ) {
        types.push(TOKEN_TYPE_FIELD);
        values.push(std::mem::take(&mut self.current_field));
        lines.push(self.token_start.line);
        columns.push(self.token_start.column);
        offsets.push(self.token_start.offset);
    }

    /// Emit a field delimiter token (flat)
    fn emit_field_delimiter_token_flat(
        &mut self,
        types: &mut Vec<u32>,
        values: &mut Vec<String>,
        lines: &mut Vec<usize>,
        columns: &mut Vec<usize>,
        offsets: &mut Vec<usize>,
    ) {
        types.push(TOKEN_TYPE_FIELD_DELIMITER);
        values.push((self.delimiter as char).to_string());
        lines.push(self.position.line);
        columns.push(self.position.column);
        offsets.push(self.position.offset);
    }

    /// Emit a record delimiter token (flat)
    fn emit_record_delimiter_token_flat(
        &mut self,
        ch: char,
        types: &mut Vec<u32>,
        values: &mut Vec<String>,
        lines: &mut Vec<usize>,
        columns: &mut Vec<usize>,
        offsets: &mut Vec<usize>,
    ) {
        types.push(TOKEN_TYPE_RECORD_DELIMITER);
        values.push(ch.to_string());
        lines.push(self.position.line);
        columns.push(self.position.column);
        offsets.push(self.position.offset);

        self.row_number += 1;
    }
}
