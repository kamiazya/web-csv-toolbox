use wasm_bindgen::prelude::*;

pub mod assembler;
mod csv_json;
mod error;
pub mod lexer;
pub mod parser_optimized;

// Re-export optimized types as default
// Note: Lexer and Assembler "optimized" versions currently use the legacy implementation
// Parser has a fully optimized implementation with 3-8x performance improvement
pub use assembler::CSVRecordAssemblerLegacy as CSVRecordAssemblerOptimized;
pub use lexer::BinaryCSVLexerLegacy as BinaryCSVLexerOptimized;
pub use parser_optimized::CSVParserOptimized;

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
    source: &str,
) -> Result<JsValue, wasm_bindgen::JsError> {
    let source_opt = (!source.is_empty()).then_some(source);
    csv_json::parse_csv_to_jsvalue(input, delimiter, max_buffer_size, source_opt)
        .map_err(|err| wasm_bindgen::JsError::new(&err))
}
