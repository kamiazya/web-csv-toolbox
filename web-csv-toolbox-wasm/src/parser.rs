//! CSV Parser using csv-core library
//!
//! This module implements high-performance CSV parsing using the csv-core library
//! from BurntSushi's rust-csv project. csv-core provides a zero-allocation,
//! streaming CSV parser.
//!
//! # Design Philosophy: Flat Data Transfer Format
//!
//! This parser uses a "Flat" data transfer format optimized for WASM↔JS boundary
//! crossing efficiency. The key insight is that **WASM↔JS boundary crossings are
//! expensive** - each call to create a JavaScript object, set a property, or push
//! to an array requires crossing this boundary.
//!
//! ## Traditional Object Approach (SLOW)
//! ```text
//! For N records with M fields each:
//! - N × Object.new() calls
//! - N × M × Reflect.set() calls
//! - N × Array.push() calls
//! Total: N × (1 + M + 1) = N × (M + 2) boundary crossings
//! For 10,000 records × 50 fields = 520,000 boundary crossings
//! ```
//!
//! ## Flat Array Approach (FAST)
//! ```text
//! - 1 × headers array (cached, created once)
//! - 1 × fieldData array (all field values in a single flat array)
//! - 1 × actualFieldCounts array (for handling variable-length records)
//! Total: ~3 boundary crossings (plus internal array operations)
//! For 10,000 records × 50 fields = still ~3 boundary crossings
//! ```
//!
//! The flat format returns:
//! - `headers`: Array of header names (from first row or user-specified)
//! - `fieldData`: Flat array of all field values [r0f0, r0f1, ..., r1f0, r1f1, ...]
//! - `fieldCount`: Number of fields per record (header count)
//! - `recordCount`: Number of records in this result
//! - `actualFieldCounts`: Array of actual field counts per record (for sparse records)
//!
//! Object assembly is performed on the JavaScript side, which is much faster than
//! crossing the WASM boundary repeatedly.
//!
//! ## Performance Impact
//! - 99.8%+ reduction in boundary crossings
//! - 16-31% faster overall parsing (varies by data characteristics)
//! - Larger field counts benefit more from this optimization
//!
//! # Benefits over hand-written DFA
//! - Battle-tested implementation from rust-csv (csv-core)
//! - Correct RFC 4180 compliant parsing
//! - Simpler code with fewer edge cases
//! - Better maintained

use csv_core::{ReadFieldResult, Reader, ReaderBuilder};
use js_sys::{Array, Object, Reflect};
use wasm_bindgen::prelude::*;

// Re-use FlatParseResult from parser_optimized to avoid symbol conflicts
use crate::parser_optimized::FlatParseResult;

/// Internal buffer for Rust-side data accumulation.
///
/// This struct holds parsed CSV data in Rust native format, avoiding
/// WASM↔JS boundary crossings until final result construction.
/// Used internally by `merge_with_flush` to merge results efficiently.
struct FlatBuffer {
    field_data: Vec<String>,
    actual_field_counts: Vec<usize>,
    record_count: usize,
}

impl FlatBuffer {
    fn new() -> Self {
        Self {
            field_data: Vec::new(),
            actual_field_counts: Vec::new(),
            record_count: 0,
        }
    }

    /// Merge another buffer's data into this one
    fn merge(&mut self, other: FlatBuffer) {
        self.field_data.extend(other.field_data);
        self.actual_field_counts.extend(other.actual_field_counts);
        self.record_count += other.record_count;
    }

    /// Convert to FlatParseResult for JS boundary crossing
    fn into_result(self, headers_js_cache: JsValue, field_count: usize) -> FlatParseResult {
        FlatParseResult::new(
            headers_js_cache,
            field_count,
            self.field_data,
            self.actual_field_counts,
            self.record_count,
        )
    }
}

/// CSV Parser using csv-core
///
/// This parser uses the csv-core library for parsing, providing:
/// - RFC 4180 compliant CSV parsing
/// - Proper handling of quoted fields, escapes, etc.
/// - Streaming support
#[wasm_bindgen]
pub struct CSVParser {
    /// csv-core reader
    reader: Reader,
    /// Maximum field count per record
    max_field_count: usize,

    /// Original delimiter for reset
    delimiter: u8,
    /// Original quote character for reset
    quote: u8,

    /// Current record fields (byte ranges into field_buffer)
    current_record: Vec<String>,

    /// CSV headers
    headers: Option<Vec<String>>,
    /// Whether headers have been parsed
    headers_parsed: bool,
    /// Cached JS array of headers
    headers_js_cache: JsValue,

    /// User-provided initial headers (preserved across resets)
    initial_headers: Option<Vec<String>>,
    /// Cached JS array of user-provided initial headers
    initial_headers_js_cache: JsValue,

    /// Buffer for incomplete input data
    input_buffer: Vec<u8>,
    /// Buffer for field output
    field_buffer: Vec<u8>,
    /// Buffer for partial field data (accumulates across InputEmpty calls)
    partial_field: Vec<u8>,

    /// Position tracking for error messages
    line: usize,
    byte: usize,
}

#[wasm_bindgen]
impl CSVParser {
    #[wasm_bindgen(constructor)]
    pub fn new(options: JsValue) -> Result<CSVParser, JsError> {
        let mut delimiter = b',';
        let mut quote = b'"';
        let mut max_field_count = 100000;
        let mut headers: Option<Vec<String>> = None;
        let mut headers_parsed = false;

        // Parse options
        if !options.is_undefined() && !options.is_null() {
            let obj = Object::from(options);

            if let Ok(val) = Reflect::get(&obj, &JsValue::from_str("delimiter")) {
                if let Some(s) = val.as_string() {
                    if s.len() != 1 {
                        return Err(JsError::new("delimiter must be a single character"));
                    }
                    delimiter = s.as_bytes()[0];
                }
            }

            if let Ok(val) = Reflect::get(&obj, &JsValue::from_str("quotation")) {
                if let Some(s) = val.as_string() {
                    if s.len() != 1 {
                        return Err(JsError::new("quotation must be a single character"));
                    }
                    quote = s.as_bytes()[0];
                }
            }

            if let Ok(val) = Reflect::get(&obj, &JsValue::from_str("maxFieldCount")) {
                if let Some(n) = val.as_f64() {
                    if n <= 0.0 {
                        return Err(JsError::new("maxFieldCount must be positive"));
                    }
                    max_field_count = n as usize;
                }
            }

            if let Ok(val) = Reflect::get(&obj, &JsValue::from_str("header")) {
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
        }

        // Build csv-core reader with options
        let reader = ReaderBuilder::new()
            .delimiter(delimiter)
            .quote(quote)
            .build();

        // Create headers JS cache
        let headers_js_cache = if let Some(ref h) = headers {
            let arr = Array::new();
            for header in h {
                arr.push(&JsValue::from_str(header));
            }
            arr.into()
        } else {
            JsValue::NULL
        };

        // Store initial headers for reset (only if user-provided)
        let initial_headers = headers.clone();
        let initial_headers_js_cache = headers_js_cache.clone();

        Ok(Self {
            reader,
            max_field_count,
            delimiter,
            quote,
            current_record: Vec::with_capacity(32),
            headers,
            headers_parsed,
            headers_js_cache,
            initial_headers,
            initial_headers_js_cache,
            input_buffer: Vec::new(),
            field_buffer: vec![0; 64 * 1024], // 64KB field buffer
            partial_field: Vec::new(),
            line: 1,
            byte: 0,
        })
    }

    /// Process binary CSV data in streaming mode.
    ///
    /// Call this method for each chunk of data. After all chunks are processed,
    /// call `finish()` to get remaining records and reset the parser.
    ///
    /// @param bytes - CSV binary data (Uint8Array)
    /// @returns FlatParseResult with records completed so far
    #[wasm_bindgen(js_name = processChunkBytes)]
    pub fn process_chunk_bytes(
        &mut self,
        bytes: &js_sys::Uint8Array,
    ) -> Result<FlatParseResult, JsError> {
        let chunk_len = bytes.length() as usize;
        let old_len = self.input_buffer.len();
        self.input_buffer.resize(old_len + chunk_len, 0);
        bytes.copy_to(&mut self.input_buffer[old_len..]);

        let buffer = self.process_bytes_flat_internal()?;
        Ok(buffer.into_result(
            self.headers_js_cache.clone(),
            self.headers.as_ref().map(|h| h.len()).unwrap_or(0),
        ))
    }

    /// Process string CSV data in streaming mode.
    ///
    /// Call this method for each chunk of data. After all chunks are processed,
    /// call `finish()` to get remaining records and reset the parser.
    ///
    /// @param chunk - CSV string data
    /// @returns FlatParseResult with records completed so far
    #[wasm_bindgen(js_name = processChunk)]
    pub fn process_chunk(&mut self, chunk: &str) -> Result<FlatParseResult, JsError> {
        self.input_buffer.extend_from_slice(chunk.as_bytes());
        let buffer = self.process_bytes_flat_internal()?;
        Ok(buffer.into_result(
            self.headers_js_cache.clone(),
            self.headers.as_ref().map(|h| h.len()).unwrap_or(0),
        ))
    }

    /// Finish parsing and get remaining records.
    ///
    /// Call this after processing all chunks to finalize parsing, get any
    /// remaining records, and reset the parser for reuse.
    ///
    /// @returns FlatParseResult with any remaining parsed records
    #[wasm_bindgen(js_name = finish)]
    pub fn finish(&mut self) -> Result<FlatParseResult, JsError> {
        let buffer = self.flush_internal()?;

        // Save headers before reset (reset_state clears them)
        let headers_cache = self.headers_js_cache.clone();
        let field_count = self.headers.as_ref().map(|h| h.len()).unwrap_or(0);

        self.reset_state();

        Ok(buffer.into_result(headers_cache, field_count))
    }

    /// Parse complete CSV data in one call (convenience method).
    ///
    /// Equivalent to calling `processChunk(input)` followed by `finish()`,
    /// but more efficient for one-shot parsing.
    ///
    /// @param input - Complete CSV string data
    /// @returns FlatParseResult with all parsed records
    #[wasm_bindgen(js_name = parseAll)]
    pub fn parse_all(&mut self, input: &str) -> Result<FlatParseResult, JsError> {
        self.input_buffer.extend_from_slice(input.as_bytes());
        let buffer = self.process_bytes_flat_internal()?;
        self.merge_with_flush(buffer)
    }

    /// Parse complete binary CSV data in one call (convenience method).
    ///
    /// Equivalent to calling `processChunkBytes(bytes)` followed by `finish()`,
    /// but more efficient for one-shot parsing.
    ///
    /// @param bytes - Complete CSV binary data (Uint8Array)
    /// @returns FlatParseResult with all parsed records
    #[wasm_bindgen(js_name = parseAllBytes)]
    pub fn parse_all_bytes(
        &mut self,
        bytes: &js_sys::Uint8Array,
    ) -> Result<FlatParseResult, JsError> {
        let chunk_len = bytes.length() as usize;
        let old_len = self.input_buffer.len();
        self.input_buffer.resize(old_len + chunk_len, 0);
        bytes.copy_to(&mut self.input_buffer[old_len..]);

        let buffer = self.process_bytes_flat_internal()?;
        self.merge_with_flush(buffer)
    }
}

impl CSVParser {
    /// Merge process result with flush result efficiently using internal FlatBuffer.
    ///
    /// This method avoids unnecessary WASM↔JS boundary crossings by:
    /// 1. Using `flush_internal()` which returns Rust-native `FlatBuffer`
    /// 2. Merging data entirely in Rust
    /// 3. Only crossing the boundary once when creating the final `FlatParseResult`
    fn merge_with_flush(&mut self, first: FlatBuffer) -> Result<FlatParseResult, JsError> {
        let flush_buffer = self.flush_internal()?;

        // Merge entirely in Rust - no JS boundary crossings
        let mut merged = first;
        merged.merge(flush_buffer);

        // Save headers before reset (reset_state clears them)
        let headers_cache = self.headers_js_cache.clone();
        let field_count = self.headers.as_ref().map(|h| h.len()).unwrap_or(0);

        self.reset_state();

        // Single boundary crossing: Rust Vec → JS Array
        Ok(merged.into_result(headers_cache, field_count))
    }

    /// Internal flush that returns FlatBuffer (Rust-native format).
    /// Used by `merge_with_flush` to avoid unnecessary boundary crossings.
    fn flush_internal(&mut self) -> Result<FlatBuffer, JsError> {
        let mut buffer = FlatBuffer::new();

        // Process remaining input
        if !self.input_buffer.is_empty() {
            let result = self.process_bytes_flat_internal()?;
            buffer.merge(result);
        }

        // Signal EOF to csv-core by calling with empty input
        loop {
            let (result, _nin, nout) = self.reader.read_field(&[], &mut self.field_buffer);

            match result {
                ReadFieldResult::InputEmpty => {
                    break;
                }
                ReadFieldResult::Field { record_end } => {
                    self.accumulate_field_output(nout);
                    let field_str = self.take_partial_field_as_string()?;
                    self.current_record.push(field_str);

                    if record_end {
                        self.finish_record_to_buffer(&mut buffer);
                    }
                }
                ReadFieldResult::End => {
                    if nout > 0 {
                        self.accumulate_field_output(nout);
                        let field_str = self.take_partial_field_as_string()?;
                        self.current_record.push(field_str);
                    }
                    break;
                }
                ReadFieldResult::OutputFull => {
                    self.accumulate_field_output(nout);
                    self.grow_field_buffer();
                    continue;
                }
            }
        }

        // Finish any partial record
        if !self.current_record.is_empty() {
            self.finish_record_to_buffer(&mut buffer);
        }

        Ok(buffer)
    }

    /// Internal process_bytes that returns FlatBuffer (Rust-native format).
    fn process_bytes_flat_internal(&mut self) -> Result<FlatBuffer, JsError> {
        let mut buffer = FlatBuffer::new();
        let mut input_pos = 0;

        while input_pos < self.input_buffer.len() {
            let input = &self.input_buffer[input_pos..];

            let (result, nin, nout) = self.reader.read_field(input, &mut self.field_buffer);

            match result {
                ReadFieldResult::InputEmpty => {
                    if nout > 0 {
                        self.accumulate_field_output(nout);
                    }
                    input_pos += nin;
                    break;
                }
                ReadFieldResult::OutputFull => {
                    self.accumulate_field_output(nout);

                    for &b in &self.input_buffer[input_pos..input_pos + nin] {
                        if b == b'\n' {
                            self.line += 1;
                        }
                    }

                    input_pos += nin;
                    self.byte += nin;
                    self.grow_field_buffer();
                    continue;
                }
                ReadFieldResult::Field { record_end } => {
                    self.accumulate_field_output(nout);
                    let field_str = self.take_partial_field_as_string()?;

                    if self.current_record.len() >= self.max_field_count {
                        return Err(JsError::new(&format!(
                            "Field count limit exceeded at line {}: maximum {} fields allowed",
                            self.line, self.max_field_count
                        )));
                    }

                    self.current_record.push(field_str);
                    input_pos += nin;
                    self.byte += nin;

                    for &b in &self.input_buffer[input_pos - nin..input_pos] {
                        if b == b'\n' {
                            self.line += 1;
                        }
                    }

                    if record_end {
                        self.finish_record_to_buffer(&mut buffer);
                    }
                }
                ReadFieldResult::End => {
                    input_pos += nin;
                    break;
                }
            }
        }

        self.input_buffer.drain(..input_pos);
        Ok(buffer)
    }

    /// Take partial_field and convert to UTF-8 string (avoids clone)
    fn take_partial_field_as_string(&mut self) -> Result<String, JsError> {
        let bytes = std::mem::take(&mut self.partial_field);
        String::from_utf8(bytes).map_err(|e| {
            JsError::new(&format!(
                "Invalid UTF-8 at line {}:{}: {}",
                self.line, self.byte, e
            ))
        })
    }

    /// Accumulate field output to partial_field buffer
    #[inline]
    fn accumulate_field_output(&mut self, nout: usize) {
        self.partial_field
            .extend_from_slice(&self.field_buffer[..nout]);
    }

    /// Double the field buffer size when OutputFull is encountered
    #[inline]
    fn grow_field_buffer(&mut self) {
        let new_size = self.field_buffer.len() * 2;
        self.field_buffer.resize(new_size, 0);
    }

    /// Finish record to FlatBuffer (internal Rust-native format)
    fn finish_record_to_buffer(&mut self, buffer: &mut FlatBuffer) {
        if self.current_record.is_empty() && !self.headers_parsed {
            return;
        }

        if !self.headers_parsed {
            let headers: Vec<String> = self.current_record.drain(..).collect();
            let arr = Array::new();
            for header in &headers {
                arr.push(&JsValue::from_str(header));
            }
            self.headers_js_cache = arr.into();
            self.headers = Some(headers);
            self.headers_parsed = true;
        } else if let Some(ref headers) = self.headers {
            let actual_count = self.current_record.len();
            buffer.actual_field_counts.push(actual_count);

            let header_len = headers.len();
            let record_len = self.current_record.len();

            // Move existing fields
            buffer
                .field_data
                .extend(self.current_record.drain(..record_len.min(header_len)));

            // Fill missing fields with empty strings
            for _ in record_len..header_len {
                buffer.field_data.push(String::new());
            }

            buffer.record_count += 1;
            self.current_record.clear();
        } else {
            self.current_record.clear();
        }
    }

    /// Reset parser state for reuse
    /// Note: This resets the reader to allow parsing a new CSV from scratch.
    /// The parser instance can be reused after calling flush().
    fn reset_state(&mut self) {
        // Reset csv-core reader to initial state with original options
        self.reader = ReaderBuilder::new()
            .delimiter(self.delimiter)
            .quote(self.quote)
            .build();

        // Clear all buffers and state
        self.current_record.clear();
        self.input_buffer.clear();
        self.partial_field.clear();

        // Restore headers from initial state (preserves user-provided headers)
        // If user provided headers via options, restore them; otherwise clear
        if self.initial_headers.is_some() {
            self.headers = self.initial_headers.clone();
            self.headers_parsed = true;
            self.headers_js_cache = self.initial_headers_js_cache.clone();
        } else {
            self.headers = None;
            self.headers_parsed = false;
            self.headers_js_cache = JsValue::NULL;
        }

        // Reset position tracking
        self.line = 1;
        self.byte = 0;
    }
}

#[cfg(test)]
mod tests {
    use csv_core::{ReadFieldResult, ReaderBuilder};

    // ========== Test Helpers ==========

    /// Parse CSV input to a flat list of fields (no record boundaries)
    fn parse_csv_to_fields(input: &[u8]) -> Vec<String> {
        let mut reader = ReaderBuilder::new().build();
        let mut field_buffer = vec![0u8; 64 * 1024];
        let mut partial_field: Vec<u8> = Vec::new();
        let mut fields: Vec<String> = Vec::new();
        let mut input_pos = 0;

        // Process input
        while input_pos < input.len() {
            let (result, nin, nout) = reader.read_field(&input[input_pos..], &mut field_buffer);

            match result {
                ReadFieldResult::InputEmpty => {
                    if nout > 0 {
                        partial_field.extend_from_slice(&field_buffer[..nout]);
                    }
                    break;
                }
                ReadFieldResult::OutputFull => {
                    partial_field.extend_from_slice(&field_buffer[..nout]);
                    input_pos += nin;
                    let new_size = field_buffer.len() * 2;
                    field_buffer.resize(new_size, 0);
                    continue;
                }
                ReadFieldResult::Field { record_end: _ } => {
                    partial_field.extend_from_slice(&field_buffer[..nout]);
                    let field = String::from_utf8(std::mem::take(&mut partial_field)).unwrap();
                    fields.push(field);
                    input_pos += nin;
                }
                ReadFieldResult::End => {
                    if nout > 0 {
                        partial_field.extend_from_slice(&field_buffer[..nout]);
                        let field = String::from_utf8(std::mem::take(&mut partial_field)).unwrap();
                        fields.push(field);
                    }
                    break;
                }
            }
        }

        // Signal EOF
        loop {
            let (result, _nin, nout) = reader.read_field(&[], &mut field_buffer);
            match result {
                ReadFieldResult::InputEmpty => break,
                ReadFieldResult::Field { record_end: _ } => {
                    partial_field.extend_from_slice(&field_buffer[..nout]);
                    let field = String::from_utf8(std::mem::take(&mut partial_field)).unwrap();
                    fields.push(field);
                }
                ReadFieldResult::End => {
                    if nout > 0 {
                        partial_field.extend_from_slice(&field_buffer[..nout]);
                        let field = String::from_utf8(std::mem::take(&mut partial_field)).unwrap();
                        fields.push(field);
                    }
                    break;
                }
                ReadFieldResult::OutputFull => {
                    partial_field.extend_from_slice(&field_buffer[..nout]);
                    let new_size = field_buffer.len() * 2;
                    field_buffer.resize(new_size, 0);
                    continue;
                }
            }
        }

        fields
    }

    /// Parse CSV input to a list of records (with record boundaries)
    fn parse_csv_to_records(input: &[u8]) -> Vec<Vec<String>> {
        let mut reader = ReaderBuilder::new().build();
        let mut field_buffer = vec![0u8; 64 * 1024];
        let mut partial_field: Vec<u8> = Vec::new();
        let mut current_record: Vec<String> = Vec::new();
        let mut all_records: Vec<Vec<String>> = Vec::new();
        let mut input_pos = 0;

        // Process input
        while input_pos < input.len() {
            let (result, nin, nout) = reader.read_field(&input[input_pos..], &mut field_buffer);

            match result {
                ReadFieldResult::InputEmpty => {
                    if nout > 0 {
                        partial_field.extend_from_slice(&field_buffer[..nout]);
                    }
                    break;
                }
                ReadFieldResult::OutputFull => {
                    partial_field.extend_from_slice(&field_buffer[..nout]);
                    input_pos += nin;
                    let new_size = field_buffer.len() * 2;
                    field_buffer.resize(new_size, 0);
                    continue;
                }
                ReadFieldResult::Field { record_end } => {
                    partial_field.extend_from_slice(&field_buffer[..nout]);
                    let field = String::from_utf8(std::mem::take(&mut partial_field)).unwrap();
                    current_record.push(field);
                    input_pos += nin;

                    if record_end {
                        all_records.push(std::mem::take(&mut current_record));
                    }
                }
                ReadFieldResult::End => {
                    if nout > 0 {
                        partial_field.extend_from_slice(&field_buffer[..nout]);
                        let field = String::from_utf8(std::mem::take(&mut partial_field)).unwrap();
                        current_record.push(field);
                    }
                    break;
                }
            }
        }

        // Signal EOF
        loop {
            let (result, _nin, nout) = reader.read_field(&[], &mut field_buffer);
            match result {
                ReadFieldResult::InputEmpty => break,
                ReadFieldResult::Field { record_end } => {
                    partial_field.extend_from_slice(&field_buffer[..nout]);
                    let field = String::from_utf8(std::mem::take(&mut partial_field)).unwrap();
                    current_record.push(field);

                    if record_end {
                        all_records.push(std::mem::take(&mut current_record));
                    }
                }
                ReadFieldResult::End => {
                    if nout > 0 {
                        partial_field.extend_from_slice(&field_buffer[..nout]);
                        let field = String::from_utf8(std::mem::take(&mut partial_field)).unwrap();
                        current_record.push(field);
                    }
                    break;
                }
                ReadFieldResult::OutputFull => {
                    partial_field.extend_from_slice(&field_buffer[..nout]);
                    let new_size = field_buffer.len() * 2;
                    field_buffer.resize(new_size, 0);
                    continue;
                }
            }
        }

        // Don't forget any remaining record
        if !current_record.is_empty() {
            all_records.push(current_record);
        }

        all_records
    }

    // ========== Tests ==========

    /// Test csv-core directly to verify quoting behavior
    #[test]
    fn test_csv_core_quoting() {
        let fields = parse_csv_to_fields(b"Alice,\"test value\"\n");

        assert_eq!(fields.len(), 2, "Expected 2 fields, got {:?}", fields);
        assert_eq!(fields[0], "Alice");
        assert_eq!(
            fields[1], "test value",
            "Expected 'test value', got '{}'",
            fields[1]
        );
    }

    /// Test csv-core with partial field accumulation (mimics CSVParser behavior)
    #[test]
    fn test_csv_core_partial_field_accumulation() {
        let all_records = parse_csv_to_records(b"header,value\nAlice,\"test value\"\n");

        assert_eq!(
            all_records.len(),
            2,
            "Expected 2 records, got {:?}",
            all_records
        );
        assert_eq!(all_records[0], vec!["header", "value"]);
        assert_eq!(all_records[1][0], "Alice");
        assert_eq!(
            all_records[1][1], "test value",
            "Expected 'test value', got '{}'",
            all_records[1][1]
        );
    }

    /// Test csv-core handles escaped quotes correctly
    #[test]
    fn test_csv_core_escaped_quotes() {
        // Test 1: "" (empty quoted field)
        let fields1 = parse_csv_to_fields(b"\"\"");
        assert_eq!(fields1.len(), 1);
        assert_eq!(
            fields1[0], "",
            "\"\" should be empty string, got '{}'",
            fields1[0]
        );

        // Test 2: """" with newline (should complete the field)
        let fields2 = parse_csv_to_fields(b"\"\"\"\"\n");
        assert_eq!(fields2.len(), 1);
        assert_eq!(
            fields2[0], "\"",
            "\"\"\"\"\\n should be single quote, got '{}'",
            fields2[0]
        );

        // Test 3: """""" with newline
        let fields3 = parse_csv_to_fields(b"\"\"\"\"\"\"\n");
        assert_eq!(fields3.len(), 1);
        assert_eq!(
            fields3[0], "\"\"",
            "\"\"\"\"\"\"\\n should be two quotes, got '{}'",
            fields3[0]
        );
    }

    /// Test parsing fields larger than the initial 64KB buffer
    /// This tests the OutputFull handling path
    #[test]
    fn test_large_field_over_64kb() {
        // Create a field larger than 64KB (initial buffer size)
        let large_content = "x".repeat(100_000); // 100KB
        let csv_input = format!("header\n\"{}\"\n", large_content);

        let fields = parse_csv_to_fields(csv_input.as_bytes());

        assert_eq!(
            fields.len(),
            2,
            "Expected 2 fields (header + data), got {:?}",
            fields.len()
        );
        assert_eq!(fields[0], "header");
        assert_eq!(
            fields[1].len(),
            100_000,
            "Large field should be 100KB, got {} bytes",
            fields[1].len()
        );
        assert_eq!(fields[1], large_content, "Large field content mismatch");
    }

    /// Test parsing multiple large fields in sequence
    #[test]
    fn test_multiple_large_fields() {
        let large1 = "a".repeat(70_000); // 70KB
        let large2 = "b".repeat(80_000); // 80KB
        let csv_input = format!("col1,col2\n\"{}\",\"{}\"\n", large1, large2);

        let fields = parse_csv_to_fields(csv_input.as_bytes());

        assert_eq!(fields.len(), 4, "Expected 4 fields, got {}", fields.len());
        assert_eq!(fields[0], "col1");
        assert_eq!(fields[1], "col2");
        assert_eq!(fields[2].len(), 70_000, "First large field should be 70KB");
        assert_eq!(fields[3].len(), 80_000, "Second large field should be 80KB");
    }
}
