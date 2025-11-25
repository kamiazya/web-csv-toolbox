// WebGPU CSV Indexer Compute Shader
// Purpose: Parallel scan to identify separator positions (comma and newline)
// Architecture: Index-only output for minimal memory bandwidth usage

// ============================================================================
// Data Structures
// ============================================================================

struct ParseUniforms {
    chunkSize: u32,
    prevInQuote: u32,  // 0: false, 1: true
    maxWorkgroups: u32, // Number of workgroups (for bounds checking)
    _padding: u32,
}

struct ResultMeta {
    endInQuote: u32,   // Quote state at end of chunk
    sepCount: u32,     // Total number of separators found
    _padding1: u32,
    _padding2: u32,
}

// ============================================================================
// Bindings
// ============================================================================

@group(0) @binding(0) var<storage, read> inputBytes: array<u32>;      // CSV data (packed as u32)
@group(0) @binding(1) var<storage, read_write> sepIndices: array<u32>; // Output: separator positions
@group(0) @binding(2) var<storage, read_write> atomicIndex: atomic<u32>; // Write position counter
@group(0) @binding(3) var<uniform> uniforms: ParseUniforms;
@group(0) @binding(4) var<storage, read_write> resultMeta: ResultMeta;
@group(0) @binding(5) var<storage, read> workgroupPrefixXORs: array<u32>; // Prefix XOR per workgroup (CPU-computed)

// ============================================================================
// Constants
// ============================================================================

const WORKGROUP_SIZE: u32 = 256u;
const QUOTE: u32 = 34u;      // '"'
const COMMA: u32 = 44u;      // ','
const LF: u32 = 10u;         // '\n'
const CR: u32 = 13u;         // '\r'

const SEP_TYPE_COMMA: u32 = 0u;
const SEP_TYPE_LF: u32 = 1u;

// ============================================================================
// Shared Memory for Workgroup Scan
// ============================================================================

var<workgroup> sharedQuoteXOR: array<u32, WORKGROUP_SIZE>;
var<workgroup> sharedScanTemp: array<u32, WORKGROUP_SIZE>;
var<workgroup> sharedSeparatorFlags: array<u32, WORKGROUP_SIZE>;
var<workgroup> workgroupSeparatorBase: atomic<u32>;

// ============================================================================
// Helper Functions
// ============================================================================

// Extract byte from packed u32 array
fn getByte(index: u32) -> u32 {
    let wordIndex = index / 4u;
    let byteOffset = index % 4u;
    let word = inputBytes[wordIndex];
    return (word >> (byteOffset * 8u)) & 0xFFu;
}

// Pack separator position and type into u32
// Bit 0-30: byte offset
// Bit 31: separator type (0: comma, 1: LF)
fn packSeparator(offset: u32, sepType: u32) -> u32 {
    return offset | (sepType << 31u);
}

// Workgroup-level prefix XOR scan (Simple iterative algorithm)
// This is more reliable than Blelloch for XOR operations
fn workgroupPrefixXOR(localId: u32) {
    // Use iterative doubling for prefix XOR
    // After log2(WORKGROUP_SIZE) iterations, all values are computed
    var step = 1u;
    for (var i = 0u; i < 8u; i++) { // log2(256) = 8 iterations
        workgroupBarrier();

        if (localId >= step) {
            let prev = sharedScanTemp[localId - step];
            sharedScanTemp[localId] ^= prev;
        }

        workgroupBarrier();
        step = step << 1u;
    }

    // Convert from inclusive to exclusive scan by shifting
    workgroupBarrier();
    let temp = sharedScanTemp[localId];
    workgroupBarrier();

    if (localId > 0u) {
        sharedScanTemp[localId] = sharedScanTemp[localId - 1u];
    } else {
        sharedScanTemp[0] = 0u;
    }

    workgroupBarrier();
}

// Workgroup-level prefix sum scan for separator count
// Returns the exclusive prefix sum (count of separators before this thread)
fn workgroupPrefixSum(localId: u32, hasSeparator: u32) -> u32 {
    // Initialize with separator flag
    sharedSeparatorFlags[localId] = hasSeparator;
    workgroupBarrier();

    // Iterative doubling for prefix sum
    var step = 1u;
    for (var i = 0u; i < 8u; i++) { // log2(256) = 8 iterations
        workgroupBarrier();

        var sum = sharedSeparatorFlags[localId];
        if (localId >= step) {
            sum += sharedSeparatorFlags[localId - step];
        }

        workgroupBarrier();
        sharedSeparatorFlags[localId] = sum;
        step = step << 1u;
    }

    workgroupBarrier();

    // Convert inclusive to exclusive scan
    if (localId > 0u) {
        return sharedSeparatorFlags[localId - 1u];
    }
    return 0u;
}

// ============================================================================
// Main Compute Shader
// ============================================================================

@compute @workgroup_size(256, 1, 1)
fn main(
    @builtin(global_invocation_id) globalId: vec3<u32>,
    @builtin(local_invocation_id) localId: vec3<u32>,
    @builtin(workgroup_id) workgroupId: vec3<u32>,
) {
    let tid = localId.x;
    let globalIndex = globalId.x;

    // Bounds check (but don't early return before barriers)
    let isValid = globalIndex < uniforms.chunkSize;

    // ========================================================================
    // Phase 1: Load & Classify
    // ========================================================================

    var byte = 0u;
    var isQuote = 0u;
    var isComma = 0u;
    var isLF = 0u;

    if (isValid) {
        byte = getByte(globalIndex);

        if (byte == QUOTE) {
            isQuote = 1u;
        } else if (byte == COMMA) {
            isComma = 1u;
        } else if (byte == LF) {
            isLF = 1u;
        }
    }

    // ========================================================================
    // Phase 2: Local Prefix XOR (Quote Detection)
    // ========================================================================

    // Initialize shared memory with quote bits
    // IMPORTANT: Initialize ALL elements, not just active threads
    // The Blelloch prefix scan algorithm accesses all WORKGROUP_SIZE elements
    sharedQuoteXOR[tid] = isQuote;
    sharedScanTemp[tid] = isQuote;
    workgroupBarrier();

    // Perform prefix XOR scan
    workgroupPrefixXOR(tid);

    // Get quote state: previous XOR state determines if we're inside quotes
    var inQuote = sharedScanTemp[tid];

    // Apply workgroup prefix XOR (computed by CPU from Pass 1 results)
    // This enables correct quote propagation across workgroup boundaries
    if (workgroupId.x < uniforms.maxWorkgroups) {
        inQuote ^= workgroupPrefixXORs[workgroupId.x];
    }

    // Account for current position's quote
    inQuote ^= isQuote;

    // ========================================================================
    // Phase 3: Separator Masking
    // ========================================================================

    var isSeparator = 0u;
    var sepType = 0u;

    // Only valid separators are outside quotes
    if (inQuote == 0u) {
        if (isComma == 1u) {
            isSeparator = 1u;
            sepType = SEP_TYPE_COMMA;
        } else if (isLF == 1u) {
            isSeparator = 1u;
            sepType = SEP_TYPE_LF;
        }
    }

    // ========================================================================
    // Phase 4: Ordered Write (Workgroup-level block allocation)
    // ========================================================================

    // Step 1: Compute prefix sum of separators within workgroup
    let localOffset = workgroupPrefixSum(tid, isSeparator);

    // Step 2: Last thread allocates global block for this workgroup
    workgroupBarrier();
    if (tid == WORKGROUP_SIZE - 1u) {
        // Total separators in this workgroup
        let workgroupSeparatorCount = localOffset + isSeparator;
        if (workgroupSeparatorCount > 0u) {
            let baseOffset = atomicAdd(&atomicIndex, workgroupSeparatorCount);
            atomicStore(&workgroupSeparatorBase, baseOffset);
        } else {
            atomicStore(&workgroupSeparatorBase, 0u);
        }
    }
    workgroupBarrier();

    // Step 3: Each thread writes to its allocated position
    if (isValid && isSeparator == 1u) {
        let baseOffset = atomicLoad(&workgroupSeparatorBase);
        let globalWritePos = baseOffset + localOffset;
        sepIndices[globalWritePos] = packSeparator(globalIndex, sepType);
    }

    // ========================================================================
    // Phase 5: Store End State
    // ========================================================================

    // The last thread of the last workgroup stores the final quote state
    if (isValid && globalIndex == uniforms.chunkSize - 1u) {
        resultMeta.endInQuote = inQuote;
        // Note: sepCount is read directly from atomicIndex on CPU side
        // to avoid race conditions (no grid-wide barrier in WGSL)
    }
}
