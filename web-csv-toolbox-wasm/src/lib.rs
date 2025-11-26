use wasm_bindgen::prelude::*;

mod csv_json;
mod error;
pub mod parser;
pub mod parser_optimized;

// Re-export FlatParseResult from parser_optimized
pub use parser_optimized::FlatParseResult;

// Re-export csv-core based parser
pub use parser::CSVParser;

#[cfg(test)]
mod tests;

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
