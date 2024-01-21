use csv::ReaderBuilder;
use serde_json::Value as JsonValue;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = parseString)]
pub fn parse_string(input: &str) -> JsValue {
    let mut rdr = ReaderBuilder::new().from_reader(input.as_bytes());
    let mut records = Vec::new();

    for result in rdr.records() {
        let record = result.unwrap();
        let fields = record
            .iter()
            .map(|field| JsonValue::String(field.to_string()))
            .collect::<Vec<_>>();
        records.push(JsonValue::Array(fields));
    }

    let json_str = serde_json::to_string(&records).unwrap();
    JsValue::from_str(&json_str)
}
