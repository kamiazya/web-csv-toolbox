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

/// Parse CSV string to array synchronously (WASM binding)
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
/// Result containing JsValue array of record objects (direct conversion without JSON serialization).
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
) -> Result<JsValue, wasm_bindgen::JsError> {
    let source_opt = (!source.is_empty()).then_some(source);
    csv_json::parse_csv_to_jsvalue(input, delimiter, max_buffer_size, max_field_count, source_opt)
        .map_err(|err| wasm_bindgen::JsError::new(&err))
}
