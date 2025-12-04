use crate::error::format_error;
use csv::ReaderBuilder;
use serde_json::json;

/// Default maximum field count per record (matches TypeScript DEFAULT_ASSEMBLER_MAX_FIELD_COUNT)
/// Note: Not directly used in this module but exported for documentation consistency
#[allow(dead_code)]
pub const DEFAULT_MAX_FIELD_COUNT: usize = 100_000;

/// Parse CSV string to JSON string using rust-csv
///
/// This implementation leverages V8's highly optimized JSON.parse() for object construction.
/// By returning a JSON string and letting JavaScript parse it, we avoid the overhead of
/// WASM↔JS boundary crossing for individual objects/arrays.
///
/// **Performance Rationale:**
/// - V8's JSON.parse() is implemented in C++ with highly optimized object construction
/// - Single WASM→JS boundary crossing (one string) vs N×M crossings for flat format
/// - JSON.parse() benefits from V8's hidden class optimizations
///
/// # Arguments
///
/// * `input` - CSV string to parse
/// * `delimiter` - Delimiter character (e.g., b',' for comma)
/// * `max_buffer_size` - Maximum allowed input size in bytes
/// * `source` - Optional source identifier for error reporting
///
/// # Returns
///
/// Result containing JSON string representing array of objects
pub fn parse_csv_to_json(
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
