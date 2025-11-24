use wasm_bindgen::prelude::*;

pub mod assembler;
mod csv_json;
mod error;
pub mod lexer;
pub mod parser;

#[cfg(test)]
mod tests;

/// Parse CSV string to array synchronously (WASM binding)
///
/// # Arguments
///
/// * `input` - CSV string to parse
/// * `delimiter` - Delimiter character (e.g., b',' for comma)
/// * `max_buffer_size` - Maximum allowed input size in bytes
/// * `source` - Optional source identifier for error reporting (e.g., filename). Pass empty string for None.
///
/// # Returns
///
/// Result containing JsValue with the JSON string representation of parsed CSV data.
///
/// # Errors
///
/// Returns a JsError if parsing fails or input size exceeds limit, which will be thrown as a JavaScript error.
#[wasm_bindgen(js_name = parseStringToArraySync)]
pub fn parse_string_to_array_sync(
    input: &str,
    delimiter: u8,
    max_buffer_size: usize,
    source: &str,
) -> Result<JsValue, wasm_bindgen::JsError> {
    let source_opt = (!source.is_empty()).then_some(source);
    csv_json::parse_csv_to_json(input, delimiter, max_buffer_size, source_opt)
        .map(|json_str| JsValue::from_str(&json_str))
        .map_err(|err| wasm_bindgen::JsError::new(&err))
}
