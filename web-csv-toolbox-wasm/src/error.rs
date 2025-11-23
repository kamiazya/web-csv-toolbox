/// Format error message with optional source information
pub(crate) fn format_error(message: String, source: Option<&str>) -> String {
    match source {
        Some(src) => format!("{} in \"{}\"", message, src),
        None => message,
    }
}
