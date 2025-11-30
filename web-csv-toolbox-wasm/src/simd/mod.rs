//! SIMD-accelerated CSV scanning module
//!
//! This module provides high-performance CSV parsing using WebAssembly SIMD128 instructions.
//! The key insight from profiling is that `csv-core` parsing consumes 82% of total time,
//! making it the primary optimization target.
//!
//! # Architecture
//!
//! Instead of replacing `csv-core` entirely, we use SIMD for the most expensive operation:
//! delimiter/newline detection with quote state tracking. This approach:
//!
//! - Processes 16 bytes per iteration using SIMD128
//! - Uses XOR-based quote state tracking (inspired by WebGPU implementation)
//! - Outputs separator indices in packed format for efficient JS boundary crossing
//!
//! # Performance Expectations
//!
//! - **3-5x** overall improvement
//! - **8-10x** speedup for byte scanning phase
//! - SIMD vectorization provides ~16x theoretical throughput increase

pub mod parser;
pub mod scanner;

pub use parser::*;
pub use scanner::*;
