/**
 * Disposable リソース管理のためのユーティリティ
 *
 * JavaScript の Symbol.dispose / Symbol.asyncDispose を使った
 * 明示的リソース管理（Explicit Resource Management）をサポート
 *
 * @see https://github.com/tc39/proposal-explicit-resource-management
 */

/**
 * 複数の AsyncDisposable リソースを組み合わせて単一の AsyncDisposable を作成
 *
 * @example
 * ```typescript
 * const combined = combineAsyncDisposable(source, backend, store);
 * await using resources = combined;
 * // すべてのリソースが自動的に破棄される
 * ```
 */
export function combineAsyncDisposable(
	...disposables: (AsyncDisposable | null | undefined)[]
): AsyncDisposable {
	return {
		async [Symbol.asyncDispose]() {
			const errors: Error[] = [];

			// 逆順で破棄（後に作成されたリソースから破棄）
			for (const disposable of disposables.reverse()) {
				if (disposable) {
					try {
						await disposable[Symbol.asyncDispose]();
					} catch (error) {
						errors.push(
							error instanceof Error ? error : new Error(String(error)),
						);
					}
				}
			}

			// 複数のエラーが発生した場合は AggregateError をスロー
			if (errors.length > 0) {
				throw new AggregateError(
					errors,
					`Failed to dispose ${errors.length} resource(s)`,
				);
			}
		},
	};
}

/**
 * 複数の Disposable リソースを組み合わせて単一の Disposable を作成
 *
 * @example
 * ```typescript
 * const combined = combineDisposable(source, backend);
 * using resources = combined;
 * // すべてのリソースが自動的に破棄される
 * ```
 */
export function combineDisposable(
	...disposables: (Disposable | null | undefined)[]
): Disposable {
	return {
		[Symbol.dispose]() {
			const errors: Error[] = [];

			// 逆順で破棄（後に作成されたリソースから破棄）
			for (const disposable of disposables.reverse()) {
				if (disposable) {
					try {
						disposable[Symbol.dispose]();
					} catch (error) {
						errors.push(
							error instanceof Error ? error : new Error(String(error)),
						);
					}
				}
			}

			// 複数のエラーが発生した場合は AggregateError をスロー
			if (errors.length > 0) {
				throw new AggregateError(
					errors,
					`Failed to dispose ${errors.length} resource(s)`,
				);
			}
		},
	};
}

/**
 * noop の AsyncDisposable を作成
 * リソース破棄が不要な場合に使用
 */
export const noopAsyncDisposable: AsyncDisposable = {
	async [Symbol.asyncDispose]() {
		// 何もしない
	},
};

/**
 * noop の Disposable を作成
 * リソース破棄が不要な場合に使用
 */
export const noopDisposable: Disposable = {
	[Symbol.dispose]() {
		// 何もしない
	},
};

/**
 * カスタムクリーンアップ関数から AsyncDisposable を作成
 *
 * @example
 * ```typescript
 * const resource = createAsyncDisposable(async () => {
 *   await cleanup();
 * });
 * await using r = resource;
 * ```
 */
export function createAsyncDisposable(
	cleanup: () => Promise<void>,
): AsyncDisposable {
	return {
		async [Symbol.asyncDispose]() {
			await cleanup();
		},
	};
}

/**
 * カスタムクリーンアップ関数から Disposable を作成
 *
 * @example
 * ```typescript
 * const resource = createDisposable(() => {
 *   cleanup();
 * });
 * using r = resource;
 * ```
 */
export function createDisposable(cleanup: () => void): Disposable {
	return {
		[Symbol.dispose]() {
			cleanup();
		},
	};
}
