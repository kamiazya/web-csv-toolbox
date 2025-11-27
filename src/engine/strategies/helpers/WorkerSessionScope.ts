import type { InternalEngineConfig } from "@/engine/config/InternalEngineConfig.ts";
import { WorkerSession } from "@/worker/helpers/WorkerSession.ts";

/**
 * Encapsulates WorkerSession lifecycle management.
 *
 * Handles the ownership semantics: if a session is provided, it's borrowed
 * and not disposed; if created internally, it's owned and disposed.
 *
 * @internal
 */
export class WorkerSessionScope implements Disposable {
  private readonly session: WorkerSession;
  private readonly owned: boolean;

  private constructor(session: WorkerSession, owned: boolean) {
    this.session = session;
    this.owned = owned;
  }

  /**
   * Create a scope from an existing session (borrowed, not disposed on exit)
   * or create a new session (owned, disposed on exit).
   */
  static async create(
    providedSession: WorkerSession | null,
    engineConfig: InternalEngineConfig,
  ): Promise<WorkerSessionScope> {
    if (providedSession !== null) {
      return new WorkerSessionScope(providedSession, false);
    }

    const newSession = await WorkerSession.create({
      workerPool: engineConfig.workerPool,
      workerURL: engineConfig.workerURL,
    });

    return new WorkerSessionScope(newSession, true);
  }

  /**
   * Get the underlying worker.
   */
  getWorker(): Worker {
    return this.session.getWorker();
  }

  /**
   * Get the next request ID.
   */
  getNextRequestId(): number {
    return this.session.getNextRequestId();
  }

  /**
   * Dispose the session if owned.
   *
   * Call this method manually in try-finally blocks for Node.js < 24 compatibility.
   * When Node.js 24 becomes the minimum supported version, use `using` syntax instead:
   * ```ts
   * // Node.js 24+:
   * using scope = await WorkerSessionScope.create(session, engineConfig);
   *
   * // Node.js < 24 (current):
   * const scope = await WorkerSessionScope.create(session, engineConfig);
   * try {
   *   // ... use scope
   * } finally {
   *   scope.dispose();
   * }
   * ```
   */
  dispose(): void {
    if (this.owned) {
      this.session.dispose();
    }
  }

  /**
   * Symbol.dispose implementation for explicit resource management.
   * @see https://github.com/tc39/proposal-explicit-resource-management
   */
  [Symbol.dispose](): void {
    this.dispose();
  }
}
