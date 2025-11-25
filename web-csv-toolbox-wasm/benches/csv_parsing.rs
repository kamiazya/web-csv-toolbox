//! CSV Parsing Benchmarks
//!
//! This benchmark suite tests rust-csv as a baseline for comparison.
//! WASM-specific benchmarks are run separately via JavaScript (see benchmark/ directory).
//!
//! Benchmark categories:
//! - Simple: Basic CSV with few rows/columns
//! - Complex: Multiple rows with various data types
//! - Large: Many rows (1000+)
//! - Unicode: Non-ASCII characters (Japanese, emoji, etc.)
//! - Quoted: Fields with special characters requiring quotes
//! - Wide: Many columns per row
//! - Delimiters: Different delimiter characters (tab, semicolon)
//! - Edge cases: Empty fields, single column/row, etc.

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use csv::ReaderBuilder;
use serde_json::json;

/// Parse CSV using rust-csv (baseline for comparison)
fn parse_csv_rustcsv(input: &str, delimiter: u8) -> String {
    let mut rdr = ReaderBuilder::new()
        .has_headers(true)
        .delimiter(delimiter)
        .from_reader(input.as_bytes());

    let headers = rdr.headers().unwrap().clone();
    let mut records = Vec::new();

    for result in rdr.records() {
        let record = result.unwrap();
        let mut json_record = json!({});
        for (i, field) in record.iter().enumerate() {
            if let Some(header) = headers.get(i) {
                json_record[header] = json!(field);
            }
        }
        records.push(json_record);
    }

    serde_json::to_string(&records).unwrap()
}

// =============================================================================
// Basic Benchmarks
// =============================================================================

fn benchmark_simple_csv(c: &mut Criterion) {
    let input = ["name,age", "Alice,30", "Bob,25"].join("\n");

    let mut group = c.benchmark_group("simple_csv");
    group.bench_with_input(BenchmarkId::new("rust-csv", "simple"), &input, |b, i| {
        b.iter(|| parse_csv_rustcsv(black_box(i), black_box(b',')))
    });
    group.finish();
}

fn benchmark_complex_csv(c: &mut Criterion) {
    let input = [
        "name,age,email,city",
        "Alice,30,alice@example.com,New York",
        "Bob,25,bob@example.com,San Francisco",
        "Charlie,35,charlie@example.com,Los Angeles",
        "David,28,david@example.com,Chicago",
        "Eve,32,eve@example.com,Houston",
    ]
    .join("\n");

    let mut group = c.benchmark_group("complex_csv");
    group.bench_with_input(BenchmarkId::new("rust-csv", "complex"), &input, |b, i| {
        b.iter(|| parse_csv_rustcsv(black_box(i), black_box(b',')))
    });
    group.finish();
}

// =============================================================================
// Large Data Benchmarks
// =============================================================================

fn benchmark_large_csv(c: &mut Criterion) {
    let mut lines = vec!["name,age,email,city".to_string()];
    for i in 0..1000 {
        lines.push(format!(
            "User{},{},user{}@example.com,City{}",
            i,
            20 + (i % 50),
            i,
            i % 100
        ));
    }
    let input = lines.join("\n");

    let mut group = c.benchmark_group("large_csv");
    group.bench_with_input(BenchmarkId::new("rust-csv", "1000_rows"), &input, |b, i| {
        b.iter(|| parse_csv_rustcsv(black_box(i), black_box(b',')))
    });
    group.finish();
}

fn benchmark_very_large_csv(c: &mut Criterion) {
    let mut lines = vec!["id,name,value,category,timestamp".to_string()];
    for i in 0..10000 {
        lines.push(format!(
            "{},Item{},{:.2},Category{},2024-01-{:02}T{:02}:00:00Z",
            i,
            i,
            (i as f64) * 1.5,
            i % 10,
            (i % 28) + 1,
            i % 24
        ));
    }
    let input = lines.join("\n");

    let mut group = c.benchmark_group("very_large_csv");
    group.sample_size(50); // Reduce sample size for large data
    group.bench_with_input(
        BenchmarkId::new("rust-csv", "10000_rows"),
        &input,
        |b, i| b.iter(|| parse_csv_rustcsv(black_box(i), black_box(b','))),
    );
    group.finish();
}

// =============================================================================
// Unicode Benchmarks
// =============================================================================

fn benchmark_unicode_csv(c: &mut Criterion) {
    let input = ["名前,年齢", "太郎,30", "花子,25"].join("\n");

    let mut group = c.benchmark_group("unicode_csv");
    group.bench_with_input(BenchmarkId::new("rust-csv", "japanese"), &input, |b, i| {
        b.iter(|| parse_csv_rustcsv(black_box(i), black_box(b',')))
    });
    group.finish();
}

fn benchmark_unicode_mixed(c: &mut Criterion) {
    let input = [
        "name,city,emoji,description",
        "田中太郎,東京,🗼,日本の首都",
        "김철수,서울,🇰🇷,대한민국",
        "Müller,München,🍺,Deutschland",
        "Иванов,Москва,🏰,Россия",
        "José García,México,🌮,América Latina",
    ]
    .join("\n");

    let mut group = c.benchmark_group("unicode_mixed");
    group.bench_with_input(
        BenchmarkId::new("rust-csv", "multilingual"),
        &input,
        |b, i| b.iter(|| parse_csv_rustcsv(black_box(i), black_box(b','))),
    );
    group.finish();
}

fn benchmark_unicode_large(c: &mut Criterion) {
    let names = [
        "田中", "佐藤", "鈴木", "高橋", "伊藤", "渡辺", "山本", "中村",
    ];
    let cities = [
        "東京",
        "大阪",
        "名古屋",
        "札幌",
        "福岡",
        "横浜",
        "神戸",
        "京都",
    ];

    let mut lines = vec!["名前,都市,年齢,メール".to_string()];
    for i in 0..500 {
        lines.push(format!(
            "{}太郎{},{},{},user{}@example.jp",
            names[i % names.len()],
            i,
            cities[i % cities.len()],
            20 + (i % 50),
            i
        ));
    }
    let input = lines.join("\n");

    let mut group = c.benchmark_group("unicode_large");
    group.bench_with_input(
        BenchmarkId::new("rust-csv", "500_japanese_rows"),
        &input,
        |b, i| b.iter(|| parse_csv_rustcsv(black_box(i), black_box(b','))),
    );
    group.finish();
}

// =============================================================================
// Quoted Fields Benchmarks
// =============================================================================

fn benchmark_quoted_simple(c: &mut Criterion) {
    let input = [
        "name,description,value",
        "\"Alice\",\"A simple description\",100",
        "\"Bob\",\"Another description\",200",
        "\"Charlie\",\"Yet another one\",300",
    ]
    .join("\n");

    let mut group = c.benchmark_group("quoted_simple");
    group.bench_with_input(
        BenchmarkId::new("rust-csv", "basic_quotes"),
        &input,
        |b, i| b.iter(|| parse_csv_rustcsv(black_box(i), black_box(b','))),
    );
    group.finish();
}

fn benchmark_quoted_with_commas(c: &mut Criterion) {
    let input = [
        "name,address,notes",
        "\"Smith, John\",\"123 Main St, Apt 4\",\"Contact: Mon, Wed, Fri\"",
        "\"Doe, Jane\",\"456 Oak Ave, Suite 100\",\"Available: Tue, Thu\"",
        "\"Brown, Bob\",\"789 Pine Rd, Building A\",\"Hours: 9-5, M-F\"",
    ]
    .join("\n");

    let mut group = c.benchmark_group("quoted_with_commas");
    group.bench_with_input(
        BenchmarkId::new("rust-csv", "embedded_commas"),
        &input,
        |b, i| b.iter(|| parse_csv_rustcsv(black_box(i), black_box(b','))),
    );
    group.finish();
}

fn benchmark_quoted_with_newlines(c: &mut Criterion) {
    let input = [
        "name,bio,contact",
        "\"Alice\",\"Line 1\nLine 2\nLine 3\",\"alice@example.com\"",
        "\"Bob\",\"First paragraph.\n\nSecond paragraph.\",\"bob@example.com\"",
        "\"Charlie\",\"Item 1\nItem 2\nItem 3\nItem 4\",\"charlie@example.com\"",
    ]
    .join("\n");

    let mut group = c.benchmark_group("quoted_with_newlines");
    group.bench_with_input(
        BenchmarkId::new("rust-csv", "embedded_newlines"),
        &input,
        |b, i| b.iter(|| parse_csv_rustcsv(black_box(i), black_box(b','))),
    );
    group.finish();
}

fn benchmark_quoted_with_escaped_quotes(c: &mut Criterion) {
    let input = [
        "name,quote,source",
        "\"Author A\",\"He said \"\"Hello\"\" to me\",\"Book 1\"",
        "\"Author B\",\"\"\"To be or not to be\"\"\",\"Shakespeare\"",
        "\"Author C\",\"She replied \"\"Yes\"\" and \"\"No\"\"\",\"Interview\"",
    ]
    .join("\n");

    let mut group = c.benchmark_group("quoted_with_escaped_quotes");
    group.bench_with_input(
        BenchmarkId::new("rust-csv", "escaped_quotes"),
        &input,
        |b, i| b.iter(|| parse_csv_rustcsv(black_box(i), black_box(b','))),
    );
    group.finish();
}

fn benchmark_quoted_complex(c: &mut Criterion) {
    // Mix of all quoted field challenges
    let input = [
        "id,name,description,notes",
        "1,\"Smith, John\",\"Line 1\nLine 2\",\"Said \"\"yes\"\"\"",
        "2,\"Doe, Jane\",\"Para 1\n\nPara 2\",\"Reply: \"\"maybe, later\"\"\"",
        "3,\"O'Brien\",\"Special: @#$%^&*()\",\"Quote: \"\"test\"\", end\"",
    ]
    .join("\n");

    let mut group = c.benchmark_group("quoted_complex");
    group.bench_with_input(
        BenchmarkId::new("rust-csv", "mixed_special_chars"),
        &input,
        |b, i| b.iter(|| parse_csv_rustcsv(black_box(i), black_box(b','))),
    );
    group.finish();
}

fn benchmark_quoted_large(c: &mut Criterion) {
    let mut lines = vec!["id,name,description,details".to_string()];
    for i in 0..500 {
        lines.push(format!(
            "{},\"User {}, Jr.\",\"Description with, comma\",\"Detail \"\"{}\"\"\"",
            i, i, i
        ));
    }
    let input = lines.join("\n");

    let mut group = c.benchmark_group("quoted_large");
    group.bench_with_input(
        BenchmarkId::new("rust-csv", "500_quoted_rows"),
        &input,
        |b, i| b.iter(|| parse_csv_rustcsv(black_box(i), black_box(b','))),
    );
    group.finish();
}

// =============================================================================
// Wide CSV Benchmarks (Many Columns)
// =============================================================================

fn benchmark_wide_csv(c: &mut Criterion) {
    let num_cols = 50;
    let headers: Vec<String> = (0..num_cols).map(|i| format!("col{}", i)).collect();
    let header_line = headers.join(",");

    let mut lines = vec![header_line];
    for row in 0..100 {
        let values: Vec<String> = (0..num_cols)
            .map(|col| format!("r{}c{}", row, col))
            .collect();
        lines.push(values.join(","));
    }
    let input = lines.join("\n");

    let mut group = c.benchmark_group("wide_csv");
    group.bench_with_input(
        BenchmarkId::new("rust-csv", "50_columns"),
        &input,
        |b, i| b.iter(|| parse_csv_rustcsv(black_box(i), black_box(b','))),
    );
    group.finish();
}

fn benchmark_very_wide_csv(c: &mut Criterion) {
    let num_cols = 200;
    let headers: Vec<String> = (0..num_cols).map(|i| format!("field{}", i)).collect();
    let header_line = headers.join(",");

    let mut lines = vec![header_line];
    for row in 0..50 {
        let values: Vec<String> = (0..num_cols)
            .map(|col| format!("v{}_{}", row, col))
            .collect();
        lines.push(values.join(","));
    }
    let input = lines.join("\n");

    let mut group = c.benchmark_group("very_wide_csv");
    group.bench_with_input(
        BenchmarkId::new("rust-csv", "200_columns"),
        &input,
        |b, i| b.iter(|| parse_csv_rustcsv(black_box(i), black_box(b','))),
    );
    group.finish();
}

// =============================================================================
// Different Delimiters
// =============================================================================

fn benchmark_tab_delimited(c: &mut Criterion) {
    let input = [
        "name\tage\temail\tcity",
        "Alice\t30\talice@example.com\tNew York",
        "Bob\t25\tbob@example.com\tSan Francisco",
        "Charlie\t35\tcharlie@example.com\tLos Angeles",
    ]
    .join("\n");

    let mut group = c.benchmark_group("tab_delimited");
    group.bench_with_input(BenchmarkId::new("rust-csv", "tsv"), &input, |b, i| {
        b.iter(|| parse_csv_rustcsv(black_box(i), black_box(b'\t')))
    });
    group.finish();
}

fn benchmark_semicolon_delimited(c: &mut Criterion) {
    let input = [
        "name;age;email;city",
        "Alice;30;alice@example.com;New York",
        "Bob;25;bob@example.com;San Francisco",
        "Charlie;35;charlie@example.com;Los Angeles",
    ]
    .join("\n");

    let mut group = c.benchmark_group("semicolon_delimited");
    group.bench_with_input(BenchmarkId::new("rust-csv", "semicolon"), &input, |b, i| {
        b.iter(|| parse_csv_rustcsv(black_box(i), black_box(b';')))
    });
    group.finish();
}

fn benchmark_pipe_delimited(c: &mut Criterion) {
    let input = [
        "name|age|email|city",
        "Alice|30|alice@example.com|New York",
        "Bob|25|bob@example.com|San Francisco",
        "Charlie|35|charlie@example.com|Los Angeles",
    ]
    .join("\n");

    let mut group = c.benchmark_group("pipe_delimited");
    group.bench_with_input(BenchmarkId::new("rust-csv", "pipe"), &input, |b, i| {
        b.iter(|| parse_csv_rustcsv(black_box(i), black_box(b'|')))
    });
    group.finish();
}

// =============================================================================
// Edge Cases
// =============================================================================

fn benchmark_empty_fields(c: &mut Criterion) {
    let input = ["a,b,c,d", "1,,,4", ",2,,", ",,3,", ",,,", "1,2,3,4"].join("\n");

    let mut group = c.benchmark_group("empty_fields");
    group.bench_with_input(
        BenchmarkId::new("rust-csv", "sparse_data"),
        &input,
        |b, i| b.iter(|| parse_csv_rustcsv(black_box(i), black_box(b','))),
    );
    group.finish();
}

fn benchmark_single_column(c: &mut Criterion) {
    let mut lines = vec!["value".to_string()];
    for i in 0..1000 {
        lines.push(format!("item{}", i));
    }
    let input = lines.join("\n");

    let mut group = c.benchmark_group("single_column");
    group.bench_with_input(
        BenchmarkId::new("rust-csv", "1000_single_col"),
        &input,
        |b, i| b.iter(|| parse_csv_rustcsv(black_box(i), black_box(b','))),
    );
    group.finish();
}

fn benchmark_single_row(c: &mut Criterion) {
    let headers: Vec<String> = (0..100).map(|i| format!("col{}", i)).collect();
    let values: Vec<String> = (0..100).map(|i| format!("val{}", i)).collect();
    let input = format!("{}\n{}", headers.join(","), values.join(","));

    let mut group = c.benchmark_group("single_row");
    group.bench_with_input(
        BenchmarkId::new("rust-csv", "100_cols_1_row"),
        &input,
        |b, i| b.iter(|| parse_csv_rustcsv(black_box(i), black_box(b','))),
    );
    group.finish();
}

fn benchmark_long_fields(c: &mut Criterion) {
    let long_text = "x".repeat(1000);
    let input = [
        "id,content,summary",
        &format!("1,{},short", long_text),
        &format!("2,{},brief", long_text),
        &format!("3,{},tiny", long_text),
    ]
    .join("\n");

    let mut group = c.benchmark_group("long_fields");
    group.bench_with_input(
        BenchmarkId::new("rust-csv", "1000_char_fields"),
        &input,
        |b, i| b.iter(|| parse_csv_rustcsv(black_box(i), black_box(b','))),
    );
    group.finish();
}

fn benchmark_numeric_data(c: &mut Criterion) {
    let mut lines = vec!["int,float,scientific,negative".to_string()];
    for i in 0..500 {
        lines.push(format!(
            "{},{:.6},{:.2e},{}",
            i,
            (i as f64) * 0.123456,
            (i as f64) * 1000.0,
            -i
        ));
    }
    let input = lines.join("\n");

    let mut group = c.benchmark_group("numeric_data");
    group.bench_with_input(
        BenchmarkId::new("rust-csv", "500_numeric_rows"),
        &input,
        |b, i| b.iter(|| parse_csv_rustcsv(black_box(i), black_box(b','))),
    );
    group.finish();
}

fn benchmark_crlf_line_endings(c: &mut Criterion) {
    let input = [
        "name,age,city",
        "Alice,30,New York",
        "Bob,25,Los Angeles",
        "Charlie,35,Chicago",
    ]
    .join("\r\n");

    let mut group = c.benchmark_group("crlf_line_endings");
    group.bench_with_input(
        BenchmarkId::new("rust-csv", "windows_style"),
        &input,
        |b, i| b.iter(|| parse_csv_rustcsv(black_box(i), black_box(b','))),
    );
    group.finish();
}

fn benchmark_mixed_line_endings(c: &mut Criterion) {
    // Some lines with \n, some with \r\n
    let input = "name,age,city\nAlice,30,New York\r\nBob,25,Los Angeles\nCharlie,35,Chicago\r\n";

    let mut group = c.benchmark_group("mixed_line_endings");
    group.bench_with_input(
        BenchmarkId::new("rust-csv", "mixed_eol"),
        &input.to_string(),
        |b, i| b.iter(|| parse_csv_rustcsv(black_box(i), black_box(b','))),
    );
    group.finish();
}

// =============================================================================
// Criterion Group Configuration
// =============================================================================

criterion_group!(basic_benches, benchmark_simple_csv, benchmark_complex_csv,);

criterion_group!(large_benches, benchmark_large_csv, benchmark_very_large_csv,);

criterion_group!(
    unicode_benches,
    benchmark_unicode_csv,
    benchmark_unicode_mixed,
    benchmark_unicode_large,
);

criterion_group!(
    quoted_benches,
    benchmark_quoted_simple,
    benchmark_quoted_with_commas,
    benchmark_quoted_with_newlines,
    benchmark_quoted_with_escaped_quotes,
    benchmark_quoted_complex,
    benchmark_quoted_large,
);

criterion_group!(wide_benches, benchmark_wide_csv, benchmark_very_wide_csv,);

criterion_group!(
    delimiter_benches,
    benchmark_tab_delimited,
    benchmark_semicolon_delimited,
    benchmark_pipe_delimited,
);

criterion_group!(
    edge_case_benches,
    benchmark_empty_fields,
    benchmark_single_column,
    benchmark_single_row,
    benchmark_long_fields,
    benchmark_numeric_data,
    benchmark_crlf_line_endings,
    benchmark_mixed_line_endings,
);

criterion_main!(
    basic_benches,
    large_benches,
    unicode_benches,
    quoted_benches,
    wide_benches,
    delimiter_benches,
    edge_case_benches,
);
