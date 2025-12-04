//! Shared types for CSV parsing
//!
//! This module contains the `FlatParseResult` type used for efficient
//! WASM↔JS boundary crossing with the "Truly Flat" optimization.

use js_sys::Array;
use wasm_bindgen::prelude::*;

/// Flat array parse result for optimized boundary crossing
/// Returns raw field data that can be assembled on JS side
/// NOTE: Arrays are created once on construction to avoid repeated conversions
#[wasm_bindgen]
pub struct FlatParseResult {
    headers_array: JsValue,             // Pre-converted to JsValue
    field_data_array: JsValue,          // Pre-converted to JsValue
    actual_field_counts_array: JsValue, // Actual field count per record (for undefined detection)
    record_count: usize,
    field_count: usize,
}

#[wasm_bindgen]
impl FlatParseResult {
    /// Create a new FlatParseResult with pre-converted JS arrays
    /// Takes cached headers JsValue to avoid O(n²) cloning on every chunk
    pub fn new(
        headers_js_cache: JsValue,
        field_count: usize,
        field_data: Vec<String>,
        actual_field_counts: Vec<usize>,
        record_count: usize,
    ) -> Self {
        // Convert field data to JS array once
        let field_data_array = {
            let arr = Array::new();
            for field in &field_data {
                arr.push(&JsValue::from_str(field));
            }
            arr.into()
        };

        // Convert actual field counts to JS array
        let actual_field_counts_array = {
            let arr = Array::new();
            for count in &actual_field_counts {
                arr.push(&JsValue::from_f64(*count as f64));
            }
            arr.into()
        };

        Self {
            headers_array: headers_js_cache,
            field_data_array,
            actual_field_counts_array,
            record_count,
            field_count,
        }
    }

    /// Get headers as JsValue array (null if not yet parsed)
    #[wasm_bindgen(getter)]
    pub fn headers(&self) -> JsValue {
        self.headers_array.clone()
    }

    /// Get all field data as flat JsValue array
    #[wasm_bindgen(getter = fieldData)]
    pub fn field_data(&self) -> JsValue {
        self.field_data_array.clone()
    }

    /// Get actual field counts per record (for detecting missing/undefined fields)
    #[wasm_bindgen(getter = actualFieldCounts)]
    pub fn actual_field_counts(&self) -> JsValue {
        self.actual_field_counts_array.clone()
    }

    /// Get number of records
    #[wasm_bindgen(getter = recordCount)]
    pub fn record_count(&self) -> usize {
        self.record_count
    }

    /// Get field count per record
    #[wasm_bindgen(getter = fieldCount)]
    pub fn field_count(&self) -> usize {
        self.field_count
    }
}
