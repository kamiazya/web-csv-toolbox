use criterion::{black_box, criterion_group, criterion_main, Criterion};
use csv::ReaderBuilder;
use serde_json::json;

fn parse_csv(input: &str, delimiter: u8) -> String {
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

fn benchmark_simple_csv(c: &mut Criterion) {
    let input = ["name,age", "Alice,30", "Bob,25"].join("\n");

    c.bench_function("parse simple csv", |b| {
        b.iter(|| parse_csv(black_box(&input), black_box(b',')))
    });
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

    c.bench_function("parse complex csv", |b| {
        b.iter(|| parse_csv(black_box(&input), black_box(b',')))
    });
}

fn benchmark_large_csv(c: &mut Criterion) {
    let mut lines = vec!["name,age,email,city".to_string()];
    for i in 0..1000 {
        lines.push(format!("User{},{},user{}@example.com,City{}", i, 20 + (i % 50), i, i % 100));
    }
    let input = lines.join("\n");

    c.bench_function("parse large csv (1000 rows)", |b| {
        b.iter(|| parse_csv(black_box(&input), black_box(b',')))
    });
}

fn benchmark_unicode_csv(c: &mut Criterion) {
    let input = ["名前,年齢", "太郎,30", "花子,25"].join("\n");

    c.bench_function("parse unicode csv", |b| {
        b.iter(|| parse_csv(black_box(&input), black_box(b',')))
    });
}

criterion_group!(
    benches,
    benchmark_simple_csv,
    benchmark_complex_csv,
    benchmark_large_csv,
    benchmark_unicode_csv
);
criterion_main!(benches);
