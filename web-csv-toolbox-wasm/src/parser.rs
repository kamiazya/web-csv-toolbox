//! CSV Parser using csv-core library
//!
//! This module implements high-performance CSV parsing using the csv-core library
//! from BurntSushi's rust-csv project. csv-core provides a zero-allocation,
//! streaming CSV parser.
//!
//! Benefits over hand-written DFA:
//! - Battle-tested implementation from rust-csv
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

    /// Current record fields (byte ranges into field_buffer)
    current_record: Vec<String>,

    /// CSV headers
    headers: Option<Vec<String>>,
    /// Whether headers have been parsed
    headers_parsed: bool,
    /// Cached JS array of headers
    headers_js_cache: JsValue,

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

        Ok(Self {
            reader,
            max_field_count,
            current_record: Vec::with_capacity(32),
            headers,
            headers_parsed,
            headers_js_cache,
            input_buffer: Vec::new(),
            field_buffer: vec![0; 64 * 1024], // 64KB field buffer
            partial_field: Vec::new(),
            line: 1,
            byte: 0,
        })
    }

    /// Process a chunk of binary CSV data
    #[wasm_bindgen(js_name = processChunkBytes)]
    pub fn process_chunk_bytes(&mut self, bytes: &js_sys::Uint8Array) -> Result<JsValue, JsError> {
        let chunk_len = bytes.length() as usize;
        let old_len = self.input_buffer.len();
        self.input_buffer.resize(old_len + chunk_len, 0);
        bytes.copy_to(&mut self.input_buffer[old_len..]);

        self.process_bytes_to_objects()
    }

    /// Process bytes and return truly flat format
    #[wasm_bindgen(js_name = processChunkBytesTrulyFlat)]
    pub fn process_chunk_bytes_truly_flat(
        &mut self,
        bytes: &js_sys::Uint8Array,
    ) -> Result<FlatParseResult, JsError> {
        let chunk_len = bytes.length() as usize;
        let old_len = self.input_buffer.len();
        self.input_buffer.resize(old_len + chunk_len, 0);
        bytes.copy_to(&mut self.input_buffer[old_len..]);

        self.process_bytes_flat()
    }

    /// Process string chunk
    #[wasm_bindgen(js_name = processChunk)]
    pub fn process_chunk(&mut self, chunk: &str) -> Result<JsValue, JsError> {
        self.input_buffer.extend_from_slice(chunk.as_bytes());
        self.process_bytes_to_objects()
    }

    /// Flush remaining data (legacy object format)
    #[wasm_bindgen]
    pub fn flush(&mut self) -> Result<JsValue, JsError> {
        let completed_records = Array::new();

        // Process remaining input
        if !self.input_buffer.is_empty() {
            let result = self.process_bytes_to_objects()?;
            let arr = Array::from(&result);
            for i in 0..arr.length() {
                completed_records.push(&arr.get(i));
            }
        }

        // Signal EOF to csv-core by calling with empty input
        // This allows csv-core to finish processing any partial quoted fields
        loop {
            let (result, _nin, nout) = self.reader.read_field(&[], &mut self.field_buffer);

            match result {
                ReadFieldResult::InputEmpty => {
                    // No more data
                    break;
                }
                ReadFieldResult::Field { record_end } => {
                    // csv-core returned a final field
                    self.partial_field
                        .extend_from_slice(&self.field_buffer[..nout]);
                    let field_str = self.bytes_to_string(&self.partial_field)?;
                    self.partial_field.clear();
                    self.current_record.push(field_str);

                    if record_end {
                        if let Some(record) = self.finish_record() {
                            completed_records.push(&record);
                        }
                    }
                }
                ReadFieldResult::End => {
                    // Handle any remaining partial field
                    if nout > 0 {
                        self.partial_field
                            .extend_from_slice(&self.field_buffer[..nout]);
                        let field_str = self.bytes_to_string(&self.partial_field)?;
                        self.partial_field.clear();
                        self.current_record.push(field_str);
                    }
                    break;
                }
                ReadFieldResult::OutputFull => {
                    let new_size = self.field_buffer.len() * 2;
                    self.field_buffer.resize(new_size, 0);
                    continue;
                }
            }
        }

        // Finish any partial record
        if !self.current_record.is_empty() {
            if let Some(record) = self.finish_record() {
                completed_records.push(&record);
            }
        }

        self.reset_state();
        Ok(completed_records.into())
    }

    /// Flush remaining data (truly flat format)
    #[wasm_bindgen(js_name = flushTrulyFlat)]
    pub fn flush_truly_flat(&mut self) -> Result<FlatParseResult, JsError> {
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
        let mut eof_step = 0;
        loop {
            eof_step += 1;
            let (result, _nin, nout) = self.reader.read_field(&[], &mut self.field_buffer);

            match result {
                ReadFieldResult::InputEmpty => {
                    break;
                }
                ReadFieldResult::Field { record_end } => {
                    // csv-core returned a final field
                    self.partial_field
                        .extend_from_slice(&self.field_buffer[..nout]);
                    let field_str = self.bytes_to_string(&self.partial_field)?;
                    self.partial_field.clear();
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
                        let field_str = self.bytes_to_string(&self.partial_field)?;
                        self.partial_field.clear();
                        self.current_record.push(field_str);
                    }
                    break;
                }
                ReadFieldResult::OutputFull => {
                    let new_size = self.field_buffer.len() * 2;
                    self.field_buffer.resize(new_size, 0);
                    continue;
                }
            }

            if eof_step > 10 {
                break;
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

        self.reset_state();

        Ok(create_flat_result(
            self.headers_js_cache.clone(),
            self.headers.as_ref().map(|h| h.len()).unwrap_or(0),
            field_data,
            actual_field_counts,
            record_count,
        ))
    }
}

impl CSVParser {
    /// Process bytes using csv-core and return object format
    fn process_bytes_to_objects(&mut self) -> Result<JsValue, JsError> {
        let completed_records = Array::new();
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
                    // Field too large - grow buffer and retry
                    let new_size = self.field_buffer.len() * 2;
                    self.field_buffer.resize(new_size, 0);
                    continue;
                }
                ReadFieldResult::Field { record_end } => {
                    // Combine partial field data with current output
                    self.partial_field
                        .extend_from_slice(&self.field_buffer[..nout]);
                    let field_str = self.bytes_to_string(&self.partial_field)?;
                    self.partial_field.clear();

                    // Check field count limit
                    if self.current_record.len() >= self.max_field_count {
                        return Err(JsError::new(&format!(
                            "Field count limit exceeded at line {}: maximum {} fields allowed",
                            self.line, self.max_field_count
                        )));
                    }

                    self.current_record.push(field_str);
                    input_pos += nin;
                    self.byte += nin;

                    // Update line count for newlines in input
                    for &b in &self.input_buffer[input_pos - nin..input_pos] {
                        if b == b'\n' {
                            self.line += 1;
                        }
                    }

                    if record_end {
                        if let Some(record) = self.finish_record() {
                            completed_records.push(&record);
                        }
                    }
                }
                ReadFieldResult::End => {
                    input_pos += nin;
                    break;
                }
            }
        }

        // Remove processed bytes
        self.input_buffer.drain(..input_pos);

        Ok(completed_records.into())
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
                    let new_size = self.field_buffer.len() * 2;
                    self.field_buffer.resize(new_size, 0);
                    continue;
                }
                ReadFieldResult::Field { record_end } => {
                    // Combine partial field data with current output
                    self.partial_field
                        .extend_from_slice(&self.field_buffer[..nout]);
                    let field_str = self.bytes_to_string(&self.partial_field)?;
                    self.partial_field.clear();

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

    /// Convert bytes to UTF-8 string with error handling
    fn bytes_to_string(&self, bytes: &[u8]) -> Result<String, JsError> {
        std::str::from_utf8(bytes)
            .map(|s| s.to_string())
            .map_err(|e| {
                JsError::new(&format!(
                    "Invalid UTF-8 at line {}:{}: {}",
                    self.line, self.byte, e
                ))
            })
    }

    /// Finish current record and convert to JS object
    fn finish_record(&mut self) -> Option<JsValue> {
        if self.current_record.is_empty() && !self.headers_parsed {
            return None;
        }

        if !self.headers_parsed {
            // First record is headers
            let headers: Vec<String> = self.current_record.drain(..).collect();
            let arr = Array::new();
            for header in &headers {
                arr.push(&JsValue::from_str(header));
            }
            self.headers_js_cache = arr.into();
            self.headers = Some(headers);
            self.headers_parsed = true;
            None
        } else {
            // Data record
            if let Some(ref headers) = self.headers {
                let obj = Object::new();
                for (i, header) in headers.iter().enumerate() {
                    let key = JsValue::from_str(header);
                    let value = if i < self.current_record.len() {
                        JsValue::from_str(&self.current_record[i])
                    } else {
                        JsValue::UNDEFINED
                    };

                    if header == "__proto__" || header == "constructor" || header == "prototype" {
                        let descriptor = Object::new();
                        let _ = Reflect::set(&descriptor, &JsValue::from_str("value"), &value);
                        let _ = Reflect::set(&descriptor, &JsValue::from_str("writable"), &JsValue::TRUE);
                        let _ = Reflect::set(&descriptor, &JsValue::from_str("enumerable"), &JsValue::TRUE);
                        let _ = Reflect::set(&descriptor, &JsValue::from_str("configurable"), &JsValue::TRUE);
                        let _ = Object::define_property(&obj, &key, &descriptor);
                    } else {
                        let _ = Reflect::set(&obj, &key, &value);
                    }
                }
                self.current_record.clear();
                Some(obj.into())
            } else {
                self.current_record.clear();
                None
            }
        }
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

                for i in 0..headers.len() {
                    if i < self.current_record.len() {
                        field_data.push(self.current_record[i].clone());
                    } else {
                        field_data.push(String::new());
                    }
                }
                *record_count += 1;
                self.current_record.clear();
            } else {
                self.current_record.clear();
            }
        }
    }

    /// Reset parser state
    fn reset_state(&mut self) {
        self.current_record.clear();
        self.input_buffer.clear();
        self.partial_field.clear();
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
}
