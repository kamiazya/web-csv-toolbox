import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InternalEngineConfig } from "@/engine/config/InternalEngineConfig.ts";
import { WorkerSession } from "@/worker/helpers/WorkerSession.ts";
import { WorkerSessionScope } from "./WorkerSessionScope.ts";

// Mock WorkerSession
vi.mock("@/worker/helpers/WorkerSession.ts", () => ({
  WorkerSession: {
    create: vi.fn(),
  },
}));

// Create mock worker
function createMockWorker(): Worker {
  return {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onmessage: null,
    onmessageerror: null,
    onerror: null,
  } as unknown as Worker;
}

// Create mock WorkerSession
function createMockWorkerSession(worker: Worker): WorkerSession {
  let requestId = 0;
  const disposeFunc = vi.fn();

  return {
    getWorker: () => worker,
    getNextRequestId: () => requestId++,
    [Symbol.dispose]: disposeFunc,
    // Expose dispose for testing
    __disposeMock: disposeFunc,
  } as unknown as WorkerSession & { __disposeMock: ReturnType<typeof vi.fn> };
}

// Create mock engine config
function createMockEngineConfig(
  options: Partial<InternalEngineConfig> = {},
): InternalEngineConfig {
  return {
    hasWasm: () => false,
    hasGpu: () => false,
    hasWorker: () => true,
    workerPool: options.workerPool,
    workerURL: options.workerURL,
  } as InternalEngineConfig;
}

describe("WorkerSessionScope", () => {
  let mockWorkerSessionCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockWorkerSessionCreate = vi.mocked(WorkerSession.create);
    mockWorkerSessionCreate.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("create - borrowed session", () => {
    it("should borrow provided session (not owned)", async () => {
      const mockWorker = createMockWorker();
      const providedSession = createMockWorkerSession(mockWorker);
      const engineConfig = createMockEngineConfig();

      const scope = await WorkerSessionScope.create(
        providedSession,
        engineConfig,
      );

      // Should not call WorkerSession.create
      expect(mockWorkerSessionCreate).not.toHaveBeenCalled();

      // Should return the provided session's worker
      expect(scope.getWorker()).toBe(mockWorker);
    });

    it("should delegate getNextRequestId to borrowed session", async () => {
      const mockWorker = createMockWorker();
      const providedSession = createMockWorkerSession(mockWorker);
      const engineConfig = createMockEngineConfig();

      const scope = await WorkerSessionScope.create(
        providedSession,
        engineConfig,
      );

      const id1 = scope.getNextRequestId();
      const id2 = scope.getNextRequestId();
      const id3 = scope.getNextRequestId();

      expect(id1).toBe(0);
      expect(id2).toBe(1);
      expect(id3).toBe(2);
    });

    it("should NOT dispose borrowed session on scope dispose", async () => {
      const mockWorker = createMockWorker();
      const providedSession = createMockWorkerSession(
        mockWorker,
      ) as WorkerSession & {
        __disposeMock: ReturnType<typeof vi.fn>;
      };
      const engineConfig = createMockEngineConfig();

      const scope = await WorkerSessionScope.create(
        providedSession,
        engineConfig,
      );
      scope[Symbol.dispose]();

      // Borrowed session should NOT be disposed
      expect(providedSession.__disposeMock).not.toHaveBeenCalled();
    });
  });

  describe("create - owned session", () => {
    it("should create new session when no session provided (owned)", async () => {
      const mockWorker = createMockWorker();
      const createdSession = createMockWorkerSession(mockWorker);
      mockWorkerSessionCreate.mockResolvedValue(createdSession);

      const engineConfig = createMockEngineConfig();

      const scope = await WorkerSessionScope.create(null, engineConfig);

      // Should call WorkerSession.create
      expect(mockWorkerSessionCreate).toHaveBeenCalledOnce();
      expect(mockWorkerSessionCreate).toHaveBeenCalledWith({
        workerPool: undefined,
        workerURL: undefined,
      });

      // Should return the created session's worker
      expect(scope.getWorker()).toBe(mockWorker);
    });

    it("should pass workerPool to WorkerSession.create", async () => {
      const mockWorker = createMockWorker();
      const createdSession = createMockWorkerSession(mockWorker);
      mockWorkerSessionCreate.mockResolvedValue(createdSession);

      const mockWorkerPool = {
        getWorker: vi.fn(),
        releaseWorker: vi.fn(),
        getNextRequestId: vi.fn(),
      };

      const engineConfig = createMockEngineConfig({
        workerPool: mockWorkerPool as any,
      });

      await WorkerSessionScope.create(null, engineConfig);

      expect(mockWorkerSessionCreate).toHaveBeenCalledWith({
        workerPool: mockWorkerPool,
        workerURL: undefined,
      });
    });

    it("should pass workerURL to WorkerSession.create", async () => {
      const mockWorker = createMockWorker();
      const createdSession = createMockWorkerSession(mockWorker);
      mockWorkerSessionCreate.mockResolvedValue(createdSession);

      const engineConfig = createMockEngineConfig({
        workerURL: "/custom-worker.js",
      });

      await WorkerSessionScope.create(null, engineConfig);

      expect(mockWorkerSessionCreate).toHaveBeenCalledWith({
        workerPool: undefined,
        workerURL: "/custom-worker.js",
      });
    });

    it("should pass URL workerURL to WorkerSession.create", async () => {
      const mockWorker = createMockWorker();
      const createdSession = createMockWorkerSession(mockWorker);
      mockWorkerSessionCreate.mockResolvedValue(createdSession);

      const customURL = new URL("https://example.com/worker.js");
      const engineConfig = createMockEngineConfig({
        workerURL: customURL,
      });

      await WorkerSessionScope.create(null, engineConfig);

      expect(mockWorkerSessionCreate).toHaveBeenCalledWith({
        workerPool: undefined,
        workerURL: customURL,
      });
    });

    it("should dispose owned session on scope dispose", async () => {
      const mockWorker = createMockWorker();
      const createdSession = createMockWorkerSession(
        mockWorker,
      ) as WorkerSession & {
        __disposeMock: ReturnType<typeof vi.fn>;
      };
      mockWorkerSessionCreate.mockResolvedValue(createdSession);

      const engineConfig = createMockEngineConfig();

      const scope = await WorkerSessionScope.create(null, engineConfig);
      scope[Symbol.dispose]();

      // Owned session SHOULD be disposed
      expect(createdSession.__disposeMock).toHaveBeenCalledOnce();
    });

    it("should delegate getNextRequestId to owned session", async () => {
      const mockWorker = createMockWorker();
      const createdSession = createMockWorkerSession(mockWorker);
      mockWorkerSessionCreate.mockResolvedValue(createdSession);

      const engineConfig = createMockEngineConfig();

      const scope = await WorkerSessionScope.create(null, engineConfig);

      const id1 = scope.getNextRequestId();
      const id2 = scope.getNextRequestId();

      expect(id1).toBe(0);
      expect(id2).toBe(1);
    });
  });

  describe("Disposable interface", () => {
    it("should implement Disposable interface", async () => {
      const mockWorker = createMockWorker();
      const providedSession = createMockWorkerSession(mockWorker);
      const engineConfig = createMockEngineConfig();

      const scope = await WorkerSessionScope.create(
        providedSession,
        engineConfig,
      );

      expect(typeof scope[Symbol.dispose]).toBe("function");
    });

    it("should allow multiple dispose calls without error", async () => {
      const mockWorker = createMockWorker();
      const createdSession = createMockWorkerSession(mockWorker);
      mockWorkerSessionCreate.mockResolvedValue(createdSession);

      const engineConfig = createMockEngineConfig();

      const scope = await WorkerSessionScope.create(null, engineConfig);

      // Multiple dispose calls should not throw
      expect(() => {
        scope[Symbol.dispose]();
        scope[Symbol.dispose]();
      }).not.toThrow();
    });
  });

  describe("Worker access", () => {
    it("should return same worker instance on multiple getWorker calls", async () => {
      const mockWorker = createMockWorker();
      const providedSession = createMockWorkerSession(mockWorker);
      const engineConfig = createMockEngineConfig();

      const scope = await WorkerSessionScope.create(
        providedSession,
        engineConfig,
      );

      const worker1 = scope.getWorker();
      const worker2 = scope.getWorker();
      const worker3 = scope.getWorker();

      expect(worker1).toBe(mockWorker);
      expect(worker2).toBe(mockWorker);
      expect(worker3).toBe(mockWorker);
    });
  });

  describe("Edge cases", () => {
    it("should handle undefined optional config properties", async () => {
      const mockWorker = createMockWorker();
      const createdSession = createMockWorkerSession(mockWorker);
      mockWorkerSessionCreate.mockResolvedValue(createdSession);

      const engineConfig = createMockEngineConfig({
        workerPool: undefined,
        workerURL: undefined,
      });

      await expect(
        WorkerSessionScope.create(null, engineConfig),
      ).resolves.toBeDefined();
    });
  });
});
