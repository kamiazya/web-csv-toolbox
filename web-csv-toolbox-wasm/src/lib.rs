use std::cell::RefCell;
use wasm_bindgen::prelude::*;

mod csv_json;
mod error;
pub mod parser;
pub mod parser_optimized;
pub mod simd;

// Re-export parse_csv_to_json for WASM binding
use csv_json::parse_csv_to_json;

// Re-export FlatParseResult from parser_optimized
pub use parser_optimized::FlatParseResult;

// Re-export csv-core based parser
pub use parser::CSVParser;

#[cfg(test)]
mod tests;

// =============================================================================
// Zero-Copy WASM Memory Approach
// =============================================================================

// Thread-local buffer for scan results (avoids allocations on repeated calls)
thread_local! {
    static SCAN_BUFFER: RefCell<Vec<u32>> = RefCell::new(Vec::with_capacity(1024 * 64));
    static UNESCAPE_FLAGS_BUFFER: RefCell<Vec<u32>> = RefCell::new(Vec::with_capacity(1024 * 2));
}

/// Initialize the scan output buffer with a given capacity
///
/// Call this once at startup to pre-allocate memory for scan results.
/// This avoids repeated allocations during parsing.
#[wasm_bindgen(js_name = initScanBuffer)]
pub fn init_scan_buffer(capacity: usize) {
    SCAN_BUFFER.with(|buf| {
        let mut b = buf.borrow_mut();
        b.clear();
        b.reserve(capacity);
    });
}

/// Get the current capacity of the scan buffer
#[wasm_bindgen(js_name = getScanBufferCapacity)]
pub fn get_scan_buffer_capacity() -> usize {
    SCAN_BUFFER.with(|buf| buf.borrow().capacity())
}

/// Scan CSV using SIMD and return a view into WASM memory (zero-copy)
///
/// This function writes scan results directly to a pre-allocated buffer
/// in WASM linear memory. The returned Uint32Array is a VIEW into this
/// memory, avoiding any copy.
///
/// **Important:** The returned view is only valid until the next call to
/// this function. Copy the data if you need to retain it.
///
/// # Returns
/// A Uint32Array view into WASM memory containing packed separator indices.
#[wasm_bindgen(js_name = scanCsvSimdZeroCopy)]
pub fn scan_csv_simd_zero_copy(input: &str, delimiter: u8) -> js_sys::Uint32Array {
    SCAN_BUFFER.with(|buf| {
        let mut buffer = buf.borrow_mut();
        buffer.clear();

        // Scan directly into the buffer
        let mut scanner = simd::SimdScanner::with_options(delimiter, b'"');
        let result = scanner.scan(input.as_bytes(), 0);

        // Copy separators to our persistent buffer
        // (This copy is within WASM memory, very fast)
        buffer.extend_from_slice(&result.separators);

        // Create a view into WASM memory
        let ptr = buffer.as_ptr() as u32;
        let len = buffer.len() as u32;

        // Get WASM memory buffer
        let memory = wasm_bindgen::memory();
        let memory_buffer = memory.unchecked_ref::<js_sys::WebAssembly::Memory>().buffer();

        // Create Uint32Array view (zero-copy from JS perspective)
        js_sys::Uint32Array::new_with_byte_offset_and_length(
            &memory_buffer,
            ptr,
            len,
        )
    })
}

/// Scan CSV bytes using SIMD and return a view into WASM memory (zero-copy)
///
/// This version accepts binary input directly (Uint8Array), avoiding the
/// string encoding overhead. Combined with TextDecoder on the JS side,
/// this can be faster for large files.
///
/// # Arguments
/// * `input` - CSV data as bytes (Uint8Array)
/// * `delimiter` - Delimiter character code (e.g., 44 for comma)
///
/// # Returns
/// A Uint32Array view into WASM memory containing packed separator indices.
#[wasm_bindgen(js_name = scanCsvBytesZeroCopy)]
pub fn scan_csv_bytes_zero_copy(input: &[u8], delimiter: u8) -> js_sys::Uint32Array {
    SCAN_BUFFER.with(|buf| {
        let mut buffer = buf.borrow_mut();
        buffer.clear();

        // Scan directly
        let mut scanner = simd::SimdScanner::with_options(delimiter, b'"');
        let result = scanner.scan(input, 0);

        // Copy to persistent buffer (within WASM memory)
        buffer.extend_from_slice(&result.separators);

        // Create view into WASM memory
        let ptr = buffer.as_ptr() as u32;
        let len = buffer.len() as u32;

        let memory = wasm_bindgen::memory();
        let memory_buffer = memory.unchecked_ref::<js_sys::WebAssembly::Memory>().buffer();

        js_sys::Uint32Array::new_with_byte_offset_and_length(&memory_buffer, ptr, len)
    })
}

/// Scan CSV bytes with extended metadata (quote flags and unescape hints)
///
/// This version returns additional metadata to help JavaScript optimize field processing:
/// - Each separator includes an `is_quoted` flag (bit 30)
/// - A separate `unescapeFlags` bitmap indicates which fields contain escaped quotes ("")
///
/// # Extended Pack Format
/// - Bits 0-29: byte offset (max 1GB)
/// - Bit 30: is_quoted (1 = field is quoted)
/// - Bit 31: separator type (0 = delimiter, 1 = LF)
///
/// # Arguments
/// * `input` - CSV data as bytes (Uint8Array)
/// * `delimiter` - Delimiter character code (e.g., 44 for comma)
///
/// # Returns
/// A JavaScript object with:
/// - `separators`: Uint32Array of packed separator indices (extended format)
/// - `unescapeFlags`: Uint32Array bitmap (1 bit per field, set if field needs unescape)
#[wasm_bindgen(js_name = scanCsvBytesExtended)]
pub fn scan_csv_bytes_extended(input: &[u8], delimiter: u8) -> JsValue {
    SCAN_BUFFER.with(|sep_buf| {
        UNESCAPE_FLAGS_BUFFER.with(|flags_buf| {
            let mut sep_buffer = sep_buf.borrow_mut();
            let mut flags_buffer = flags_buf.borrow_mut();
            sep_buffer.clear();
            flags_buffer.clear();

            // Extended scan
            let mut scanner = simd::SimdScanner::with_options(delimiter, b'"');
            let result = scanner.scan_extended(input, 0);

            // Copy to persistent buffers
            sep_buffer.extend_from_slice(&result.separators);
            flags_buffer.extend_from_slice(&result.unescape_flags);

            // Get WASM memory
            let memory = wasm_bindgen::memory();
            let memory_buffer = memory.unchecked_ref::<js_sys::WebAssembly::Memory>().buffer();

            // Create Uint32Array views
            let sep_ptr = sep_buffer.as_ptr() as u32;
            let sep_len = sep_buffer.len() as u32;
            let separators_array = js_sys::Uint32Array::new_with_byte_offset_and_length(
                &memory_buffer,
                sep_ptr,
                sep_len,
            );

            let flags_ptr = flags_buffer.as_ptr() as u32;
            let flags_len = flags_buffer.len() as u32;
            let flags_array = js_sys::Uint32Array::new_with_byte_offset_and_length(
                &memory_buffer,
                flags_ptr,
                flags_len,
            );

            // Return as JS object
            let obj = js_sys::Object::new();
            let _ = js_sys::Reflect::set(&obj, &JsValue::from_str("separators"), &separators_array);
            let _ = js_sys::Reflect::set(&obj, &JsValue::from_str("unescapeFlags"), &flags_array);
            obj.into()
        })
    })
}

/// Scan CSV bytes and return character offsets (UTF-8 aware)
///
/// This version tracks character count while scanning, providing correct
/// offsets for use with JavaScript string.slice() on UTF-8 content.
///
/// **Use Case:**
/// - When CSV contains non-ASCII characters (UTF-8)
/// - Returns character offsets that work directly with string.slice()
///
/// # Arguments
/// * `input` - CSV data as bytes (Uint8Array)
/// * `delimiter` - Delimiter character code (e.g., 44 for comma)
///
/// # Returns
/// A Uint32Array view into WASM memory containing packed separator indices.
/// The offsets are CHARACTER positions, not byte positions.
#[wasm_bindgen(js_name = scanCsvBytesCharOffsets)]
pub fn scan_csv_bytes_char_offsets(input: &[u8], delimiter: u8) -> js_sys::Uint32Array {
    SCAN_BUFFER.with(|buf| {
        let mut buffer = buf.borrow_mut();
        buffer.clear();

        // Scan with character offset tracking
        let mut scanner = simd::SimdScanner::with_options(delimiter, b'"');
        let result = scanner.scan_char_offsets(input, 0);

        // Copy to persistent buffer
        buffer.extend_from_slice(&result.separators);

        // Create view into WASM memory
        let ptr = buffer.as_ptr() as u32;
        let len = buffer.len() as u32;

        let memory = wasm_bindgen::memory();
        let memory_buffer = memory.unchecked_ref::<js_sys::WebAssembly::Memory>().buffer();

        js_sys::Uint32Array::new_with_byte_offset_and_length(&memory_buffer, ptr, len)
    })
}

/// Scan CSV UTF-16 code units directly using SIMD (zero encode/decode overhead)
///
/// This function accepts UTF-16 code units (from JavaScript string) directly,
/// eliminating the UTF-16 → UTF-8 → UTF-16 conversion overhead.
///
/// **Performance:** ~40% faster than UTF-8 approach by avoiding encode/decode.
///
/// **Use Case:**
/// - When you have a JavaScript string and want to avoid encoding overhead
/// - Works correctly with any Unicode content (UTF-8, CJK, emoji, etc.)
///
/// # Arguments
/// * `input` - UTF-16 code units as Uint16Array (from JS: new Uint16Array(str.length))
/// * `delimiter` - Delimiter character code (e.g., 44 for comma)
///
/// # Returns
/// A Uint32Array view into WASM memory containing packed separator indices.
/// The offsets are CHARACTER positions that work directly with string.slice().
#[wasm_bindgen(js_name = scanCsvUtf16ZeroCopy)]
pub fn scan_csv_utf16_zero_copy(input: &[u16], delimiter: u8) -> js_sys::Uint32Array {
    SCAN_BUFFER.with(|buf| {
        let mut buffer = buf.borrow_mut();
        buffer.clear();

        // Scan UTF-16 directly with SIMD
        let mut scanner = simd::SimdScanner::with_options(delimiter, b'"');

        #[cfg(target_arch = "wasm32")]
        let result = scanner.scan_utf16_simd(input, 0);

        #[cfg(not(target_arch = "wasm32"))]
        let result = scanner.scan_utf16(input, 0);

        // Copy to persistent buffer
        buffer.extend_from_slice(&result.separators);

        // Create view into WASM memory
        let ptr = buffer.as_ptr() as u32;
        let len = buffer.len() as u32;

        let memory = wasm_bindgen::memory();
        let memory_buffer = memory.unchecked_ref::<js_sys::WebAssembly::Memory>().buffer();

        js_sys::Uint32Array::new_with_byte_offset_and_length(&memory_buffer, ptr, len)
    })
}

/// Parse CSV string to flat format synchronously (WASM binding)
///
/// Returns FlatParseResult for efficient WASM↔JS boundary crossing.
/// Object assembly should be done on the JavaScript side using flatToObjects().
///
/// # Arguments
///
/// * `input` - CSV string to parse
/// * `delimiter` - Delimiter character (e.g., b',' for comma)
/// * `max_buffer_size` - Maximum allowed input size in bytes
/// * `max_field_count` - Maximum number of fields allowed per record (prevents DoS attacks)
/// * `source` - Optional source identifier for error reporting (e.g., filename). Pass empty string for None.
///
/// # Returns
///
/// Result containing FlatParseResult with headers, fieldData, fieldCount, recordCount, actualFieldCounts.
///
/// # Errors
///
/// Returns a JsError if parsing fails or input size exceeds limit, which will be thrown as a JavaScript error.
#[wasm_bindgen(js_name = parseStringToArraySync)]
pub fn parse_string_to_array_sync(
    input: &str,
    delimiter: u8,
    max_buffer_size: usize,
    max_field_count: usize,
    source: &str,
) -> Result<FlatParseResult, wasm_bindgen::JsError> {
    let source_opt = if source.is_empty() {
        None
    } else {
        Some(source)
    };

    // Validate input size
    if input.len() > max_buffer_size {
        return Err(wasm_bindgen::JsError::new(&error::format_error(
            format!(
                "Input size ({} bytes) exceeds maximum allowed size ({} bytes)",
                input.len(),
                max_buffer_size
            ),
            source_opt,
        )));
    }

    // Create parser with options
    let options = js_sys::Object::new();
    let _ = js_sys::Reflect::set(
        &options,
        &JsValue::from_str("delimiter"),
        &JsValue::from_str(&String::from_utf8_lossy(&[delimiter])),
    );
    let _ = js_sys::Reflect::set(
        &options,
        &JsValue::from_str("maxFieldCount"),
        &JsValue::from_f64(max_field_count as f64),
    );

    // Use CSVParser with parseAll for one-shot parsing
    let mut parser = CSVParser::new(options.into()).map_err(|e| {
        wasm_bindgen::JsError::new(&error::format_error(
            format!("Failed to create parser: {:?}", e),
            source_opt,
        ))
    })?;

    parser.parse_all(input).map_err(|e| {
        wasm_bindgen::JsError::new(&error::format_error(
            format!("Failed to parse CSV: {:?}", e),
            source_opt,
        ))
    })
}

/// Parse CSV string to JSON string synchronously (WASM binding)
///
/// Returns a JSON string that can be parsed with JSON.parse() on the JavaScript side.
/// This approach leverages V8's highly optimized JSON.parse() for object construction,
/// providing better performance than the flat format for batch operations.
///
/// **Performance:**
/// - V8's JSON.parse() is implemented in C++ with optimized object construction
/// - Single WASM→JS boundary crossing (one string)
/// - Benefits from V8's hidden class optimizations
///
/// # Arguments
///
/// * `input` - CSV string to parse
/// * `delimiter` - Delimiter character (e.g., b',' for comma)
/// * `max_buffer_size` - Maximum allowed input size in bytes
/// * `source` - Optional source identifier for error reporting. Pass empty string for None.
///
/// # Returns
///
/// Result containing JSON string representing array of objects.
/// Use JSON.parse() on the JavaScript side to convert to objects.
///
/// # Errors
///
/// Returns a JsError if parsing fails or input size exceeds limit.
#[wasm_bindgen(js_name = parseStringToArraySyncJson)]
pub fn parse_string_to_array_sync_json(
    input: &str,
    delimiter: u8,
    max_buffer_size: usize,
    source: &str,
) -> Result<String, wasm_bindgen::JsError> {
    let source_opt = if source.is_empty() {
        None
    } else {
        Some(source)
    };

    parse_csv_to_json(input, delimiter, max_buffer_size, source_opt)
        .map_err(|e| wasm_bindgen::JsError::new(&e))
}

/// Parse CSV string using SIMD-accelerated scanner (WASM binding)
///
/// This function uses SIMD128 instructions for high-performance CSV parsing.
/// It provides ~3-5x speedup over the csv-core based parser for large files.
///
/// **Architecture:**
/// - Uses SIMD to scan 16 bytes at a time for delimiter detection
/// - XOR-based quote state tracking (inspired by WebGPU implementation)
/// - Returns data in Flat format for efficient WASM↔JS boundary crossing
///
/// # Arguments
///
/// * `input` - CSV string to parse
/// * `delimiter` - Delimiter character (e.g., b',' for comma)
/// * `max_buffer_size` - Maximum allowed input size in bytes
/// * `source` - Optional source identifier for error reporting. Pass empty string for None.
///
/// # Returns
///
/// Result containing FlatParseResult with headers, fieldData, fieldCount, recordCount, actualFieldCounts.
///
/// # Errors
///
/// Returns a JsError if input size exceeds limit.
#[wasm_bindgen(js_name = parseStringToArraySyncSimd)]
pub fn parse_string_to_array_sync_simd(
    input: &str,
    delimiter: u8,
    max_buffer_size: usize,
    source: &str,
) -> Result<FlatParseResult, wasm_bindgen::JsError> {
    let source_opt = if source.is_empty() {
        None
    } else {
        Some(source)
    };

    // Validate input size
    if input.len() > max_buffer_size {
        return Err(wasm_bindgen::JsError::new(&error::format_error(
            format!(
                "Input size ({} bytes) exceeds maximum allowed size ({} bytes)",
                input.len(),
                max_buffer_size
            ),
            source_opt,
        )));
    }

    // Use SIMD parser
    let quote = b'"'; // Default quote character
    let (headers, field_data, actual_field_counts) =
        simd::parse_csv_str_simd(input, delimiter, quote);

    // Create JS arrays for headers
    let headers_array = js_sys::Array::new();
    for header in &headers {
        headers_array.push(&JsValue::from_str(header));
    }

    // Calculate values before moving
    let header_count = headers.len();
    let record_count = actual_field_counts.len();

    // Create FlatParseResult
    Ok(FlatParseResult::new(
        headers_array.into(),
        header_count,
        field_data,
        actual_field_counts,
        record_count,
    ))
}

/// Scan CSV string using SIMD and return only separator indices (WASM binding)
///
/// This function performs SIMD-accelerated scanning to find separator positions,
/// but does NOT extract field content. The returned indices can be used by JavaScript
/// to extract fields directly from the original string.
///
/// **Performance:**
/// - SIMD128 instructions for high-performance delimiter detection
/// - Minimal WASM→JS boundary crossing (only index array)
/// - Field extraction done in JS (fast string operations)
///
/// **Output Format:**
/// Each u32 in the returned array is packed as:
/// - Bits 0-30: byte offset
/// - Bit 31: separator type (0 = delimiter, 1 = LF)
///
/// # Arguments
///
/// * `input` - CSV string to scan
/// * `delimiter` - Delimiter character (e.g., b',' for comma)
///
/// # Returns
///
/// Uint32Array of packed separator indices
#[wasm_bindgen(js_name = scanCsvSimd)]
pub fn scan_csv_simd(input: &str, delimiter: u8) -> js_sys::Uint32Array {
    let mut scanner = simd::SimdScanner::with_options(delimiter, b'"');
    let result = scanner.scan(input.as_bytes(), 0);

    // Convert Vec<u32> to Uint32Array
    let array = js_sys::Uint32Array::new_with_length(result.separators.len() as u32);
    array.copy_from(&result.separators);
    array
}

/// Parse CSV string using SIMD scanner and return JSON string (WASM binding)
///
/// This function combines SIMD-accelerated parsing with JSON output for optimal performance:
/// - SIMD128 instructions for high-performance delimiter detection
/// - JSON output for efficient single boundary crossing
/// - Uses serde_json for maintainable serialization
///
/// **Performance:**
/// - SIMD scanning: ~3-5x faster than csv-core for delimiter detection
/// - JSON output: Single WASM→JS boundary crossing
/// - JSON.parse(): V8's C++ optimized object construction
///
/// # Arguments
///
/// * `input` - CSV string to parse
/// * `delimiter` - Delimiter character (e.g., b',' for comma)
/// * `max_buffer_size` - Maximum allowed input size in bytes
/// * `source` - Optional source identifier for error reporting. Pass empty string for None.
///
/// # Returns
///
/// Result containing JSON string representing array of objects.
/// Use JSON.parse() on the JavaScript side to convert to objects.
///
/// # Errors
///
/// Returns a JsError if input size exceeds limit or serialization fails.
#[wasm_bindgen(js_name = parseStringToArraySyncSimdJson)]
pub fn parse_string_to_array_sync_simd_json(
    input: &str,
    delimiter: u8,
    max_buffer_size: usize,
    source: &str,
) -> Result<String, wasm_bindgen::JsError> {
    let source_opt = if source.is_empty() {
        None
    } else {
        Some(source)
    };

    // Validate input size
    if input.len() > max_buffer_size {
        return Err(wasm_bindgen::JsError::new(&error::format_error(
            format!(
                "Input size ({} bytes) exceeds maximum allowed size ({} bytes)",
                input.len(),
                max_buffer_size
            ),
            source_opt,
        )));
    }

    // Use SIMD parser
    let quote = b'"'; // Default quote character
    let (headers, field_data, actual_field_counts) =
        simd::parse_csv_str_simd(input, delimiter, quote);

    // Convert to JSON array of objects
    let mut records = Vec::with_capacity(actual_field_counts.len());
    let mut field_offset = 0usize;

    for &actual_count in &actual_field_counts {
        let mut record = serde_json::Map::with_capacity(headers.len());
        for (i, header) in headers.iter().enumerate() {
            let value = if i < actual_count {
                &field_data[field_offset + i]
            } else {
                "" // Fill missing fields with empty string
            };
            record.insert(header.clone(), serde_json::json!(value));
        }
        records.push(serde_json::Value::Object(record));
        field_offset += headers.len(); // Always advance by header count (flat format)
    }

    serde_json::to_string(&records).map_err(|e| {
        wasm_bindgen::JsError::new(&error::format_error(
            format!("Failed to serialize JSON: {}", e),
            source_opt,
        ))
    })
}

// =============================================================================
// Streaming-aware Scan API
// =============================================================================

/// Scan CSV bytes with streaming support (WASM binding)
///
/// This function provides full streaming support by:
/// - Accepting the previous quote state to continue scanning mid-stream
/// - Returning structured result including endInQuote and processedBytes
///
/// **Use Case:**
/// - Large files that need to be processed in chunks
/// - Streaming parsing where chunks may end mid-field or mid-quote
///
/// **Output Format (JavaScript Object):**
/// - `separators`: Uint32Array of packed separator indices (view into WASM memory)
/// - `sepCount`: Number of separators found
/// - `processedBytes`: Bytes processed up to last LF (for leftover calculation)
/// - `endInQuote`: Boolean indicating if scan ended inside a quoted field
///
/// # Arguments
///
/// * `input` - CSV data as bytes (Uint8Array)
/// * `delimiter` - Delimiter character code (e.g., 44 for comma)
/// * `prev_in_quote` - Quote state from previous chunk (false for first chunk)
///
/// # Returns
///
/// JavaScript object with streaming metadata
#[wasm_bindgen(js_name = scanCsvBytesStreaming)]
pub fn scan_csv_bytes_streaming(input: &[u8], delimiter: u8, prev_in_quote: bool) -> JsValue {
    SCAN_BUFFER.with(|buf| {
        let mut buffer = buf.borrow_mut();
        buffer.clear();

        // Create scanner and set previous quote state
        let mut scanner = simd::SimdScanner::with_options(delimiter, b'"');
        if prev_in_quote {
            scanner.set_in_quote(true);
        }

        // Scan the chunk
        let result = scanner.scan(input, 0);

        // Copy separators to persistent buffer
        buffer.extend_from_slice(&result.separators);

        // Calculate processedBytes (bytes up to and including last LF)
        let processed_bytes = result
            .separators
            .iter()
            .rev()
            .find(|&&packed| (packed >> 31) == 1) // Find last LF
            .map(|&packed| (packed & 0x7FFF_FFFF) + 1) // Offset + 1
            .unwrap_or(0);

        // Get WASM memory for zero-copy view
        let memory = wasm_bindgen::memory();
        let memory_buffer = memory.unchecked_ref::<js_sys::WebAssembly::Memory>().buffer();

        // Create Uint32Array view
        let ptr = buffer.as_ptr() as u32;
        let len = buffer.len() as u32;
        let separators_array =
            js_sys::Uint32Array::new_with_byte_offset_and_length(&memory_buffer, ptr, len);

        // Build result object
        let obj = js_sys::Object::new();
        let _ = js_sys::Reflect::set(&obj, &JsValue::from_str("separators"), &separators_array);
        let _ = js_sys::Reflect::set(
            &obj,
            &JsValue::from_str("sepCount"),
            &JsValue::from_f64(buffer.len() as f64),
        );
        let _ = js_sys::Reflect::set(
            &obj,
            &JsValue::from_str("processedBytes"),
            &JsValue::from_f64(processed_bytes as f64),
        );
        let _ = js_sys::Reflect::set(
            &obj,
            &JsValue::from_str("endInQuote"),
            &JsValue::from_bool(scanner.in_quote()),
        );

        obj.into()
    })
}

/// Scan CSV bytes with extended format and streaming support (WASM binding)
///
/// Combines extended scan (quote metadata + unescape flags) with streaming support.
/// This is the optimal version for production use.
///
/// # Extended Packed Format
/// - Bits 0-29: byte offset (max 1GB)
/// - Bit 30: isQuoted flag (1 = field is quoted)
/// - Bit 31: separator type (0 = delimiter, 1 = LF)
///
/// # Arguments
///
/// * `input` - CSV data as bytes (Uint8Array)
/// * `delimiter` - Delimiter character code (e.g., 44 for comma)
/// * `prev_in_quote` - Quote state from previous chunk (false for first chunk)
///
/// # Returns
///
/// JavaScript object with:
/// - `separators`: Uint32Array of packed separator indices (extended format)
/// - `unescapeFlags`: Uint32Array bitmap (1 bit per field, set if needs unescape)
/// - `sepCount`: Number of separators found
/// - `processedBytes`: Bytes up to and including last LF (streaming boundary)
/// - `endInQuote`: Quote state at end of chunk (for next chunk)
#[wasm_bindgen(js_name = scanCsvBytesExtendedStreaming)]
pub fn scan_csv_bytes_extended_streaming(
    input: &[u8],
    delimiter: u8,
    prev_in_quote: bool,
) -> JsValue {
    SCAN_BUFFER.with(|sep_buf| {
        UNESCAPE_FLAGS_BUFFER.with(|flags_buf| {
            let mut sep_buffer = sep_buf.borrow_mut();
            let mut flags_buffer = flags_buf.borrow_mut();
            sep_buffer.clear();
            flags_buffer.clear();

            // Create scanner and set previous quote state
            let mut scanner = simd::SimdScanner::with_options(delimiter, b'"');
            if prev_in_quote {
                scanner.set_in_quote(true);
            }

            // Extended scan
            let result = scanner.scan_extended(input, 0);

            // Check for errors first
            if let Some(error_msg) = &result.error {
                let obj = js_sys::Object::new();
                let _ = js_sys::Reflect::set(&obj, &JsValue::from_str("error"), &JsValue::from_str(error_msg));
                return obj.into();
            }

            // Copy to persistent buffers
            sep_buffer.extend_from_slice(&result.separators);
            flags_buffer.extend_from_slice(&result.unescape_flags);

            // Calculate processedBytes (bytes up to and including last LF)
            // Extended format: bits 0-29 = offset, bit 30 = isQuoted, bit 31 = sepType
            let processed_bytes = result
                .separators
                .iter()
                .rev()
                .find(|&&packed| (packed >> 31) == 1) // Find last LF (bit 31)
                .map(|&packed| (packed & 0x3FFF_FFFF) + 1) // Get offset (bits 0-29) + 1
                .unwrap_or(0);

            // Get WASM memory for zero-copy view
            let memory = wasm_bindgen::memory();
            let memory_buffer = memory.unchecked_ref::<js_sys::WebAssembly::Memory>().buffer();

            // Create Uint32Array views
            let sep_ptr = sep_buffer.as_ptr() as u32;
            let sep_len = sep_buffer.len() as u32;
            let separators_array = js_sys::Uint32Array::new_with_byte_offset_and_length(
                &memory_buffer,
                sep_ptr,
                sep_len,
            );

            let flags_ptr = flags_buffer.as_ptr() as u32;
            let flags_len = flags_buffer.len() as u32;
            let flags_array = js_sys::Uint32Array::new_with_byte_offset_and_length(
                &memory_buffer,
                flags_ptr,
                flags_len,
            );

            // Build result object
            let obj = js_sys::Object::new();
            let _ = js_sys::Reflect::set(&obj, &JsValue::from_str("separators"), &separators_array);
            let _ = js_sys::Reflect::set(&obj, &JsValue::from_str("unescapeFlags"), &flags_array);
            let _ = js_sys::Reflect::set(
                &obj,
                &JsValue::from_str("sepCount"),
                &JsValue::from_f64(sep_buffer.len() as f64),
            );
            let _ = js_sys::Reflect::set(
                &obj,
                &JsValue::from_str("processedBytes"),
                &JsValue::from_f64(processed_bytes as f64),
            );
            let _ = js_sys::Reflect::set(
                &obj,
                &JsValue::from_str("endInQuote"),
                &JsValue::from_bool(result.end_in_quote != 0),
            );

            obj.into()
        })
    })
}

/// Scan CSV bytes with character offsets and streaming support (WASM binding)
///
/// Similar to scanCsvBytesStreaming but returns character offsets instead of byte offsets.
/// This is useful when working with UTF-8 content where byte and character positions differ.
///
/// # Arguments
///
/// * `input` - CSV data as bytes (Uint8Array)
/// * `delimiter` - Delimiter character code (e.g., 44 for comma)
/// * `prev_in_quote` - Quote state from previous chunk (false for first chunk)
/// * `base_char_offset` - Starting character offset for streaming continuation
///
/// # Returns
///
/// JavaScript object with:
/// - `separators`: Uint32Array of packed separator indices (CHARACTER offsets)
/// - `sepCount`: Number of separators found
/// - `processedBytes`: Bytes processed up to last LF
/// - `endInQuote`: Boolean indicating if scan ended inside a quoted field
/// - `endCharOffset`: Final character offset (for next chunk's base_char_offset)
#[wasm_bindgen(js_name = scanCsvBytesCharOffsetsStreaming)]
pub fn scan_csv_bytes_char_offsets_streaming(
    input: &[u8],
    delimiter: u8,
    prev_in_quote: bool,
    base_char_offset: u32,
) -> JsValue {
    SCAN_BUFFER.with(|buf| {
        let mut buffer = buf.borrow_mut();
        buffer.clear();

        // Create scanner and set previous quote state
        let mut scanner = simd::SimdScanner::with_options(delimiter, b'"');
        if prev_in_quote {
            scanner.set_in_quote(true);
        }

        // Scan with character offset tracking
        let result = scanner.scan_char_offsets(input, base_char_offset);

        // Copy separators to persistent buffer
        buffer.extend_from_slice(&result.separators);

        // Calculate processedBytes (find last LF and calculate bytes)
        // Note: For char offset mode, we need to find the byte position of last LF
        let processed_bytes = {
            let mut bytes = 0u32;
            let mut in_quote = if prev_in_quote { 1u32 } else { 0u32 };
            for (i, &byte) in input.iter().enumerate() {
                if byte == b'"' {
                    in_quote ^= 1;
                } else if in_quote == 0 && byte == b'\n' {
                    bytes = (i as u32) + 1;
                }
            }
            bytes
        };

        // Get WASM memory for zero-copy view
        let memory = wasm_bindgen::memory();
        let memory_buffer = memory.unchecked_ref::<js_sys::WebAssembly::Memory>().buffer();

        // Create Uint32Array view
        let ptr = buffer.as_ptr() as u32;
        let len = buffer.len() as u32;
        let separators_array =
            js_sys::Uint32Array::new_with_byte_offset_and_length(&memory_buffer, ptr, len);

        // Build result object
        let obj = js_sys::Object::new();
        let _ = js_sys::Reflect::set(&obj, &JsValue::from_str("separators"), &separators_array);
        let _ = js_sys::Reflect::set(
            &obj,
            &JsValue::from_str("sepCount"),
            &JsValue::from_f64(buffer.len() as f64),
        );
        let _ = js_sys::Reflect::set(
            &obj,
            &JsValue::from_str("processedBytes"),
            &JsValue::from_f64(processed_bytes as f64),
        );
        let _ = js_sys::Reflect::set(
            &obj,
            &JsValue::from_str("endInQuote"),
            &JsValue::from_bool(scanner.in_quote()),
        );
        let _ = js_sys::Reflect::set(
            &obj,
            &JsValue::from_str("endCharOffset"),
            &JsValue::from_f64(result.end_char_offset as f64),
        );

        obj.into()
    })
}
