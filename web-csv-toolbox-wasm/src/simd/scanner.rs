//! SIMD byte scanner for CSV parsing
//!
//! This module provides SIMD-accelerated scanning of CSV data to identify
//! separator positions (delimiters and line endings) while correctly handling
//! quoted fields.
//!
//! # Algorithm
//!
//! The scanner uses WebAssembly SIMD128 instructions to process 16 bytes at a time:
//!
//! 1. Load 16 bytes into a v128 register
//! 2. Compare against delimiter, quote, and newline patterns
//! 3. Extract bitmasks for each pattern
//! 4. Track quote state using XOR parity (inspired by WebGPU implementation)
//! 5. Output separator positions only when outside quotes
//!
//! # Quote State Tracking
//!
//! Quote state is tracked using XOR parity:
//! - `in_quote ^= 1` each time a quote character is encountered
//! - This naturally handles escaped quotes (`""`) because two XORs cancel out
//!
//! # Packed Separator Format
//!
//! Separators are packed into u32 values:
//! - Bits 0-30: byte offset (supports up to 2GB)
//! - Bit 31: separator type (0 = comma/delimiter, 1 = line feed)

use std::borrow::Cow;

#[cfg(target_arch = "wasm32")]
use core::arch::wasm32::*;

/// Separator type: delimiter (comma by default)
pub const SEP_DELIMITER: u32 = 0;

/// Separator type: line feed
pub const SEP_LF: u32 = 1;

/// Pack separator position and type into a single u32
///
/// # Arguments
/// * `offset` - Byte offset (0-30 bits, max 2GB)
/// * `sep_type` - Separator type (SEP_DELIMITER or SEP_LF)
///
/// # Returns
/// Packed u32 with offset in bits 0-30 and type in bit 31
#[inline]
pub const fn pack_separator(offset: u32, sep_type: u32) -> u32 {
    offset | (sep_type << 31)
}

/// Unpack separator position from packed u32
#[inline]
pub const fn unpack_offset(packed: u32) -> u32 {
    packed & 0x7FFF_FFFF
}

/// Unpack separator type from packed u32
#[inline]
pub const fn unpack_type(packed: u32) -> u32 {
    packed >> 31
}

// =============================================================================
// Extended Pack Format (with quote metadata)
// =============================================================================

/// Pack separator with quote flag (extended format)
///
/// Extended format:
/// - Bits 0-29: byte offset (max 1GB)
/// - Bit 30: is_quoted flag (1 = field is quoted)
/// - Bit 31: separator type (0 = delimiter, 1 = LF)
#[inline]
pub const fn pack_separator_extended(offset: u32, is_quoted: bool, sep_type: u32) -> u32 {
    (offset & 0x3FFF_FFFF) | ((is_quoted as u32) << 30) | (sep_type << 31)
}

/// Unpack offset from extended format
#[inline]
pub const fn unpack_offset_extended(packed: u32) -> u32 {
    packed & 0x3FFF_FFFF
}

/// Unpack is_quoted flag from extended format
#[inline]
pub const fn unpack_is_quoted(packed: u32) -> bool {
    (packed & 0x4000_0000) != 0
}

/// Unpack separator type from extended format
#[inline]
pub const fn unpack_type_extended(packed: u32) -> u32 {
    packed >> 31
}

/// Maximum offset that can be represented in extended format (30 bits = ~1GB)
pub const MAX_OFFSET_EXTENDED: u32 = 0x3FFF_FFFF;

/// Result of extended scanning with quote metadata
#[derive(Debug, Default)]
pub struct ScanResultExtended {
    /// Packed separator positions (extended format with is_quoted flag)
    pub separators: Vec<u32>,
    /// Bitmap: 1 bit per field, set if field contains escaped quotes ("")
    pub unescape_flags: Vec<u32>,
    /// Final quote state (0 = outside quotes, 1 = inside quotes)
    pub end_in_quote: u32,
    /// Error message if offset overflow occurred (None if no error)
    pub error: Option<String>,
}

/// Result of scanning a chunk of CSV data
#[derive(Debug, Default)]
pub struct ScanResult {
    /// Packed separator positions
    pub separators: Vec<u32>,
    /// Final quote state (0 = outside quotes, 1 = inside quotes)
    pub end_in_quote: u32,
}

/// Result of scanning with character offsets (UTF-8 aware)
#[derive(Debug, Default)]
pub struct ScanResultCharOffset {
    /// Packed separator positions (character offsets, not byte offsets)
    pub separators: Vec<u32>,
    /// Final quote state (0 = outside quotes, 1 = inside quotes)
    pub end_in_quote: u32,
    /// Final character offset (for continuation)
    pub end_char_offset: u32,
}

/// SIMD byte scanner for CSV data
///
/// This struct maintains state across multiple scan calls for streaming support.
pub struct SimdScanner {
    /// Current quote state (0 = outside, 1 = inside)
    in_quote: u32,
    /// Delimiter character (default: comma)
    delimiter: u8,
    /// Quote character (default: double quote)
    quote: u8,
}

impl SimdScanner {
    /// Create a new SIMD scanner with default settings
    pub fn new() -> Self {
        Self {
            in_quote: 0,
            delimiter: b',',
            quote: b'"',
        }
    }

    /// Create a new SIMD scanner with custom delimiter and quote characters
    pub fn with_options(delimiter: u8, quote: u8) -> Self {
        Self {
            in_quote: 0,
            delimiter,
            quote,
        }
    }

    /// Reset the scanner state for reuse
    pub fn reset(&mut self) {
        self.in_quote = 0;
    }

    /// Get the current quote state
    pub fn in_quote(&self) -> bool {
        self.in_quote != 0
    }

    /// Set the quote state for streaming continuation
    ///
    /// This allows restoring the quote state when resuming a streaming scan.
    /// Typically used when the previous chunk ended inside a quoted field.
    ///
    /// # Arguments
    /// * `in_quote` - true if currently inside a quoted field
    pub fn set_in_quote(&mut self, in_quote: bool) {
        self.in_quote = if in_quote { 1 } else { 0 };
    }

    /// Scan a chunk of CSV data and return separator positions
    ///
    /// # Arguments
    /// * `chunk` - The CSV data to scan
    /// * `base_offset` - Base offset to add to all separator positions
    ///
    /// # Returns
    /// ScanResult containing packed separator positions and final quote state
    ///
    /// # Safety
    /// This function uses SIMD intrinsics which require the simd128 target feature.
    #[cfg(target_arch = "wasm32")]
    pub fn scan(&mut self, chunk: &[u8], base_offset: u32) -> ScanResult {
        // SAFETY: We're calling the unsafe SIMD function with valid parameters
        unsafe { self.scan_simd(chunk, base_offset) }
    }

    /// Non-WASM fallback (for testing on native platforms)
    #[cfg(not(target_arch = "wasm32"))]
    pub fn scan(&mut self, chunk: &[u8], base_offset: u32) -> ScanResult {
        self.scan_scalar(chunk, base_offset)
    }

    /// SIMD-accelerated scanning implementation
    ///
    /// # Safety
    /// Requires simd128 target feature to be enabled.
    #[cfg(target_arch = "wasm32")]
    #[target_feature(enable = "simd128")]
    unsafe fn scan_simd(&mut self, chunk: &[u8], base_offset: u32) -> ScanResult {
        let len = chunk.len();
        let mut separators = Vec::with_capacity(len / 4); // Estimate ~25% separator density
        let mut i = 0usize;

        // SIMD constants - splat single bytes to all 16 lanes
        let delim_vec = u8x16_splat(self.delimiter);
        let quote_vec = u8x16_splat(self.quote);
        let lf_vec = u8x16_splat(b'\n');

        // Process 16-byte aligned chunks
        while i + 16 <= len {
            // Load 16 bytes (unaligned load is fine for WASM)
            let data = v128_load(chunk.as_ptr().add(i) as *const v128);

            // Compare against patterns - returns 0xFF for match, 0x00 for no match
            let delim_matches = u8x16_eq(data, delim_vec);
            let quote_matches = u8x16_eq(data, quote_vec);
            let lf_matches = u8x16_eq(data, lf_vec);

            // Extract bitmasks - each bit represents one of the 16 bytes
            let delim_mask = u8x16_bitmask(delim_matches);
            let quote_mask = u8x16_bitmask(quote_matches);
            let lf_mask = u8x16_bitmask(lf_matches);

            // Fast path: no quotes in this chunk, just emit separators
            if quote_mask == 0 && self.in_quote == 0 {
                // Process separators in offset order by combining masks
                // This ensures separators are emitted in correct order for field extraction
                let mut combined = delim_mask | lf_mask;
                while combined != 0 {
                    let j = combined.trailing_zeros();
                    let bit = 1u16 << j;
                    let pos = base_offset + i as u32 + j;

                    // Check which type this separator is
                    if (delim_mask & bit) != 0 {
                        separators.push(pack_separator(pos, SEP_DELIMITER));
                    } else {
                        separators.push(pack_separator(pos, SEP_LF));
                    }

                    combined &= combined - 1; // Clear lowest set bit
                }
            } else {
                // Slow path: need to track quote state byte-by-byte
                // This is still faster than csv-core because we only do it when quotes are present
                for j in 0..16u32 {
                    let bit = 1u16 << j;
                    let pos = base_offset + i as u32 + j;

                    // Update quote state (XOR toggle)
                    if (quote_mask & bit) != 0 {
                        self.in_quote ^= 1;
                    } else if self.in_quote == 0 {
                        // Only emit separators outside quotes
                        if (delim_mask & bit) != 0 {
                            separators.push(pack_separator(pos, SEP_DELIMITER));
                        } else if (lf_mask & bit) != 0 {
                            separators.push(pack_separator(pos, SEP_LF));
                        }
                    }
                }
            }

            i += 16;
        }

        // Scalar fallback for remaining bytes
        while i < len {
            let byte = chunk[i];
            let pos = base_offset + i as u32;

            if byte == self.quote {
                self.in_quote ^= 1;
            } else if self.in_quote == 0 {
                if byte == self.delimiter {
                    separators.push(pack_separator(pos, SEP_DELIMITER));
                } else if byte == b'\n' {
                    separators.push(pack_separator(pos, SEP_LF));
                }
            }

            i += 1;
        }

        ScanResult {
            separators,
            end_in_quote: self.in_quote,
        }
    }

    /// Pure scalar scanning implementation (fallback for non-WASM or testing)
    fn scan_scalar(&mut self, chunk: &[u8], base_offset: u32) -> ScanResult {
        let mut separators = Vec::with_capacity(chunk.len() / 4);

        for (i, &byte) in chunk.iter().enumerate() {
            let pos = base_offset + i as u32;

            if byte == self.quote {
                self.in_quote ^= 1;
            } else if self.in_quote == 0 {
                if byte == self.delimiter {
                    separators.push(pack_separator(pos, SEP_DELIMITER));
                } else if byte == b'\n' {
                    separators.push(pack_separator(pos, SEP_LF));
                }
            }
        }

        ScanResult {
            separators,
            end_in_quote: self.in_quote,
        }
    }

    // =========================================================================
    // Extended Scanning (with quote metadata)
    // =========================================================================

    /// Scan with extended metadata (quote flags and unescape hints)
    ///
    /// This version tracks:
    /// - Whether each field is quoted
    /// - Whether each quoted field contains escaped quotes ("")
    ///
    /// The unescape_flags bitmap has 1 bit per field (32 fields per u32).
    #[cfg(target_arch = "wasm32")]
    pub fn scan_extended(&mut self, chunk: &[u8], base_offset: u32) -> ScanResultExtended {
        // SAFETY: SIMD intrinsics are safe with simd128 feature
        unsafe { self.scan_extended_simd(chunk, base_offset) }
    }

    #[cfg(not(target_arch = "wasm32"))]
    pub fn scan_extended(&mut self, chunk: &[u8], base_offset: u32) -> ScanResultExtended {
        self.scan_extended_scalar(chunk, base_offset)
    }

    /// Extended SIMD scanning with quote metadata
    #[cfg(target_arch = "wasm32")]
    #[target_feature(enable = "simd128")]
    unsafe fn scan_extended_simd(&mut self, chunk: &[u8], base_offset: u32) -> ScanResultExtended {
        let len = chunk.len();

        // Check for potential offset overflow early
        // If base_offset + len would exceed MAX_OFFSET_EXTENDED, we can't represent all offsets
        let max_offset = base_offset.saturating_add(len as u32);
        if max_offset > MAX_OFFSET_EXTENDED && len > 0 {
            return ScanResultExtended {
                separators: Vec::new(),
                unescape_flags: Vec::new(),
                end_in_quote: self.in_quote,
                error: Some(format!(
                    "Offset overflow: base_offset ({}) + chunk_len ({}) = {} exceeds maximum allowed offset ({}). \
                     This limit is enforced due to internal 30-bit offset representation constraints.",
                    base_offset, len, max_offset, MAX_OFFSET_EXTENDED
                )),
            };
        }

        let mut separators = Vec::with_capacity(len / 4);
        let mut unescape_flags: Vec<u32> = Vec::new();
        let mut current_flags: u32 = 0;
        let mut field_index: usize = 0;

        // Field state tracking
        let mut field_is_quoted = false;
        let mut field_has_escaped_quote = false;
        let mut field_start_offset = base_offset;

        let mut i = 0usize;

        // SIMD constants
        let delim_vec = u8x16_splat(self.delimiter);
        let quote_vec = u8x16_splat(self.quote);
        let lf_vec = u8x16_splat(b'\n');

        // Process 16-byte chunks
        while i + 16 <= len {
            let data = v128_load(chunk.as_ptr().add(i) as *const v128);

            let delim_matches = u8x16_eq(data, delim_vec);
            let quote_matches = u8x16_eq(data, quote_vec);
            let lf_matches = u8x16_eq(data, lf_vec);

            let delim_mask = u8x16_bitmask(delim_matches);
            let quote_mask = u8x16_bitmask(quote_matches);
            let lf_mask = u8x16_bitmask(lf_matches);

            // Fast path: no quotes in this chunk and not currently in quote
            if quote_mask == 0 && self.in_quote == 0 {
                // Process separators in offset order by combining masks
                let mut combined = delim_mask | lf_mask;
                while combined != 0 {
                    let j = combined.trailing_zeros();
                    let bit = 1u16 << j;
                    let pos = base_offset + i as u32 + j;

                    // Determine separator type and emit
                    let sep_type = if (delim_mask & bit) != 0 {
                        SEP_DELIMITER
                    } else {
                        SEP_LF
                    };

                    separators.push(pack_separator_extended(pos, field_is_quoted, sep_type));

                    // Set unescape flag if needed
                    if field_has_escaped_quote {
                        current_flags |= 1 << (field_index & 31);
                    }

                    // Advance to next field
                    field_index += 1;
                    if (field_index & 31) == 0 {
                        unescape_flags.push(current_flags);
                        current_flags = 0;
                    }

                    // Reset field state
                    field_is_quoted = false;
                    field_has_escaped_quote = false;
                    field_start_offset = pos + 1;

                    combined &= combined - 1;
                }
            } else {
                // Slow path: need to track quote state byte-by-byte
                for j in 0..16u32 {
                    let bit = 1u16 << j;
                    let pos = base_offset + i as u32 + j;
                    let byte_offset = i + j as usize;

                    if (quote_mask & bit) != 0 {
                        // Quote character
                        if self.in_quote == 0 {
                            // Opening quote - check if at field start
                            if pos == field_start_offset {
                                field_is_quoted = true;
                            }
                        } else if field_is_quoted {
                            // Inside quoted field - could be escaped quote or closing quote
                            // Check next byte to see if it's another quote
                            let next_is_quote = if byte_offset + 1 < len {
                                chunk[byte_offset + 1] == self.quote
                            } else {
                                false
                            };

                            if next_is_quote {
                                // This is an escaped quote ("")
                                field_has_escaped_quote = true;
                            }
                        }
                        self.in_quote ^= 1;
                    } else if self.in_quote == 0 {
                        // Outside quotes - check for separators
                        if (delim_mask & bit) != 0 {
                            separators.push(pack_separator_extended(pos, field_is_quoted, SEP_DELIMITER));

                            if field_has_escaped_quote {
                                current_flags |= 1 << (field_index & 31);
                            }

                            field_index += 1;
                            if (field_index & 31) == 0 {
                                unescape_flags.push(current_flags);
                                current_flags = 0;
                            }

                            field_is_quoted = false;
                            field_has_escaped_quote = false;
                            field_start_offset = pos + 1;
                        } else if (lf_mask & bit) != 0 {
                            separators.push(pack_separator_extended(pos, field_is_quoted, SEP_LF));

                            if field_has_escaped_quote {
                                current_flags |= 1 << (field_index & 31);
                            }

                            field_index += 1;
                            if (field_index & 31) == 0 {
                                unescape_flags.push(current_flags);
                                current_flags = 0;
                            }

                            field_is_quoted = false;
                            field_has_escaped_quote = false;
                            field_start_offset = pos + 1;
                        }
                    }
                }
            }

            i += 16;
        }

        // Scalar fallback for remaining bytes
        while i < len {
            let byte = chunk[i];
            let pos = base_offset + i as u32;

            if byte == self.quote {
                if self.in_quote == 0 {
                    if pos == field_start_offset {
                        field_is_quoted = true;
                    }
                } else if field_is_quoted && i + 1 < len && chunk[i + 1] == self.quote {
                    field_has_escaped_quote = true;
                }
                self.in_quote ^= 1;
            } else if self.in_quote == 0 {
                if byte == self.delimiter {
                    separators.push(pack_separator_extended(pos, field_is_quoted, SEP_DELIMITER));

                    if field_has_escaped_quote {
                        current_flags |= 1 << (field_index & 31);
                    }

                    field_index += 1;
                    if (field_index & 31) == 0 {
                        unescape_flags.push(current_flags);
                        current_flags = 0;
                    }

                    field_is_quoted = false;
                    field_has_escaped_quote = false;
                    field_start_offset = pos + 1;
                } else if byte == b'\n' {
                    separators.push(pack_separator_extended(pos, field_is_quoted, SEP_LF));

                    if field_has_escaped_quote {
                        current_flags |= 1 << (field_index & 31);
                    }

                    field_index += 1;
                    if (field_index & 31) == 0 {
                        unescape_flags.push(current_flags);
                        current_flags = 0;
                    }

                    field_is_quoted = false;
                    field_has_escaped_quote = false;
                    field_start_offset = pos + 1;
                }
            }

            i += 1;
        }

        // Push remaining flags
        if (field_index & 31) != 0 {
            unescape_flags.push(current_flags);
        }

        ScanResultExtended {
            separators,
            unescape_flags,
            end_in_quote: self.in_quote,
            error: None,
        }
    }

    // =========================================================================
    // Character Offset Scanning (UTF-8 aware)
    // =========================================================================

    /// Scan and return character offsets instead of byte offsets (UTF-8 aware)
    ///
    /// This version tracks character count as it scans, providing correct
    /// offsets for use with JavaScript string.slice() on UTF-8 content.
    ///
    /// # Arguments
    /// * `chunk` - The CSV data to scan
    /// * `base_char_offset` - Base character offset for streaming
    ///
    /// # Returns
    /// ScanResultCharOffset with character-based separator positions
    #[cfg(target_arch = "wasm32")]
    pub fn scan_char_offsets(&mut self, chunk: &[u8], base_char_offset: u32) -> ScanResultCharOffset {
        unsafe { self.scan_char_offsets_simd(chunk, base_char_offset) }
    }

    #[cfg(not(target_arch = "wasm32"))]
    pub fn scan_char_offsets(&mut self, chunk: &[u8], base_char_offset: u32) -> ScanResultCharOffset {
        self.scan_char_offsets_scalar(chunk, base_char_offset)
    }

    /// SIMD-accelerated character offset scanning
    #[cfg(target_arch = "wasm32")]
    #[target_feature(enable = "simd128")]
    unsafe fn scan_char_offsets_simd(&mut self, chunk: &[u8], base_char_offset: u32) -> ScanResultCharOffset {
        let len = chunk.len();
        let mut separators = Vec::with_capacity(len / 4);
        let mut char_offset = base_char_offset;
        let mut i = 0usize;

        // SIMD constants
        let delim_vec = u8x16_splat(self.delimiter);
        let quote_vec = u8x16_splat(self.quote);
        let lf_vec = u8x16_splat(b'\n');
        // UTF-8 continuation byte mask: bytes matching 10xxxxxx pattern
        let cont_mask_high = u8x16_splat(0xC0);
        let cont_pattern = u8x16_splat(0x80);

        while i + 16 <= len {
            let data = v128_load(chunk.as_ptr().add(i) as *const v128);

            let delim_matches = u8x16_eq(data, delim_vec);
            let quote_matches = u8x16_eq(data, quote_vec);
            let lf_matches = u8x16_eq(data, lf_vec);

            let delim_mask = u8x16_bitmask(delim_matches);
            let quote_mask = u8x16_bitmask(quote_matches);
            let lf_mask = u8x16_bitmask(lf_matches);

            // Count non-continuation bytes for character counting
            // A continuation byte has pattern 10xxxxxx (0x80-0xBF)
            let masked = v128_and(data, cont_mask_high);
            let is_cont = u8x16_eq(masked, cont_pattern);
            let cont_bitmask = u8x16_bitmask(is_cont);
            // Non-continuation bytes are character starts
            let non_cont_mask = !cont_bitmask;

            // Fast path: no quotes
            if quote_mask == 0 && self.in_quote == 0 {
                // Process each position in order to maintain char_offset correctly
                for j in 0..16u32 {
                    let bit = 1u16 << j;

                    // Count character if not a continuation byte
                    if (non_cont_mask & bit) != 0 {
                        // Check for separator before incrementing (separator is at current char position)
                        if (delim_mask & bit) != 0 {
                            separators.push(pack_separator(char_offset, SEP_DELIMITER));
                        } else if (lf_mask & bit) != 0 {
                            separators.push(pack_separator(char_offset, SEP_LF));
                        }
                        char_offset += 1;
                    }
                }
            } else {
                // Slow path: need to track quote state
                for j in 0..16u32 {
                    let bit = 1u16 << j;
                    let is_char_start = (non_cont_mask & bit) != 0;

                    if (quote_mask & bit) != 0 {
                        self.in_quote ^= 1;
                        if is_char_start {
                            char_offset += 1;
                        }
                    } else if self.in_quote == 0 {
                        if (delim_mask & bit) != 0 {
                            separators.push(pack_separator(char_offset, SEP_DELIMITER));
                            if is_char_start {
                                char_offset += 1;
                            }
                        } else if (lf_mask & bit) != 0 {
                            separators.push(pack_separator(char_offset, SEP_LF));
                            if is_char_start {
                                char_offset += 1;
                            }
                        } else if is_char_start {
                            char_offset += 1;
                        }
                    } else if is_char_start {
                        char_offset += 1;
                    }
                }
            }

            i += 16;
        }

        // Scalar fallback for remaining bytes
        while i < len {
            let byte = chunk[i];
            let is_char_start = (byte & 0xC0) != 0x80;

            if byte == self.quote {
                self.in_quote ^= 1;
                if is_char_start {
                    char_offset += 1;
                }
            } else if self.in_quote == 0 {
                if byte == self.delimiter {
                    separators.push(pack_separator(char_offset, SEP_DELIMITER));
                    if is_char_start {
                        char_offset += 1;
                    }
                } else if byte == b'\n' {
                    separators.push(pack_separator(char_offset, SEP_LF));
                    if is_char_start {
                        char_offset += 1;
                    }
                } else if is_char_start {
                    char_offset += 1;
                }
            } else if is_char_start {
                char_offset += 1;
            }

            i += 1;
        }

        ScanResultCharOffset {
            separators,
            end_in_quote: self.in_quote,
            end_char_offset: char_offset,
        }
    }

    /// Scalar character offset scanning (fallback)
    fn scan_char_offsets_scalar(&mut self, chunk: &[u8], base_char_offset: u32) -> ScanResultCharOffset {
        let mut separators = Vec::with_capacity(chunk.len() / 4);
        let mut char_offset = base_char_offset;

        for &byte in chunk.iter() {
            let is_char_start = (byte & 0xC0) != 0x80;

            if byte == self.quote {
                self.in_quote ^= 1;
                if is_char_start {
                    char_offset += 1;
                }
            } else if self.in_quote == 0 {
                if byte == self.delimiter {
                    separators.push(pack_separator(char_offset, SEP_DELIMITER));
                    if is_char_start {
                        char_offset += 1;
                    }
                } else if byte == b'\n' {
                    separators.push(pack_separator(char_offset, SEP_LF));
                    if is_char_start {
                        char_offset += 1;
                    }
                } else if is_char_start {
                    char_offset += 1;
                }
            } else if is_char_start {
                char_offset += 1;
            }
        }

        ScanResultCharOffset {
            separators,
            end_in_quote: self.in_quote,
            end_char_offset: char_offset,
        }
    }

    // =========================================================================
    // UTF-16 Direct Scanning (No encode/decode overhead)
    // =========================================================================

    /// Scan UTF-16 code units directly
    ///
    /// This method works with raw UTF-16 code units from JavaScript strings,
    /// eliminating the UTF-16 → UTF-8 → UTF-16 conversion overhead.
    ///
    /// # Arguments
    /// * `utf16` - UTF-16 code units (from JavaScript string)
    /// * `base_char_offset` - Starting character offset
    ///
    /// # Returns
    /// Scan result with character (code unit) offsets
    pub fn scan_utf16(&mut self, utf16: &[u16], base_char_offset: u32) -> ScanResultCharOffset {
        let delimiter_u16 = self.delimiter as u16;
        let quote_u16 = self.quote as u16;
        let lf_u16 = b'\n' as u16;

        let mut separators = Vec::with_capacity(utf16.len() / 4);
        let mut char_offset = base_char_offset;

        for &code_unit in utf16.iter() {
            if code_unit == quote_u16 {
                self.in_quote ^= 1;
                char_offset += 1;
            } else if self.in_quote == 0 {
                if code_unit == delimiter_u16 {
                    separators.push(pack_separator(char_offset, SEP_DELIMITER));
                    char_offset += 1;
                } else if code_unit == lf_u16 {
                    separators.push(pack_separator(char_offset, SEP_LF));
                    char_offset += 1;
                } else {
                    // For surrogate pairs (U+10000+), this correctly counts 2 code units
                    char_offset += 1;
                }
            } else {
                char_offset += 1;
            }
        }

        ScanResultCharOffset {
            separators,
            end_in_quote: self.in_quote,
            end_char_offset: char_offset,
        }
    }

    /// SIMD-accelerated UTF-16 scanning
    ///
    /// Processes 8 UTF-16 code units (16 bytes) at a time using SIMD.
    #[cfg(target_arch = "wasm32")]
    pub fn scan_utf16_simd(&mut self, utf16: &[u16], base_char_offset: u32) -> ScanResultCharOffset {
        let len = utf16.len();
        if len < 8 {
            return self.scan_utf16(utf16, base_char_offset);
        }

        let delimiter_u16 = self.delimiter as u16;
        let quote_u16 = self.quote as u16;
        let lf_u16 = b'\n' as u16;

        let mut separators = Vec::with_capacity(len / 4);
        let mut char_offset = base_char_offset;
        let mut i = 0;

        // SAFETY: SIMD intrinsics are safe with simd128 feature
        unsafe {
            // Create SIMD constants (16-bit patterns replicated)
            let delim_vec = u16x8_splat(delimiter_u16);
            let quote_vec = u16x8_splat(quote_u16);
            let lf_vec = u16x8_splat(lf_u16);

            // Process 8 UTF-16 code units at a time
            while i + 8 <= len {
                let ptr = utf16.as_ptr().add(i) as *const v128;
                let data = v128_load(ptr);

                // Compare against patterns
                let delim_matches = u16x8_eq(data, delim_vec);
                let quote_matches = u16x8_eq(data, quote_vec);
                let lf_matches = u16x8_eq(data, lf_vec);

                // Extract bitmasks (one bit per u16, 8 bits total)
                let delim_mask = u16x8_bitmask(delim_matches);
                let quote_mask = u16x8_bitmask(quote_matches);
                let lf_mask = u16x8_bitmask(lf_matches);

                // Fast path: no quotes and not in quote state
                if quote_mask == 0 && self.in_quote == 0 {
                    // Process separators in offset order by combining masks
                    let mut combined = delim_mask | lf_mask;
                    while combined != 0 {
                        let j = combined.trailing_zeros() as u32;
                        let bit = 1u8 << j;
                        let pos = char_offset + j;

                        if (delim_mask & bit) != 0 {
                            separators.push(pack_separator(pos, SEP_DELIMITER));
                        } else {
                            separators.push(pack_separator(pos, SEP_LF));
                        }

                        combined &= combined - 1;
                    }

                    char_offset += 8;
                } else {
                    // Slow path: track quote state
                    for j in 0u32..8 {
                        let bit = 1u8 << j;
                        let pos = char_offset + j;

                        if (quote_mask & bit) != 0 {
                            self.in_quote ^= 1;
                        } else if self.in_quote == 0 {
                            if (delim_mask & bit) != 0 {
                                separators.push(pack_separator(pos, SEP_DELIMITER));
                            } else if (lf_mask & bit) != 0 {
                                separators.push(pack_separator(pos, SEP_LF));
                            }
                        }
                    }
                    char_offset += 8;
                }

                i += 8;
            }
        }

        // Scalar fallback for remaining code units
        for j in i..len {
            let code_unit = utf16[j];

            if code_unit == quote_u16 {
                self.in_quote ^= 1;
                char_offset += 1;
            } else if self.in_quote == 0 {
                if code_unit == delimiter_u16 {
                    separators.push(pack_separator(char_offset, SEP_DELIMITER));
                    char_offset += 1;
                } else if code_unit == lf_u16 {
                    separators.push(pack_separator(char_offset, SEP_LF));
                    char_offset += 1;
                } else {
                    char_offset += 1;
                }
            } else {
                char_offset += 1;
            }
        }

        ScanResultCharOffset {
            separators,
            end_in_quote: self.in_quote,
            end_char_offset: char_offset,
        }
    }

    /// Extended scalar scanning (fallback)
    fn scan_extended_scalar(&mut self, chunk: &[u8], base_offset: u32) -> ScanResultExtended {
        let len = chunk.len();

        // Check for potential offset overflow early
        let max_offset = base_offset.saturating_add(len as u32);
        if max_offset > MAX_OFFSET_EXTENDED && len > 0 {
            return ScanResultExtended {
                separators: Vec::new(),
                unescape_flags: Vec::new(),
                end_in_quote: self.in_quote,
                error: Some(format!(
                    "Offset overflow: base_offset ({}) + chunk_len ({}) = {} exceeds maximum allowed offset ({}). \
                     This limit is enforced due to internal 30-bit offset representation constraints.",
                    base_offset, len, max_offset, MAX_OFFSET_EXTENDED
                )),
            };
        }

        let mut separators = Vec::with_capacity(len / 4);
        let mut unescape_flags: Vec<u32> = Vec::new();
        let mut current_flags: u32 = 0;
        let mut field_index: usize = 0;

        let mut field_is_quoted = false;
        let mut field_has_escaped_quote = false;
        let mut field_start_offset = base_offset;

        for (i, &byte) in chunk.iter().enumerate() {
            let pos = base_offset + i as u32;

            if byte == self.quote {
                if self.in_quote == 0 {
                    if pos == field_start_offset {
                        field_is_quoted = true;
                    }
                } else if field_is_quoted && i + 1 < chunk.len() && chunk[i + 1] == self.quote {
                    field_has_escaped_quote = true;
                }
                self.in_quote ^= 1;
            } else if self.in_quote == 0 {
                if byte == self.delimiter {
                    separators.push(pack_separator_extended(pos, field_is_quoted, SEP_DELIMITER));

                    if field_has_escaped_quote {
                        current_flags |= 1 << (field_index & 31);
                    }

                    field_index += 1;
                    if (field_index & 31) == 0 {
                        unescape_flags.push(current_flags);
                        current_flags = 0;
                    }

                    field_is_quoted = false;
                    field_has_escaped_quote = false;
                    field_start_offset = pos + 1;
                } else if byte == b'\n' {
                    separators.push(pack_separator_extended(pos, field_is_quoted, SEP_LF));

                    if field_has_escaped_quote {
                        current_flags |= 1 << (field_index & 31);
                    }

                    field_index += 1;
                    if (field_index & 31) == 0 {
                        unescape_flags.push(current_flags);
                        current_flags = 0;
                    }

                    field_is_quoted = false;
                    field_has_escaped_quote = false;
                    field_start_offset = pos + 1;
                }
            }
        }

        // Push remaining flags
        if (field_index & 31) != 0 {
            unescape_flags.push(current_flags);
        }

        ScanResultExtended {
            separators,
            unescape_flags,
            end_in_quote: self.in_quote,
            error: None,
        }
    }
}

impl Default for SimdScanner {
    fn default() -> Self {
        Self::new()
    }
}

/// Extract fields from CSV data using separator positions
///
/// # Arguments
/// * `data` - The raw CSV bytes
/// * `separators` - Packed separator positions from scan()
/// * `start_offset` - Starting byte offset in data
///
/// # Returns
/// Vector of field byte slices, organized by record
pub fn extract_fields<'a>(
    data: &'a [u8],
    separators: &[u32],
    start_offset: u32,
) -> Vec<Vec<&'a [u8]>> {
    let mut records: Vec<Vec<&'a [u8]>> = Vec::new();
    let mut current_record: Vec<&'a [u8]> = Vec::new();
    let mut field_start = start_offset as usize;

    for &packed in separators {
        let offset = unpack_offset(packed) as usize;
        let sep_type = unpack_type(packed);

        // Extract field (excluding the separator)
        let field_end = offset;
        if field_end >= field_start && field_end <= data.len() + start_offset as usize {
            let local_start = field_start.saturating_sub(start_offset as usize);
            let local_end = field_end.saturating_sub(start_offset as usize);
            if local_end <= data.len() {
                let field = &data[local_start..local_end];
                current_record.push(field);
            }
        }

        // Move start to after separator
        field_start = offset + 1;

        // If line feed, complete the record
        if sep_type == SEP_LF {
            records.push(std::mem::take(&mut current_record));
        }
    }

    // Handle trailing field (after last separator, if any)
    if field_start <= data.len() + start_offset as usize {
        let local_start = field_start.saturating_sub(start_offset as usize);
        if local_start < data.len() {
            let field = &data[local_start..];
            if !field.is_empty() || !current_record.is_empty() {
                current_record.push(field);
            }
        }
    }

    // Handle incomplete record at end
    if !current_record.is_empty() {
        records.push(current_record);
    }

    records
}

/// Unescape a quoted CSV field
///
/// Removes surrounding quotes and unescapes doubled quotes ("" -> ")
/// Returns Cow::Borrowed when no allocation is needed (unquoted fields or
/// quoted fields without escaped quotes), Cow::Owned when unescaping is needed.
pub fn unescape_field<'a>(field: &'a [u8], quote: u8) -> Cow<'a, [u8]> {
    if field.len() < 2 {
        return Cow::Borrowed(field);
    }

    // Check if field is quoted
    if field[0] != quote || field[field.len() - 1] != quote {
        return Cow::Borrowed(field);
    }

    // Remove surrounding quotes
    let inner = &field[1..field.len() - 1];

    // Check if there are any escaped quotes
    if !inner.contains(&quote) {
        return Cow::Borrowed(inner);
    }

    // Unescape doubled quotes - need allocation
    let mut result = Vec::with_capacity(inner.len());
    let mut i = 0;
    while i < inner.len() {
        if inner[i] == quote && i + 1 < inner.len() && inner[i + 1] == quote {
            result.push(quote);
            i += 2;
        } else {
            result.push(inner[i]);
            i += 1;
        }
    }

    Cow::Owned(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pack_unpack_separator() {
        let offset = 12345u32;
        let sep_type = SEP_LF;
        let packed = pack_separator(offset, sep_type);

        assert_eq!(unpack_offset(packed), offset);
        assert_eq!(unpack_type(packed), sep_type);
    }

    #[test]
    fn test_scanner_simple_csv() {
        let mut scanner = SimdScanner::new();
        let csv = b"a,b,c\n1,2,3\n";
        let result = scanner.scan(csv, 0);

        // Should find: comma at 1, comma at 3, LF at 5, comma at 7, comma at 9, LF at 11
        assert_eq!(result.separators.len(), 6);
        assert_eq!(result.end_in_quote, 0);

        // Verify first few separators
        assert_eq!(unpack_offset(result.separators[0]), 1); // first comma
        assert_eq!(unpack_type(result.separators[0]), SEP_DELIMITER);
        assert_eq!(unpack_offset(result.separators[2]), 5); // first LF
        assert_eq!(unpack_type(result.separators[2]), SEP_LF);
    }

    #[test]
    fn test_scanner_quoted_field() {
        let mut scanner = SimdScanner::new();
        let csv = b"a,\"b,c\",d\n";
        let result = scanner.scan(csv, 0);

        // Should find: comma at 1, comma at 7, LF at 9
        // The comma at position 4 inside quotes should be ignored
        assert_eq!(result.separators.len(), 3);
        assert_eq!(unpack_offset(result.separators[0]), 1);
        assert_eq!(unpack_offset(result.separators[1]), 7);
        assert_eq!(unpack_offset(result.separators[2]), 9);
    }

    #[test]
    fn test_scanner_escaped_quotes() {
        let mut scanner = SimdScanner::new();
        // CSV: a,"b""c",d\n - field with escaped quote inside
        let csv = b"a,\"b\"\"c\",d\n";
        let result = scanner.scan(csv, 0);

        // Should handle escaped quotes correctly
        assert_eq!(result.end_in_quote, 0);
    }

    #[test]
    fn test_scanner_streaming() {
        let mut scanner = SimdScanner::new();

        // First chunk ends mid-quote
        let chunk1 = b"a,\"b,c";
        let result1 = scanner.scan(chunk1, 0);
        assert_eq!(result1.end_in_quote, 1); // Inside quote

        // Second chunk continues and closes quote
        let chunk2 = b"\",d\n";
        let result2 = scanner.scan(chunk2, chunk1.len() as u32);
        assert_eq!(result2.end_in_quote, 0); // Outside quote
    }

    #[test]
    fn test_extract_fields() {
        let csv = b"a,b,c\n1,2,3\n";
        let mut scanner = SimdScanner::new();
        let result = scanner.scan(csv, 0);

        let records = extract_fields(csv, &result.separators, 0);
        assert_eq!(records.len(), 2);
        assert_eq!(records[0], vec![b"a".as_slice(), b"b", b"c"]);
        assert_eq!(records[1], vec![b"1".as_slice(), b"2", b"3"]);
    }

    #[test]
    fn test_unescape_field() {
        // Simple unquoted field
        assert_eq!(&*unescape_field(b"hello", b'"'), b"hello");

        // Quoted field without escapes
        assert_eq!(&*unescape_field(b"\"hello\"", b'"'), b"hello");

        // Quoted field with escaped quote
        assert_eq!(&*unescape_field(b"\"hello\"\"world\"", b'"'), b"hello\"world");

        // Multiple escaped quotes
        assert_eq!(&*unescape_field(b"\"a\"\"b\"\"c\"", b'"'), b"a\"b\"c");
    }
}
