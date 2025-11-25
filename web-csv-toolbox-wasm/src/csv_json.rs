use js_sys::Array;
use wasm_bindgen::prelude::*;

use crate::error::format_error;
use crate::parser_optimized::CSVParserOptimized;

// rust-csv is only available in test/bench builds for comparison
#[cfg(test)]
use csv::ReaderBuilder;
#[cfg(test)]
use js_sys::{Object, Reflect};
#[cfg(test)]
use serde_json::json;

/// Parse CSV string to JsValue array (direct conversion without JSON serialization)
///
/// Uses optimized parser instead of rust-csv for better performance.
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
pub(crate) fn parse_csv_to_jsvalue(
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
        &JsValue::from_f64(max_buffer_size as f64),
    );

    // Use optimized parser
    let mut parser = CSVParserOptimized::new(options.into())
        .map_err(|e| format_error(format!("Failed to create parser: {:?}", e), source))?;

    // Process input as string chunk
    let records = parser
        .process_chunk(input)
        .map_err(|e| format_error(format!("Failed to parse CSV: {:?}", e), source))?;

    // Flush remaining data
    let flush_records = parser
        .flush()
        .map_err(|e| format_error(format!("Failed to flush parser: {:?}", e), source))?;

    // Combine results
    let combined = Array::new();
    if let Some(records_array) = records.dyn_ref::<Array>() {
        for i in 0..records_array.length() {
            combined.push(&records_array.get(i));
        }
    }
    if let Some(flush_array) = flush_records.dyn_ref::<Array>() {
        for i in 0..flush_array.length() {
            combined.push(&flush_array.get(i));
        }
    }

    Ok(combined.into())
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
