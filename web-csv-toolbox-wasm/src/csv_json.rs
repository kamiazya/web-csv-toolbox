use js_sys::{Array, Object, Reflect};
use wasm_bindgen::prelude::*;

use crate::error::format_error;
use crate::parser::CSVParser;

// rust-csv is only available in test/bench builds for comparison
#[cfg(test)]
use csv::ReaderBuilder;
#[cfg(test)]
use serde_json::json;

/// Default maximum field count per record (matches TypeScript DEFAULT_ASSEMBLER_MAX_FIELD_COUNT)
/// Note: Not directly used in this module but exported for documentation consistency
#[allow(dead_code)]
pub const DEFAULT_MAX_FIELD_COUNT: usize = 100_000;

/// Parse CSV string to JsValue array (direct conversion without JSON serialization)
///
/// Uses optimized parser with flat format internally, then converts to objects.
/// This is a convenience function for one-shot parsing that returns the traditional
/// array of objects format expected by most use cases.
///
/// For high-performance streaming or batch processing, prefer using
/// `CSVParser::process_chunk_bytes_flat` directly and assembling objects on the JS side.
///
/// # Arguments
///
/// * `input` - CSV string to parse
/// * `delimiter` - Delimiter character (e.g., b',' for comma)
/// * `max_buffer_size` - Maximum allowed input size in bytes
/// * `max_field_count` - Maximum number of fields allowed per record (prevents DoS)
/// * `source` - Optional source identifier for error reporting (e.g., filename)
///
/// # Returns
///
/// JsValue array of record objects
pub(crate) fn parse_csv_to_jsvalue(
    input: &str,
    delimiter: u8,
    max_buffer_size: usize,
    max_field_count: usize,
    source: Option<&str>,
) -> Result<JsValue, String> {
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

    // Create optimized parser options
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

    // Use optimized parser with flat format (stream: None = auto-flush)
    let mut parser = CSVParser::new(options.into())
        .map_err(|e| format_error(format!("Failed to create parser: {:?}", e), source))?;

    let flat_result = parser
        .process_chunk(input, None)
        .map_err(|e| format_error(format!("Failed to parse CSV: {:?}", e), source))?;

    // Convert flat result to array of objects
    let records = Array::new();
    let headers_js = flat_result.headers();
    let field_count = flat_result.field_count();
    let record_count = flat_result.record_count();
    let field_data_js = flat_result.field_data();
    let actual_field_counts_js = flat_result.actual_field_counts();

    if headers_js.is_null() || field_count == 0 {
        return Ok(records.into());
    }

    // Extract headers
    let headers_arr = Array::from(&headers_js);
    let mut headers: Vec<String> = Vec::with_capacity(field_count);
    for i in 0..headers_arr.length() {
        if let Some(h) = headers_arr.get(i).as_string() {
            headers.push(h);
        }
    }

    // Extract field data
    let field_data_arr = Array::from(&field_data_js);

    // Extract actual field counts per record
    let actual_counts_arr = Array::from(&actual_field_counts_js);
    let mut actual_counts: Vec<usize> = Vec::with_capacity(record_count);
    for i in 0..actual_counts_arr.length() {
        if let Some(n) = actual_counts_arr.get(i).as_f64() {
            actual_counts.push(n as usize);
        }
    }

    // Build objects
    for r in 0..record_count {
        let obj = Object::new();
        // Get actual field count for this record (default to field_count if not available)
        let actual_count = actual_counts.get(r).copied().unwrap_or(field_count);

        for (f, header) in headers.iter().enumerate() {
            // Only set value if this field was actually present in the record
            // Fields beyond actual_count should remain undefined (sparse record handling)
            let value = if f < actual_count {
                let idx = r * field_count + f;
                if (idx as u32) < field_data_arr.length() {
                    field_data_arr.get(idx as u32)
                } else {
                    JsValue::UNDEFINED
                }
            } else {
                JsValue::UNDEFINED
            };

            let key = JsValue::from_str(header);

            // Handle prototype pollution protection
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
        records.push(&obj);
    }

    Ok(records.into())
}

#[cfg(test)]
/// Parse CSV string to JSON string using rust-csv (for legacy tests)
///
/// This is the legacy JSON-based implementation used by basic.rs tests.
pub(crate) fn parse_csv_to_json(
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

#[cfg(test)]
/// Parse CSV string to JsValue using rust-csv (for benchmarking and comparison)
///
/// This function is only available in test/bench builds and uses rust-csv
/// for comparison with the optimized parser implementation.
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
/// JsValue array of record objects
#[allow(dead_code)]
pub(crate) fn parse_csv_to_jsvalue_rustcsv(
    input: &str,
    delimiter: u8,
    max_buffer_size: usize,
    source: Option<&str>,
) -> Result<JsValue, String> {
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

    let records = Array::new();

    for result in rdr.records() {
        let record =
            result.map_err(|e| format_error(format!("Failed to read record: {}", e), source))?;

        // Create JS object directly without JSON serialization
        let obj = Object::new();
        for (header, field) in headers.iter().zip(record.iter()) {
            let key = JsValue::from_str(header);
            let value = JsValue::from_str(field);

            // Use Reflect.set for normal properties
            // Special property names like __proto__ need Object.defineProperty
            if header == "__proto__" || header == "constructor" || header == "prototype" {
                let descriptor = Object::new();
                let _ = Reflect::set(&descriptor, &"value".into(), &value);
                let _ = Reflect::set(&descriptor, &"writable".into(), &JsValue::TRUE);
                let _ = Reflect::set(&descriptor, &"enumerable".into(), &JsValue::TRUE);
                let _ = Reflect::set(&descriptor, &"configurable".into(), &JsValue::TRUE);
                let _ = Object::define_property(&obj, &key, &descriptor);
            } else {
                let _ = Reflect::set(&obj, &key, &value);
            }
        }
        records.push(&obj);
    }

    Ok(records.into())
}

// Note: Comparison tests between optimized parser and rust-csv are implemented
// in benches/csv_parsing.rs using the Criterion framework, as they require a
// WASM environment to run properly.
