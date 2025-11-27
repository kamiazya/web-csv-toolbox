/// Helper function to escape CSV field with quotes
#[allow(dead_code)]
pub(crate) fn escape_csv_field(field: &str) -> String {
    if field.is_empty()
        || field.contains(',')
        || field.contains('"')
        || field.contains('\n')
        || field.contains('\r')
    {
        format!("\"{}\"", field.replace('"', "\"\""))
    } else {
        field.to_string()
    }
}

/// Helper function to create CSV string from headers and rows
#[allow(dead_code)]
pub(crate) fn create_csv(headers: &[String], rows: &[Vec<String>]) -> String {
    let mut csv = String::new();

    // Add headers
    csv.push_str(
        &headers
            .iter()
            .map(|h| escape_csv_field(h))
            .collect::<Vec<_>>()
            .join(","),
    );
    csv.push('\n');

    // Add rows
    for row in rows {
        csv.push_str(
            &row.iter()
                .map(|f| escape_csv_field(f))
                .collect::<Vec<_>>()
                .join(","),
        );
        csv.push('\n');
    }

    csv
}
