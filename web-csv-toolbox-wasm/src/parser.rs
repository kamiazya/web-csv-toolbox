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

/// Helper to create FlatParseResult (same logic as parser_optimized)
fn create_flat_result(
    headers_js_cache: JsValue,
    field_count: usize,
    field_data: Vec<String>,
    actual_field_counts: Vec<usize>,
    record_count: usize,
) -> FlatParseResult {
    FlatParseResult::new(
        headers_js_cache,
        field_count,
        field_data,
        actual_field_counts,
        record_count,
    )
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

    /// Process binary CSV data and return flat format for efficient WASM↔JS transfer.
    ///
    /// This is the primary parsing method. Returns a flat data structure that minimizes
    /// WASM↔JS boundary crossings. See module documentation for design rationale.
    ///
    /// @param bytes - CSV binary data (Uint8Array)
    /// @param stream - If true, expects more data (streaming mode). If false/omitted, auto-flushes.
    /// @returns FlatParseResult with headers, fieldData, fieldCount, recordCount, actualFieldCounts
    #[wasm_bindgen(js_name = processChunkBytes)]
    pub fn process_chunk_bytes(
        &mut self,
        bytes: &js_sys::Uint8Array,
        stream: Option<bool>,
    ) -> Result<FlatParseResult, JsError> {
        let chunk_len = bytes.length() as usize;
        let old_len = self.input_buffer.len();
        self.input_buffer.resize(old_len + chunk_len, 0);
        bytes.copy_to(&mut self.input_buffer[old_len..]);

        let result = self.process_bytes_flat()?;

        // If not streaming, flush remaining data and merge
        if !stream.unwrap_or(false) {
            self.merge_with_flush(result)
        } else {
            Ok(result)
        }
    }

    /// Process string CSV data and return flat format for efficient WASM↔JS transfer.
    ///
    /// This is a convenience method that accepts string input directly.
    /// Internally converts to bytes and delegates to process_chunk_bytes.
    ///
    /// @param chunk - CSV string data
    /// @param stream - If true, expects more data (streaming mode). If false/omitted, auto-flushes.
    /// @returns FlatParseResult with headers, fieldData, fieldCount, recordCount, actualFieldCounts
    #[wasm_bindgen(js_name = processChunk)]
    pub fn process_chunk(&mut self, chunk: &str, stream: Option<bool>) -> Result<FlatParseResult, JsError> {
        self.input_buffer.extend_from_slice(chunk.as_bytes());
        let result = self.process_bytes_flat()?;

        // If not streaming, flush remaining data and merge
        if !stream.unwrap_or(false) {
            self.merge_with_flush(result)
        } else {
            Ok(result)
        }
    }

    /// Flush remaining data and return flat format.
    ///
    /// Call this after processing all chunks in streaming mode to get any
    /// remaining records. Returns the same flat format as processChunkBytes.
    ///
    /// @returns FlatParseResult with any remaining parsed records
    #[wasm_bindgen(js_name = flush)]
    pub fn flush(&mut self) -> Result<FlatParseResult, JsError> {
        let mut field_data = Vec::new();
        let mut actual_field_counts = Vec::new();
        let mut record_count = 0;

        // Process remaining input
        if !self.input_buffer.is_empty() {
            let result = self.process_bytes_flat()?;
            // Merge results (use getter methods for private fields)
            record_count = result.record_count();
            // Extract field data from JsValue array
            let arr = Array::from(&result.field_data());
            for i in 0..arr.length() {
                if let Some(s) = arr.get(i).as_string() {
                    field_data.push(s);
                } else {
                    field_data.push(String::new());
                }
            }
            let counts_arr = Array::from(&result.actual_field_counts());
            for i in 0..counts_arr.length() {
                if let Some(n) = counts_arr.get(i).as_f64() {
                    actual_field_counts.push(n as usize);
                }
            }
        }

        // Signal EOF to csv-core by calling with empty input
        // This allows csv-core to finish processing any partial quoted fields
        // Loop until End or InputEmpty - no arbitrary iteration limit
        loop {
            let (result, _nin, nout) = self.reader.read_field(&[], &mut self.field_buffer);

            match result {
                ReadFieldResult::InputEmpty => {
                    break;
                }
                ReadFieldResult::Field { record_end } => {
                    // csv-core returned a final field
                    self.partial_field
                        .extend_from_slice(&self.field_buffer[..nout]);
                    let field_str = self.take_partial_field_as_string()?;
                    self.current_record.push(field_str);

                    if record_end {
                        self.finish_record_to_flat(
                            &mut field_data,
                            &mut actual_field_counts,
                            &mut record_count,
                        );
                    }
                }
                ReadFieldResult::End => {
                    // Handle any remaining partial field
                    if nout > 0 {
                        self.partial_field
                            .extend_from_slice(&self.field_buffer[..nout]);
                        let field_str = self.take_partial_field_as_string()?;
                        self.current_record.push(field_str);
                    }
                    break;
                }
                ReadFieldResult::OutputFull => {
                    // Save partial output before resizing
                    self.partial_field
                        .extend_from_slice(&self.field_buffer[..nout]);
                    let new_size = self.field_buffer.len() * 2;
                    self.field_buffer.resize(new_size, 0);
                    continue;
                }
            }
        }

        // Finish any partial record
        if !self.current_record.is_empty() {
            self.finish_record_to_flat(
                &mut field_data,
                &mut actual_field_counts,
                &mut record_count,
            );
        }

        // Save headers before reset (reset_state clears them)
        let headers_cache = self.headers_js_cache.clone();
        let field_count = self.headers.as_ref().map(|h| h.len()).unwrap_or(0);

        self.reset_state();

        Ok(create_flat_result(
            headers_cache,
            field_count,
            field_data,
            actual_field_counts,
            record_count,
        ))
    }
}

impl CSVParser {
    /// Merge process result with flush result for flat format
    fn merge_with_flush(&mut self, first: FlatParseResult) -> Result<FlatParseResult, JsError> {
        let flush_result = self.flush()?;

        // Extract data from first result
        let headers = first.headers();
        let field_count = first.field_count();
        let first_record_count = first.record_count();

        // Extract field data from both results
        let mut merged_field_data = Vec::new();
        let mut merged_actual_counts = Vec::new();

        // Add first result's data
        let first_fields = Array::from(&first.field_data());
        for i in 0..first_fields.length() {
            if let Some(s) = first_fields.get(i).as_string() {
                merged_field_data.push(s);
            } else {
                merged_field_data.push(String::new());
            }
        }
        let first_counts = Array::from(&first.actual_field_counts());
        for i in 0..first_counts.length() {
            if let Some(n) = first_counts.get(i).as_f64() {
                merged_actual_counts.push(n as usize);
            }
        }

        // Add flush result's data
        let flush_fields = Array::from(&flush_result.field_data());
        for i in 0..flush_fields.length() {
            if let Some(s) = flush_fields.get(i).as_string() {
                merged_field_data.push(s);
            } else {
                merged_field_data.push(String::new());
            }
        }
        let flush_counts = Array::from(&flush_result.actual_field_counts());
        for i in 0..flush_counts.length() {
            if let Some(n) = flush_counts.get(i).as_f64() {
                merged_actual_counts.push(n as usize);
            }
        }

        let total_record_count = first_record_count + flush_result.record_count();

        // Use headers from first result, or from flush if first had none
        let final_headers = if !headers.is_null() {
            headers
        } else {
            flush_result.headers()
        };

        let final_field_count = if field_count > 0 {
            field_count
        } else {
            flush_result.field_count()
        };

        Ok(create_flat_result(
            final_headers,
            final_field_count,
            merged_field_data,
            merged_actual_counts,
            total_record_count,
        ))
    }

    /// Process bytes and return flat format
    fn process_bytes_flat(&mut self) -> Result<FlatParseResult, JsError> {
        let mut field_data = Vec::new();
        let mut actual_field_counts = Vec::new();
        let mut record_count = 0;
        let mut input_pos = 0;

        while input_pos < self.input_buffer.len() {
            let input = &self.input_buffer[input_pos..];

            let (result, nin, nout) =
                self.reader.read_field(input, &mut self.field_buffer);

            match result {
                ReadFieldResult::InputEmpty => {
                    // Accumulate partial field output (already processed/unquoted by csv-core)
                    if nout > 0 {
                        self.partial_field
                            .extend_from_slice(&self.field_buffer[..nout]);
                    }
                    input_pos += nin;
                    break;
                }
                ReadFieldResult::OutputFull => {
                    // Field too large - save partial output, advance position, grow buffer and retry
                    self.partial_field
                        .extend_from_slice(&self.field_buffer[..nout]);

                    // Count newlines in consumed input for accurate line tracking
                    for &b in &self.input_buffer[input_pos..input_pos + nin] {
                        if b == b'\n' {
                            self.line += 1;
                        }
                    }

                    input_pos += nin;
                    self.byte += nin;
                    let new_size = self.field_buffer.len() * 2;
                    self.field_buffer.resize(new_size, 0);
                    continue;
                }
                ReadFieldResult::Field { record_end } => {
                    // Combine partial field data with current output
                    self.partial_field
                        .extend_from_slice(&self.field_buffer[..nout]);
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
                        self.finish_record_to_flat(
                            &mut field_data,
                            &mut actual_field_counts,
                            &mut record_count,
                        );
                    }
                }
                ReadFieldResult::End => {
                    input_pos += nin;
                    break;
                }
            }
        }

        self.input_buffer.drain(..input_pos);

        Ok(create_flat_result(
            self.headers_js_cache.clone(),
            self.headers.as_ref().map(|h| h.len()).unwrap_or(0),
            field_data,
            actual_field_counts,
            record_count,
        ))
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

    /// Finish record to flat format
    fn finish_record_to_flat(
        &mut self,
        field_data: &mut Vec<String>,
        actual_field_counts: &mut Vec<usize>,
        record_count: &mut usize,
    ) {
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
        } else {
            if let Some(ref headers) = self.headers {
                let actual_count = self.current_record.len();
                actual_field_counts.push(actual_count);

                // Use drain to move ownership instead of clone
                let header_len = headers.len();
                let record_len = self.current_record.len();

                // Move existing fields
                field_data.extend(self.current_record.drain(..record_len.min(header_len)));

                // Fill missing fields with empty strings
                for _ in record_len..header_len {
                    field_data.push(String::new());
                }

                *record_count += 1;
                self.current_record.clear();
            } else {
                self.current_record.clear();
            }
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

    /// Test csv-core directly to verify quoting behavior
    #[test]
    fn test_csv_core_quoting() {
        let input = b"Alice,\"test value\"\n";
        let mut reader = ReaderBuilder::new().build();
        let mut output = [0u8; 1024];

        let mut fields = Vec::new();
        let mut input_pos = 0;

        loop {
            let (result, nin, nout) = reader.read_field(&input[input_pos..], &mut output);
            input_pos += nin;

            match result {
                ReadFieldResult::InputEmpty => {
                    break;
                }
                ReadFieldResult::Field { record_end: _ } => {
                    let field = std::str::from_utf8(&output[..nout]).unwrap();
                    fields.push(field.to_string());
                }
                ReadFieldResult::End => {
                    if nout > 0 {
                        let field = std::str::from_utf8(&output[..nout]).unwrap();
                        fields.push(field.to_string());
                    }
                    break;
                }
                ReadFieldResult::OutputFull => {
                    panic!("Output buffer too small");
                }
            }
        }

        // Signal EOF
        loop {
            let (result, _nin, nout) = reader.read_field(&[], &mut output);
            match result {
                ReadFieldResult::InputEmpty => break,
                ReadFieldResult::Field { record_end: _ } => {
                    let field = std::str::from_utf8(&output[..nout]).unwrap();
                    fields.push(field.to_string());
                }
                ReadFieldResult::End => {
                    if nout > 0 {
                        let field = std::str::from_utf8(&output[..nout]).unwrap();
                        fields.push(field.to_string());
                    }
                    break;
                }
                ReadFieldResult::OutputFull => break,
            }
        }

        assert_eq!(fields.len(), 2, "Expected 2 fields, got {:?}", fields);
        assert_eq!(fields[0], "Alice");
        assert_eq!(fields[1], "test value", "Expected 'test value', got '{}'", fields[1]);
    }

    /// Test csv-core with partial field accumulation (mimics CSVParser behavior)
    #[test]
    fn test_csv_core_partial_field_accumulation() {
        let input = b"header,value\nAlice,\"test value\"\n";
        let mut reader = ReaderBuilder::new().build();
        let mut field_buffer = vec![0u8; 64 * 1024];
        let mut partial_field: Vec<u8> = Vec::new();
        let mut current_record: Vec<String> = Vec::new();
        let mut all_records: Vec<Vec<String>> = Vec::new();

        let mut input_pos = 0;

        while input_pos < input.len() {
            let (result, nin, nout) = reader.read_field(&input[input_pos..], &mut field_buffer);

            match result {
                ReadFieldResult::InputEmpty => {
                    if nout > 0 {
                        partial_field.extend_from_slice(&field_buffer[..nout]);
                    }
                    input_pos += nin;
                    break;
                }
                ReadFieldResult::Field { record_end } => {
                    partial_field.extend_from_slice(&field_buffer[..nout]);
                    let field_str = std::str::from_utf8(&partial_field).unwrap().to_string();
                    partial_field.clear();
                    current_record.push(field_str);
                    input_pos += nin;

                    if record_end {
                        all_records.push(current_record.clone());
                        current_record.clear();
                    }
                }
                ReadFieldResult::End => {
                    input_pos += nin;
                    break;
                }
                ReadFieldResult::OutputFull => {
                    panic!("Output buffer too small");
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
                    let field_str = std::str::from_utf8(&partial_field).unwrap().to_string();
                    partial_field.clear();
                    current_record.push(field_str);

                    if record_end {
                        all_records.push(current_record.clone());
                        current_record.clear();
                    }
                }
                ReadFieldResult::End => {
                    if nout > 0 {
                        partial_field.extend_from_slice(&field_buffer[..nout]);
                        let field_str = std::str::from_utf8(&partial_field).unwrap().to_string();
                        partial_field.clear();
                        current_record.push(field_str);
                    }
                    break;
                }
                ReadFieldResult::OutputFull => break,
            }
        }

        assert_eq!(all_records.len(), 2, "Expected 2 records, got {:?}", all_records);
        assert_eq!(all_records[0], vec!["header", "value"]);
        assert_eq!(all_records[1][0], "Alice");
        assert_eq!(all_records[1][1], "test value", "Expected 'test value', got '{}'", all_records[1][1]);
    }

    /// Test csv-core handles escaped quotes correctly
    #[test]
    fn test_csv_core_escaped_quotes() {
        // Test with full field parsing loop like in CSVParser
        fn parse_single_field(input: &[u8]) -> String {
            let mut reader = ReaderBuilder::new().build();
            let mut output = [0u8; 1024];
            let mut partial = Vec::new();
            let mut input_pos = 0;

            // Process input
            while input_pos < input.len() {
                let (result, nin, nout) = reader.read_field(&input[input_pos..], &mut output);
                eprintln!("  input[{}..]: {:?}, result={:?}, nin={}, nout={}",
                    input_pos, std::str::from_utf8(&input[input_pos..]).unwrap(), result, nin, nout);
                input_pos += nin;

                match result {
                    ReadFieldResult::InputEmpty => {
                        if nout > 0 {
                            partial.extend_from_slice(&output[..nout]);
                        }
                        break;
                    }
                    ReadFieldResult::Field { .. } => {
                        partial.extend_from_slice(&output[..nout]);
                        return String::from_utf8(partial).unwrap();
                    }
                    ReadFieldResult::End => {
                        if nout > 0 {
                            partial.extend_from_slice(&output[..nout]);
                        }
                        return String::from_utf8(partial).unwrap();
                    }
                    ReadFieldResult::OutputFull => panic!("Output buffer too small"),
                }
            }

            // Signal EOF
            loop {
                let (result, _nin, nout) = reader.read_field(&[], &mut output);
                eprintln!("  EOF: result={:?}, nout={}", result, nout);

                match result {
                    ReadFieldResult::InputEmpty => break,
                    ReadFieldResult::Field { .. } => {
                        partial.extend_from_slice(&output[..nout]);
                        return String::from_utf8(partial).unwrap();
                    }
                    ReadFieldResult::End => {
                        if nout > 0 {
                            partial.extend_from_slice(&output[..nout]);
                        }
                        return String::from_utf8(partial).unwrap();
                    }
                    ReadFieldResult::OutputFull => break,
                }
            }

            String::from_utf8(partial).unwrap()
        }

        // Test 1: "" (empty quoted field)
        eprintln!("Test 1: \"\" (empty quoted field)");
        let result1 = parse_single_field(b"\"\"");
        assert_eq!(result1, "", "\"\" should be empty string, got '{}'", result1);

        // Test 2: """" with newline (should complete the field)
        eprintln!("\nTest 2: \"\"\"\"\\n (4 quotes + newline)");
        let result2 = parse_single_field(b"\"\"\"\"\n");
        assert_eq!(result2, "\"", "\"\"\"\"\\n should be single quote, got '{}'", result2);

        // Test 3: """""" with newline
        eprintln!("\nTest 3: \"\"\"\"\"\"\\n (6 quotes + newline)");
        let result3 = parse_single_field(b"\"\"\"\"\"\"\n");
        assert_eq!(result3, "\"\"", "\"\"\"\"\"\"\\n should be two quotes, got '{}'", result3);
    }

    /// Test parsing fields larger than the initial 64KB buffer
    /// This tests the OutputFull handling path
    #[test]
    fn test_large_field_over_64kb() {
        // Create a field larger than 64KB (initial buffer size)
        let large_content = "x".repeat(100_000); // 100KB
        let csv_input = format!("header\n\"{}\"\n", large_content);

        let mut reader = ReaderBuilder::new().build();
        let mut field_buffer = vec![0u8; 64 * 1024]; // Start with 64KB like CSVParser
        let mut partial_field: Vec<u8> = Vec::new();
        let mut fields: Vec<String> = Vec::new();
        let mut input_pos = 0;
        let input = csv_input.as_bytes();

        // Process input
        while input_pos < input.len() {
            let (result, nin, nout) = reader.read_field(&input[input_pos..], &mut field_buffer);

            match result {
                ReadFieldResult::InputEmpty => {
                    if nout > 0 {
                        partial_field.extend_from_slice(&field_buffer[..nout]);
                    }
                    input_pos += nin;
                    break;
                }
                ReadFieldResult::OutputFull => {
                    // This is the key path being tested: save partial output and grow buffer
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
                    input_pos += nin;
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

        assert_eq!(fields.len(), 2, "Expected 2 fields (header + data), got {:?}", fields.len());
        assert_eq!(fields[0], "header");
        assert_eq!(fields[1].len(), 100_000, "Large field should be 100KB, got {} bytes", fields[1].len());
        assert_eq!(fields[1], large_content, "Large field content mismatch");
    }

    /// Test parsing multiple large fields in sequence
    #[test]
    fn test_multiple_large_fields() {
        let large1 = "a".repeat(70_000); // 70KB
        let large2 = "b".repeat(80_000); // 80KB
        let csv_input = format!("col1,col2\n\"{}\",\"{}\"\n", large1, large2);

        let mut reader = ReaderBuilder::new().build();
        let mut field_buffer = vec![0u8; 64 * 1024];
        let mut partial_field: Vec<u8> = Vec::new();
        let mut fields: Vec<String> = Vec::new();
        let mut input_pos = 0;
        let input = csv_input.as_bytes();

        while input_pos < input.len() {
            let (result, nin, nout) = reader.read_field(&input[input_pos..], &mut field_buffer);

            match result {
                ReadFieldResult::InputEmpty => {
                    if nout > 0 {
                        partial_field.extend_from_slice(&field_buffer[..nout]);
                    }
                    input_pos += nin;
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
                    input_pos += nin;
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

        assert_eq!(fields.len(), 4, "Expected 4 fields, got {}", fields.len());
        assert_eq!(fields[0], "col1");
        assert_eq!(fields[1], "col2");
        assert_eq!(fields[2].len(), 70_000, "First large field should be 70KB");
        assert_eq!(fields[3].len(), 80_000, "Second large field should be 80KB");
    }
}
