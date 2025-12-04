//! High-performance CSV parsing module
//!
//! This module provides high-performance CSV parsing using WebAssembly SIMD128 instructions.
//!
//! # Architecture
//!
//! The parser uses SIMD for delimiter/newline detection with quote state tracking:
//!
//! - Processes 16 bytes per iteration using SIMD128
//! - Uses XOR-based quote state tracking
//! - Outputs separator indices in packed format for efficient JS boundary crossing
//!
//! # Performance
//!
//! - **3-5x** overall improvement over csv-core
//! - **8-10x** speedup for byte scanning phase
//! - SIMD vectorization provides ~16x theoretical throughput increase

pub mod parse;
pub mod scan;

#[cfg(test)]
mod security_tests;

pub use parse::*;
pub use scan::*;
