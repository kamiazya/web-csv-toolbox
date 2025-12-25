/**
 * Generate a secure random session ID
 * Web環境向け: crypto.randomUUID() を使用
 *
 * @returns セキュアなランダムUUID文字列
 */
export function generateSessionId(): string {
	// Web標準のrandomUUID()を使用
	if (globalThis.crypto?.randomUUID) {
		return globalThis.crypto.randomUUID();
	}

	// fallback: getRandomValues() でUUID v4相当を生成
	if (globalThis.crypto?.getRandomValues) {
		const bytes = new Uint8Array(16);
		globalThis.crypto.getRandomValues(bytes);

		// UUID v4 フォーマット: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
		bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
		bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant

		const hex = Array.from(bytes)
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");

		return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
	}

	throw new Error(
		"No secure random number generator available. crypto.randomUUID() or crypto.getRandomValues() is required.",
	);
}
