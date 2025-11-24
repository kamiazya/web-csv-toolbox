/**
 * Buffer utility functions for efficient memory management
 *
 * These utilities help minimize memory allocations during streaming parsing
 * by reusing buffers and avoiding unnecessary copies.
 */

const BOM_UTF8 = new Uint8Array([0xef, 0xbb, 0xbf]);

/**
 * Concatenates two Uint8Arrays efficiently
 *
 * @param left - First array
 * @param right - Second array
 * @returns New array containing both arrays concatenated
 */
export function concatUint8Arrays(
	left: Uint8Array,
	right: Uint8Array,
): Uint8Array {
	if (left.length === 0) return right;
	if (right.length === 0) return left;

	const result = new Uint8Array(left.length + right.length);
	result.set(left, 0);
	result.set(right, left.length);
	return result;
}

/**
 * Checks if a byte array starts with UTF-8 BOM
 *
 * @param bytes - Byte array to check
 * @returns true if the array starts with BOM
 */
export function hasBOM(bytes: Uint8Array): boolean {
	if (bytes.length < 3) return false;
	return (
		bytes[0] === BOM_UTF8[0] &&
		bytes[1] === BOM_UTF8[1] &&
		bytes[2] === BOM_UTF8[2]
	);
}

/**
 * Removes BOM from the beginning of a byte array (zero-copy)
 *
 * @param bytes - Byte array potentially starting with BOM
 * @returns Subarray without BOM (zero-copy if BOM present, original if not)
 */
export function stripBOM(bytes: Uint8Array): Uint8Array {
	return hasBOM(bytes) ? bytes.subarray(3) : bytes;
}

/**
 * Checks if a byte is a carriage return (CR, \r)
 *
 * @param byte - Byte value to check
 * @returns true if byte is CR
 */
export function isCR(byte: number): boolean {
	return byte === 0x0d;
}

/**
 * Checks if a byte is a line feed (LF, \n)
 *
 * @param byte - Byte value to check
 * @returns true if byte is LF
 */
export function isLF(byte: number): boolean {
	return byte === 0x0a;
}

/**
 * Adjusts field end position to handle CRLF line endings
 *
 * If the character before the LF is a CR, moves the end position back by 1
 * to exclude the CR from the field value.
 *
 * @param bytes - Input byte array
 * @param lfOffset - Position of the LF character
 * @returns Adjusted end position for the field
 */
export function adjustForCRLF(bytes: Uint8Array, lfOffset: number): number {
	if (lfOffset > 0 && isCR(bytes[lfOffset - 1])) {
		return lfOffset - 1;
	}
	return lfOffset;
}

/**
 * Decodes a byte range to a UTF-8 string
 *
 * @param bytes - Input byte array
 * @param start - Start offset (inclusive)
 * @param end - End offset (exclusive)
 * @returns Decoded string
 */
export function decodeUTF8(
	bytes: Uint8Array,
	start: number,
	end: number,
): string {
	const decoder = new TextDecoder("utf-8", { fatal: false });
	return decoder.decode(bytes.subarray(start, end));
}

/**
 * Aligns buffer size to u32 boundaries for GPU transfer
 *
 * WebGPU requires buffer sizes to be multiples of 4 bytes.
 *
 * @param size - Original size in bytes
 * @returns Aligned size (rounded up to nearest multiple of 4)
 */
export function alignToU32(size: number): number {
	return Math.ceil(size / 4) * 4;
}

/**
 * Pads a Uint8Array to u32-aligned size
 *
 * @param bytes - Original byte array
 * @returns New array with padding (if needed) or original array
 */
export function padToU32Aligned(bytes: Uint8Array): Uint8Array {
	const aligned = alignToU32(bytes.length);
	if (aligned === bytes.length) {
		return bytes;
	}

	const padded = new Uint8Array(aligned);
	padded.set(bytes, 0);
	// Remaining bytes are zero-filled by default
	return padded;
}

/**
 * Creates a Uint32Array view of a Uint8Array for GPU transfer
 *
 * @param bytes - Input byte array (must be u32-aligned)
 * @returns Uint32Array view of the same buffer
 * @throws Error if bytes are not u32-aligned
 */
export function toUint32View(bytes: Uint8Array): Uint32Array {
	if (bytes.length % 4 !== 0) {
		throw new Error(
			`Buffer size ${bytes.length} is not u32-aligned. Use padToU32Aligned first.`,
		);
	}
	return new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4);
}

/**
 * Efficient buffer pool for reusing memory allocations
 *
 * Reduces GC pressure during streaming operations.
 */
export class BufferPool {
	private pool: Uint8Array[] = [];
	private readonly maxPoolSize: number;
	private readonly bufferSize: number;

	constructor(bufferSize: number, maxPoolSize = 4) {
		this.bufferSize = alignToU32(bufferSize);
		this.maxPoolSize = maxPoolSize;
	}

	/**
	 * Acquires a buffer from the pool or creates a new one
	 */
	acquire(): Uint8Array {
		return this.pool.pop() || new Uint8Array(this.bufferSize);
	}

	/**
	 * Returns a buffer to the pool for reuse
	 */
	release(buffer: Uint8Array): void {
		if (this.pool.length < this.maxPoolSize && buffer.length === this.bufferSize) {
			this.pool.push(buffer);
		}
	}

	/**
	 * Clears all buffers from the pool
	 */
	clear(): void {
		this.pool = [];
	}
}
