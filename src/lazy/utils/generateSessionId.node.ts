/**
 * Generate a secure random session ID
 * Node.js環境向け: node:crypto を使用
 *
 * @returns セキュアなランダムUUID文字列
 */
export async function generateSessionId(): Promise<string> {
	// Node.js環境ではdynamic importでnode:cryptoを読み込む
	// （ブラウザビルド時にtree-shakeされるように）
	const { randomUUID } = await import("node:crypto");
	return randomUUID();
}
