// WebGPU CSV Indexer Compute Shader
// Purpose: Parallel scan to identify separator positions (comma and newline)
// Architecture: Index-only output for minimal memory bandwidth usage

// ============================================================================
// Data Structures
// ============================================================================

struct ParseUniforms {
    chunkSize: u32,
    prevInQuote: u32,  // 0: false, 1: true
    _padding1: u32,
    _padding2: u32,
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

// Workgroup-level prefix XOR scan (Blelloch algorithm)
fn workgroupPrefixXOR(localId: u32) {
    var offset = 1u;

    // Up-sweep (reduce) phase
    for (var d = WORKGROUP_SIZE >> 1u; d > 0u; d = d >> 1u) {
        workgroupBarrier();
        if (localId < d) {
            let ai = offset * (2u * localId + 1u) - 1u;
            let bi = offset * (2u * localId + 2u) - 1u;
            sharedScanTemp[bi] ^= sharedScanTemp[ai];
        }
        offset = offset << 1u;
    }

    // Clear last element
    if (localId == 0u) {
        sharedScanTemp[WORKGROUP_SIZE - 1u] = 0u;
    }

    // Down-sweep phase
    for (var d = 1u; d < WORKGROUP_SIZE; d = d << 1u) {
        offset = offset >> 1u;
        workgroupBarrier();
        if (localId < d) {
            let ai = offset * (2u * localId + 1u) - 1u;
            let bi = offset * (2u * localId + 2u) - 1u;
            let t = sharedScanTemp[ai];
            sharedScanTemp[ai] = sharedScanTemp[bi];
            sharedScanTemp[bi] ^= t;
        }
    }

    workgroupBarrier();
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
    sharedQuoteXOR[tid] = isQuote;
    sharedScanTemp[tid] = isQuote;
    workgroupBarrier();

    // Perform prefix XOR scan
    workgroupPrefixXOR(tid);

    // Get quote state: previous XOR state determines if we're inside quotes
    var inQuote = sharedScanTemp[tid];

    // Add workgroup prefix from previous workgroups
    if (workgroupId.x > 0u) {
        // In a real implementation, we'd need to propagate state across workgroups
        // For now, we use prevInQuote for the first workgroup
        if (workgroupId.x == 0u && tid == 0u) {
            inQuote ^= uniforms.prevInQuote;
        }
    } else if (tid == 0u) {
        inQuote ^= uniforms.prevInQuote;
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
    // Phase 4: Global Indexing (Scatter)
    // ========================================================================

    if (isValid && isSeparator == 1u) {
        let writePos = atomicAdd(&atomicIndex, 1u);
        sepIndices[writePos] = packSeparator(globalIndex, sepType);
    }

    // ========================================================================
    // Phase 5: Store End State (last thread in last workgroup)
    // ========================================================================

    // Note: This is a simplified version. In production, we'd need proper
    // cross-workgroup communication for the final quote state.
    if (isValid && globalIndex == uniforms.chunkSize - 1u) {
        resultMeta.endInQuote = inQuote;
        resultMeta.sepCount = atomicLoad(&atomicIndex);
    }
}
