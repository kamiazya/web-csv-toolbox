// WebGPU CSV Indexer - Pass 1: Collect Quote Parities
// Purpose: Collect quote parity for each workgroup to enable cross-workgroup propagation

// ============================================================================
// Data Structures
// ============================================================================

struct ParseUniforms {
    chunkSize: u32,
    prevInQuote: u32,
    _padding1: u32,
    _padding2: u32,
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

const WORKGROUP_SIZE: u32 = 256u;
const QUOTE: u32 = 34u;  // '"'

// ============================================================================
// Shared Memory
// ============================================================================

var<workgroup> sharedScanTemp: array<u32, WORKGROUP_SIZE>;

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
    for (var i = 0u; i < 8u; i++) {
        workgroupBarrier();

        if (localId >= step) {
            let prev = sharedScanTemp[localId - step];
            sharedScanTemp[localId] ^= prev;
        }

        workgroupBarrier();
        step = step << 1u;
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
    let isValid = globalIndex < uniforms.chunkSize;

    // Load and classify
    var isQuote = 0u;
    if (isValid) {
        let byte = getByte(globalIndex);
        if (byte == QUOTE) {
            isQuote = 1u;
        }
    }

    // Initialize shared memory
    sharedScanTemp[tid] = isQuote;
    workgroupBarrier();

    // Perform prefix XOR scan
    workgroupPrefixXOR(tid);

    // Last thread in workgroup stores the total parity
    if (tid == WORKGROUP_SIZE - 1u) {
        // Inclusive scan result at last position = total XOR for workgroup
        let workgroupParity = sharedScanTemp[tid] ^ isQuote;
        atomicStore(&workgroupXORs[workgroupId.x], workgroupParity);
    }
}
