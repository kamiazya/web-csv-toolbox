use wasm_bindgen_test::*;

use crate::parser::CSVParser;

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test]
fn test_streaming_parse_simple() {
    let mut parser = CSVParser::new(b',');
    
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
    let mut parser = CSVParser::new(b',');
    
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
    let mut parser = CSVParser::new(b',');
    
    parser.process_chunk("name,description\n").unwrap();
    let result = parser.process_chunk("Alice,\"Hello, World\"\n").unwrap();
    
    let array: js_sys::Array = result.dyn_into().unwrap();
    assert_eq!(array.length(), 1);
}

#[wasm_bindgen_test]
fn test_streaming_parse_empty() {
    let mut parser = CSVParser::new(b',');
    
    parser.process_chunk("name,age\n").unwrap();
    let result = parser.flush().unwrap();
    
    let array: js_sys::Array = result.dyn_into().unwrap();
    assert_eq!(array.length(), 0);
}

#[wasm_bindgen_test]
fn test_streaming_parse_flush() {
    let mut parser = CSVParser::new(b',');
    
    parser.process_chunk("name,age\n").unwrap();
    parser.process_chunk("Alice,30").unwrap(); // No newline
    
    let result = parser.flush().unwrap();
    let array: js_sys::Array = result.dyn_into().unwrap();
    assert_eq!(array.length(), 1);
}

#[wasm_bindgen_test]
fn test_binary_processing_simple() {
    let mut parser = CSVParser::new(b',');
    
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
    let mut parser = CSVParser::new(b',');
    
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
    let mut parser = CSVParser::new(b',');
    
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
    let mut parser = CSVParser::new(b',');
    
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
    let mut parser = CSVParser::new(b',');
    
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
