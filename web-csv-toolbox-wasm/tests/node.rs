#![cfg(target_arch = "wasm32")]

use wasm_bindgen_test::*;

use web_csv_toolbox_wasm::*;

#[wasm_bindgen_test]
fn test_parse_string_to_array_sync() {
    let input = "name,age\nAlice,20\nBob,30\n";
    let demiliter = b',';
    let result = parse_string_to_array_sync(input, demiliter);

    let expected = r#"[{"age":"20","name":"Alice"},{"age":"30","name":"Bob"}]"#;
    assert_eq!(result, expected);
}
