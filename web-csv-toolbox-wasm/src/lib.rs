use csv::ReaderBuilder;
use serde_json::json;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = parseStringToArraySync)]
pub fn parse_string_to_array_sync(input: &str, demiliter: u8) -> JsValue {
    let mut rdr = ReaderBuilder::new()
        .has_headers(true)
        .delimiter(demiliter)
        .from_reader(input.as_bytes());

    let headers = rdr.headers().unwrap().clone();

    let mut records = Vec::new();

    for result in rdr.records() {
        let record = result.unwrap();
        let mut json_record = json!({});
        for (i, field) in record.iter().enumerate() {
            json_record[&headers[i]] = json!(field);
        }
        records.push(json_record);
    }

    let json_str = serde_json::to_string(&records).unwrap();
    JsValue::from_str(&json_str)
}

#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;

    wasm_bindgen_test::wasm_bindgen_test_configure!(run_in_browser);

    #[wasm_bindgen_test]
    fn test_parse_string_to_array_sync() {
        let input = "name,age\nAlice,20\nBob,30\n";
        let demiliter = b',';
        let result = parse_string_to_array_sync(input, demiliter);

        let expected = r#"[{"age":"20","name":"Alice"},{"age":"30","name":"Bob"}]"#;
        assert_eq!(result, expected);
    }
}
