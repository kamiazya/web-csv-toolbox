// WebGPU CSV Indexer - Pass 1: Collect Quote Parities
// Purpose: Collect quote parity for each workgroup to enable cross-workgroup propagation
//
// Template placeholders:
//   {{WORKGROUP_SIZE}} - Workgroup size (32, 64, 128, 256, or 512)
//   {{LOG_ITERATIONS}} - log2(WORKGROUP_SIZE) for loop iterations

// ============================================================================
// Data Structures
// ============================================================================

struct ParseUniforms {
    chunkSize: u32,
    prevInQuote: u32,
    quotation: u32,
    delimiter: u32,  // Field delimiter (unused in Pass 1, but kept for struct uniformity)
}

// ============================================================================
// Bindings
// ============================================================================

@group(0) @binding(0) var<storage, read> inputBytes: array<u32>;
@group(0) @binding(1) var<storage, read_write> workgroupXORs: array<atomic<u32>>;
@group(0) @binding(2) var<uniform> uniforms: ParseUniforms;

// ============================================================================
// Constants
// ============================================================================

const WORKGROUP_SIZE: u32 = {{WORKGROUP_SIZE}}u;

// ============================================================================
// Shared Memory
// ============================================================================

var<workgroup> sharedScanTemp: array<u32, {{WORKGROUP_SIZE}}>;

// ============================================================================
// Helper Functions
// ============================================================================

fn getByte(index: u32) -> u32 {
    let wordIndex = index / 4u;
    let byteOffset = index % 4u;
    let word = inputBytes[wordIndex];
    return (word >> (byteOffset * 8u)) & 0xFFu;
}

fn workgroupPrefixXOR(localId: u32) {
    var step = 1u;
    for (var i = 0u; i < {{LOG_ITERATIONS}}u; i++) {
        workgroupBarrier();
        // IMPORTANT: Two-phase update (read -> barrier -> write).
        // An in-place scan without this can read values that were updated
        // earlier in the same iteration, causing nondeterministic results.
        var nextValue = sharedScanTemp[localId];
        if (localId >= step) {
            nextValue ^= sharedScanTemp[localId - step];
        }
        workgroupBarrier();
        sharedScanTemp[localId] = nextValue;
        step = step << 1u;
    }

    workgroupBarrier();
}

// ============================================================================
// Main Compute Shader
// ============================================================================

@compute @workgroup_size({{WORKGROUP_SIZE}}, 1, 1)
fn main(
    @builtin(global_invocation_id) globalId: vec3<u32>,
    @builtin(local_invocation_id) localId: vec3<u32>,
    @builtin(workgroup_id) workgroupId: vec3<u32>,
) {
    let tid = localId.x;
    let globalIndex = globalId.x;
    let isValid = globalIndex < uniforms.chunkSize;

    // Load and classify
    var isQuote = 0u;
    if (isValid) {
        let byte = getByte(globalIndex);
        if (byte == uniforms.quotation) {
            isQuote = 1u;
        }
    }

    // Initialize shared memory
    sharedScanTemp[tid] = isQuote;
    workgroupBarrier();

    // Perform prefix XOR scan
    workgroupPrefixXOR(tid);

    // Last thread stores the total parity (inclusive scan result)
    if (tid == WORKGROUP_SIZE - 1u) {
        atomicStore(&workgroupXORs[workgroupId.x], sharedScanTemp[tid]);
    }
}
