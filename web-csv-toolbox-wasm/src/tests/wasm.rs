use wasm_bindgen_test::*;

use crate::parser::CSVParserLegacy;
use crate::parser_optimized::CSVParserOptimized;

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test]
fn test_streaming_parse_simple() {
    let mut parser = CSVParserLegacy::new(b',');

    // Process header
    let result1 = parser.process_chunk("name,age\n").unwrap();
    assert_eq!(result1.as_f64(), Some(0.0)); // Empty array

    // Process first record
    let result2 = parser.process_chunk("Alice,30\n").unwrap();
    let array: js_sys::Array = result2.dyn_into().unwrap();
    assert_eq!(array.length(), 1);

    // Process second record
    let result3 = parser.process_chunk("Bob,25\n").unwrap();
    let array: js_sys::Array = result3.dyn_into().unwrap();
    assert_eq!(array.length(), 1);
}

#[wasm_bindgen_test]
fn test_streaming_parse_chunked() {
    let mut parser = CSVParserLegacy::new(b',');

    // Process in small chunks
    parser.process_chunk("na").unwrap();
    parser.process_chunk("me,age\nAl").unwrap();
    parser.process_chunk("ice,").unwrap();
    parser.process_chunk("30\n").unwrap();

    let result = parser.flush().unwrap();
    let array: js_sys::Array = result.dyn_into().unwrap();
    assert_eq!(array.length(), 1);
}

#[wasm_bindgen_test]
fn test_streaming_parse_with_quotes() {
    let mut parser = CSVParserLegacy::new(b',');

    parser.process_chunk("name,description\n").unwrap();
    let result = parser.process_chunk("Alice,\"Hello, World\"\n").unwrap();

    let array: js_sys::Array = result.dyn_into().unwrap();
    assert_eq!(array.length(), 1);
}

#[wasm_bindgen_test]
fn test_streaming_parse_empty() {
    let mut parser = CSVParserLegacy::new(b',');

    parser.process_chunk("name,age\n").unwrap();
    let result = parser.flush().unwrap();

    let array: js_sys::Array = result.dyn_into().unwrap();
    assert_eq!(array.length(), 0);
}

#[wasm_bindgen_test]
fn test_streaming_parse_flush() {
    let mut parser = CSVParserLegacy::new(b',');

    parser.process_chunk("name,age\n").unwrap();
    parser.process_chunk("Alice,30").unwrap(); // No newline

    let result = parser.flush().unwrap();
    let array: js_sys::Array = result.dyn_into().unwrap();
    assert_eq!(array.length(), 1);
}

#[wasm_bindgen_test]
fn test_binary_processing_simple() {
    let mut parser = CSVParserLegacy::new(b',');

    // Create a simple CSV as bytes
    let csv = "name,age\nAlice,30\nBob,25\n";
    let bytes = csv.as_bytes();

    // Create Uint8Array
    let uint8_array = js_sys::Uint8Array::new_with_length(bytes.len() as u32);
    uint8_array.copy_from(bytes);

    let result = parser.process_chunk_bytes(&uint8_array).unwrap();
    let array: js_sys::Array = result.dyn_into().unwrap();
    assert_eq!(array.length(), 2);
}

#[wasm_bindgen_test]
fn test_binary_processing_utf8_boundary() {
    let mut parser = CSVParserLegacy::new(b',');

    // Create CSV with multibyte UTF-8 characters
    let csv = "name,city\nAlice,東京\nBob,大阪\n";
    let bytes = csv.as_bytes();

    // Split at a point that might be in the middle of a multibyte sequence
    let split_point = bytes.len() / 2;

    let uint8_array1 = js_sys::Uint8Array::new_with_length(split_point as u32);
    uint8_array1.copy_from(&bytes[..split_point]);

    let uint8_array2 = js_sys::Uint8Array::new_with_length((bytes.len() - split_point) as u32);
    uint8_array2.copy_from(&bytes[split_point..]);

    parser.process_chunk_bytes(&uint8_array1).unwrap();
    parser.process_chunk_bytes(&uint8_array2).unwrap();

    let result = parser.flush().unwrap();
    let array: js_sys::Array = result.dyn_into().unwrap();
    assert_eq!(array.length(), 2);
}

#[wasm_bindgen_test]
fn test_binary_processing_chunked() {
    let mut parser = CSVParserLegacy::new(b',');

    let csv = "name,count\nitem1,5\nitem2,10\n";
    let bytes = csv.as_bytes();

    // Process in small chunks (5 bytes at a time)
    let mut offset = 0;
    while offset < bytes.len() {
        let chunk_size = std::cmp::min(5, bytes.len() - offset);
        let uint8_array = js_sys::Uint8Array::new_with_length(chunk_size as u32);
        uint8_array.copy_from(&bytes[offset..offset + chunk_size]);

        parser.process_chunk_bytes(&uint8_array).unwrap();
        offset += chunk_size;
    }

    let result = parser.flush().unwrap();
    let array: js_sys::Array = result.dyn_into().unwrap();
    assert_eq!(array.length(), 2);
}

#[wasm_bindgen_test]
fn test_binary_processing_empty() {
    let mut parser = CSVParserLegacy::new(b',');

    let csv = "name,count\n";
    let bytes = csv.as_bytes();
    let uint8_array = js_sys::Uint8Array::new_with_length(bytes.len() as u32);
    uint8_array.copy_from(bytes);

    let result = parser.process_chunk_bytes(&uint8_array).unwrap();
    let array: js_sys::Array = result.dyn_into().unwrap();
    assert_eq!(array.length(), 0);
}

#[wasm_bindgen_test]
fn test_proto_field() {
    let mut parser = CSVParserLegacy::new(b',');

    let csv = "__proto__,normal\nvalue1,value2\nvalue3,value4\n";
    let result = parser.process_chunk(csv).unwrap();

    let array: js_sys::Array = result.dyn_into().unwrap();
    assert_eq!(array.length(), 2);

    // Verify that __proto__ field is properly set
    let record0 = array.get(0);
    let obj: js_sys::Object = record0.dyn_into().unwrap();
    let proto_value = js_sys::Reflect::get(&obj, &"__proto__".into()).unwrap();
    assert_eq!(proto_value.as_string(), Some("value1".to_string()));
}

// ============================================================================
// CSVParserOptimized Tests
// ============================================================================

#[wasm_bindgen_test]
fn test_optimized_utf8_ascii_mixed() {
    // Test UTF-8 handling: ASCII followed by multi-byte characters
    // This is a critical test for the bulk copy optimization bug
    let options = js_sys::Object::new();
    js_sys::Reflect::set(&options, &"delimiter".into(), &",".into()).unwrap();

    let mut parser = CSVParserOptimized::new(options.into()).unwrap();

    // CSV with mixed ASCII and multi-byte UTF-8
    let csv = "name,city\nAlice,東京\nBob,大阪\nCharlie,ニューヨーク\n";
    let bytes = csv.as_bytes();
    let uint8_array = js_sys::Uint8Array::new_with_length(bytes.len() as u32);
    uint8_array.copy_from(bytes);

    let result = parser.process_chunk_bytes(&uint8_array).unwrap();
    let array: js_sys::Array = result.dyn_into().unwrap();
    assert_eq!(array.length(), 3, "Should have 3 records");

    // Verify first record
    let record0 = array.get(0);
    let obj0: js_sys::Object = record0.dyn_into().unwrap();
    let name0 = js_sys::Reflect::get(&obj0, &"name".into()).unwrap();
    let city0 = js_sys::Reflect::get(&obj0, &"city".into()).unwrap();
    assert_eq!(name0.as_string(), Some("Alice".to_string()));
    assert_eq!(
        city0.as_string(),
        Some("東京".to_string()),
        "UTF-8 should not be corrupted"
    );

    // Verify second record
    let record1 = array.get(1);
    let obj1: js_sys::Object = record1.dyn_into().unwrap();
    let name1 = js_sys::Reflect::get(&obj1, &"name".into()).unwrap();
    let city1 = js_sys::Reflect::get(&obj1, &"city".into()).unwrap();
    assert_eq!(name1.as_string(), Some("Bob".to_string()));
    assert_eq!(
        city1.as_string(),
        Some("大阪".to_string()),
        "UTF-8 should not be corrupted"
    );
}

#[wasm_bindgen_test]
fn test_optimized_utf8_chunked() {
    // Test UTF-8 handling with chunked input that might split multi-byte sequences
    let options = js_sys::Object::new();
    js_sys::Reflect::set(&options, &"delimiter".into(), &",".into()).unwrap();

    let mut parser = CSVParserOptimized::new(options.into()).unwrap();

    let csv = "name,city\nAlice,東京\nBob,大阪\n";
    let bytes = csv.as_bytes();

    // Process in small chunks that might split UTF-8 sequences
    let chunk_size = 5;
    let mut offset = 0;
    while offset < bytes.len() {
        let end = std::cmp::min(offset + chunk_size, bytes.len());
        let uint8_array = js_sys::Uint8Array::new_with_length((end - offset) as u32);
        uint8_array.copy_from(&bytes[offset..end]);
        parser.process_chunk_bytes(&uint8_array).unwrap();
        offset = end;
    }

    let result = parser.flush().unwrap();
    let array: js_sys::Array = result.dyn_into().unwrap();
    assert_eq!(array.length(), 2, "Should have 2 records");

    // Verify UTF-8 integrity
    let record0 = array.get(0);
    let obj0: js_sys::Object = record0.dyn_into().unwrap();
    let city0 = js_sys::Reflect::get(&obj0, &"city".into()).unwrap();
    assert_eq!(
        city0.as_string(),
        Some("東京".to_string()),
        "UTF-8 should be preserved across chunks"
    );
}

#[wasm_bindgen_test]
fn test_optimized_missing_fields() {
    // Test handling of records with missing fields (should fill with empty strings)
    let options = js_sys::Object::new();
    js_sys::Reflect::set(&options, &"delimiter".into(), &",".into()).unwrap();

    let mut parser = CSVParserOptimized::new(options.into()).unwrap();

    // CSV with missing fields
    let csv = "name,age,city\nAlice,30,Tokyo\nBob\nCharlie,25\n";
    let bytes = csv.as_bytes();
    let uint8_array = js_sys::Uint8Array::new_with_length(bytes.len() as u32);
    uint8_array.copy_from(bytes);

    let result = parser.process_chunk_bytes(&uint8_array).unwrap();
    let array: js_sys::Array = result.dyn_into().unwrap();
    assert_eq!(array.length(), 3, "Should have 3 records");

    // Verify first record (complete)
    let record0 = array.get(0);
    let obj0: js_sys::Object = record0.dyn_into().unwrap();
    let name0 = js_sys::Reflect::get(&obj0, &"name".into()).unwrap();
    let age0 = js_sys::Reflect::get(&obj0, &"age".into()).unwrap();
    let city0 = js_sys::Reflect::get(&obj0, &"city".into()).unwrap();
    assert_eq!(name0.as_string(), Some("Alice".to_string()));
    assert_eq!(age0.as_string(), Some("30".to_string()));
    assert_eq!(city0.as_string(), Some("Tokyo".to_string()));

    // Verify second record (missing age and city)
    let record1 = array.get(1);
    let obj1: js_sys::Object = record1.dyn_into().unwrap();
    let name1 = js_sys::Reflect::get(&obj1, &"name".into()).unwrap();
    let age1 = js_sys::Reflect::get(&obj1, &"age".into()).unwrap();
    let city1 = js_sys::Reflect::get(&obj1, &"city".into()).unwrap();
    assert_eq!(name1.as_string(), Some("Bob".to_string()));
    assert_eq!(
        age1.as_string(),
        Some("".to_string()),
        "Missing field should be empty string"
    );
    assert_eq!(
        city1.as_string(),
        Some("".to_string()),
        "Missing field should be empty string"
    );

    // Verify third record (missing city)
    let record2 = array.get(2);
    let obj2: js_sys::Object = record2.dyn_into().unwrap();
    let name2 = js_sys::Reflect::get(&obj2, &"name".into()).unwrap();
    let age2 = js_sys::Reflect::get(&obj2, &"age".into()).unwrap();
    let city2 = js_sys::Reflect::get(&obj2, &"city".into()).unwrap();
    assert_eq!(name2.as_string(), Some("Charlie".to_string()));
    assert_eq!(age2.as_string(), Some("25".to_string()));
    assert_eq!(
        city2.as_string(),
        Some("".to_string()),
        "Missing field should be empty string"
    );
}

#[wasm_bindgen_test]
fn test_optimized_empty_lines() {
    // Test handling of empty lines
    let options = js_sys::Object::new();
    js_sys::Reflect::set(&options, &"delimiter".into(), &",".into()).unwrap();

    let mut parser = CSVParserOptimized::new(options.into()).unwrap();

    let csv = "name,age\nAlice,30\n\nBob,25\n";
    let bytes = csv.as_bytes();
    let uint8_array = js_sys::Uint8Array::new_with_length(bytes.len() as u32);
    uint8_array.copy_from(bytes);

    let result = parser.process_chunk_bytes(&uint8_array).unwrap();
    let array: js_sys::Array = result.dyn_into().unwrap();

    // Empty lines should be skipped (or handled gracefully)
    assert!(array.length() >= 2, "Should have at least 2 records");
}

#[wasm_bindgen_test]
fn test_optimized_quoted_fields() {
    // Test quoted fields with special characters
    let options = js_sys::Object::new();
    js_sys::Reflect::set(&options, &"delimiter".into(), &",".into()).unwrap();

    let mut parser = CSVParserOptimized::new(options.into()).unwrap();

    let csv = "name,description\nAlice,\"Hello, World\"\nBob,\"Contains \"\"quotes\"\"\"\n";
    let bytes = csv.as_bytes();
    let uint8_array = js_sys::Uint8Array::new_with_length(bytes.len() as u32);
    uint8_array.copy_from(bytes);

    let result = parser.process_chunk_bytes(&uint8_array).unwrap();
    let array: js_sys::Array = result.dyn_into().unwrap();
    assert_eq!(array.length(), 2);

    // Verify quoted field handling
    let record0 = array.get(0);
    let obj0: js_sys::Object = record0.dyn_into().unwrap();
    let desc0 = js_sys::Reflect::get(&obj0, &"description".into()).unwrap();
    assert_eq!(desc0.as_string(), Some("Hello, World".to_string()));

    let record1 = array.get(1);
    let obj1: js_sys::Object = record1.dyn_into().unwrap();
    let desc1 = js_sys::Reflect::get(&obj1, &"description".into()).unwrap();
    assert_eq!(desc1.as_string(), Some("Contains \"quotes\"".to_string()));
}
