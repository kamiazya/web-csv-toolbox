import { describe, expect, it, vi } from "vitest";
import { addListener, removeListener } from "@/worker/utils/workerUtils.ts";

describe("workerUtils", () => {
  describe("addListener", () => {
    it("should use addEventListener for Web Workers", () => {
      const worker = {
        addEventListener: vi.fn(),
      } as unknown as Worker;

      const handler = vi.fn();
      addListener(worker, "message", handler);

      expect(worker.addEventListener).toHaveBeenCalledWith("message", handler);
    });

    it("should use on() for Node.js Worker Threads", () => {
      const worker = {
        on: vi.fn(),
      } as unknown as Worker;

      const handler = vi.fn();
      addListener(worker, "message", handler);

      expect((worker as any).on).toHaveBeenCalledWith(
        "message",
        expect.any(Function),
      );
    });

    it("should normalize message handler for Node.js workers", () => {
      const mockOn = vi.fn();
      const worker = {
        on: mockOn,
      } as unknown as Worker;

      const handler = vi.fn();
      addListener(worker, "message", handler);

      // Get the normalized handler that was passed to worker.on()
      const normalizedHandler = mockOn.mock.calls[0][1];

      // When Node.js worker emits data directly
      const testData = { foo: "bar" };
      normalizedHandler(testData);

      // Handler should receive { data: testData } to match Web Workers API
      expect(handler).toHaveBeenCalledWith({ data: testData });
    });

    it("should not normalize error handler for Node.js workers", () => {
      const mockOn = vi.fn();
      const worker = {
        on: mockOn,
      } as unknown as Worker;

      const handler = vi.fn();
      addListener(worker, "error", handler);

      // Error handler should be passed through without normalization
      const normalizedHandler = mockOn.mock.calls[0][1];
      expect(normalizedHandler).toBe(handler);
    });

    it("should handle multiple listeners on same worker", () => {
      const worker = {
        addEventListener: vi.fn(),
      } as unknown as Worker;

      const handler1 = vi.fn();
      const handler2 = vi.fn();

      addListener(worker, "message", handler1);
      addListener(worker, "message", handler2);

      expect(worker.addEventListener).toHaveBeenCalledTimes(2);
    });

    it("should handle both message and error events", () => {
      const worker = {
        addEventListener: vi.fn(),
      } as unknown as Worker;

      const messageHandler = vi.fn();
      const errorHandler = vi.fn();

      addListener(worker, "message", messageHandler);
      addListener(worker, "error", errorHandler);

      expect(worker.addEventListener).toHaveBeenCalledWith(
        "message",
        messageHandler,
      );
      expect(worker.addEventListener).toHaveBeenCalledWith(
        "error",
        errorHandler,
      );
    });
  });

  describe("removeListener", () => {
    it("should use removeEventListener for Web Workers", () => {
      const worker = {
        removeEventListener: vi.fn(),
      } as unknown as Worker;

      const handler = vi.fn();
      removeListener(worker, "message", handler);

      expect(worker.removeEventListener).toHaveBeenCalledWith(
        "message",
        handler,
      );
    });

    it("should use off() for Node.js Worker Threads", () => {
      const worker = {
        on: vi.fn(),
        off: vi.fn(),
      } as unknown as Worker;

      const handler = vi.fn();

      // First add listener to populate the handler map
      addListener(worker, "message", handler);

      // Then remove it
      removeListener(worker, "message", handler);

      expect((worker as any).off).toHaveBeenCalledWith(
        "message",
        expect.any(Function),
      );
    });

    it("should remove the correct normalized handler for Node.js workers", () => {
      const mockOn = vi.fn();
      const mockOff = vi.fn();
      const worker = {
        on: mockOn,
        off: mockOff,
      } as unknown as Worker;

      const handler = vi.fn();

      // Add listener
      addListener(worker, "message", handler);
      const addedHandler = mockOn.mock.calls[0][1];

      // Remove listener
      removeListener(worker, "message", handler);
      const removedHandler = mockOff.mock.calls[0][1];

      // The same normalized handler should be added and removed
      expect(removedHandler).toBe(addedHandler);
    });

    it("should handle removing listener that was never added", () => {
      const worker = {
        off: vi.fn(),
      } as unknown as Worker;

      const handler = vi.fn();

      // Should not throw
      expect(() => {
        removeListener(worker, "message", handler);
      }).not.toThrow();

      // Should still call off with the original handler
      expect((worker as any).off).toHaveBeenCalledWith("message", handler);
    });

    it("should clean up handler map after removal", () => {
      const mockOn = vi.fn();
      const mockOff = vi.fn();
      const worker = {
        on: mockOn,
        off: mockOff,
      } as unknown as Worker;

      const handler = vi.fn();

      // Add and remove
      addListener(worker, "message", handler);
      removeListener(worker, "message", handler);

      // Try to remove again - should use original handler since map is cleaned
      removeListener(worker, "message", handler);

      expect(mockOff).toHaveBeenCalledTimes(2);
    });
  });

  describe("Integration scenarios", () => {
    it("should handle add/remove cycle for Web Workers", () => {
      const worker = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as Worker;

      const handler = vi.fn();

      addListener(worker, "message", handler);
      removeListener(worker, "message", handler);

      expect(worker.addEventListener).toHaveBeenCalledWith("message", handler);
      expect(worker.removeEventListener).toHaveBeenCalledWith(
        "message",
        handler,
      );
    });

    it("should handle add/remove cycle for Node.js workers", () => {
      const mockOn = vi.fn();
      const mockOff = vi.fn();
      const worker = {
        on: mockOn,
        off: mockOff,
      } as unknown as Worker;

      const handler = vi.fn();

      addListener(worker, "message", handler);
      const addedHandler = mockOn.mock.calls[0][1];

      removeListener(worker, "message", handler);
      const removedHandler = mockOff.mock.calls[0][1];

      // Same normalized handler should be used
      expect(addedHandler).toBe(removedHandler);
    });

    it("should handle multiple add/remove operations", () => {
      const worker = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as Worker;

      const handler1 = vi.fn();
      const handler2 = vi.fn();

      addListener(worker, "message", handler1);
      addListener(worker, "error", handler2);
      removeListener(worker, "message", handler1);
      removeListener(worker, "error", handler2);

      expect(worker.addEventListener).toHaveBeenCalledTimes(2);
      expect(worker.removeEventListener).toHaveBeenCalledTimes(2);
    });

    it("should isolate handlers between different workers", () => {
      const worker1 = {
        on: vi.fn(),
        off: vi.fn(),
      } as unknown as Worker;

      const worker2 = {
        on: vi.fn(),
        off: vi.fn(),
      } as unknown as Worker;

      const handler = vi.fn();

      addListener(worker1, "message", handler);
      addListener(worker2, "message", handler);

      removeListener(worker1, "message", handler);

      // worker2 should still have its handler
      expect((worker1 as any).off).toHaveBeenCalledTimes(1);
      expect((worker2 as any).off).toHaveBeenCalledTimes(0);
    });
  });

  describe("Edge cases", () => {
    it("should handle undefined handler gracefully", () => {
      const worker = {
        addEventListener: vi.fn(),
      } as unknown as Worker;

      const handler = undefined as any;

      expect(() => {
        addListener(worker, "message", handler);
      }).not.toThrow();
    });

    it("should maintain separate mappings for message and error events", () => {
      const mockOn = vi.fn();
      const mockOff = vi.fn();
      const worker = {
        on: mockOn,
        off: mockOff,
      } as unknown as Worker;

      const messageHandler = vi.fn();
      const errorHandler = vi.fn();

      addListener(worker, "message", messageHandler);
      addListener(worker, "error", errorHandler);

      // Error handler should not be normalized
      const addedErrorHandler = mockOn.mock.calls[1][1];
      expect(addedErrorHandler).toBe(errorHandler);

      // Message handler should be normalized
      const addedMessageHandler = mockOn.mock.calls[0][1];
      expect(addedMessageHandler).not.toBe(messageHandler);
    });
  });
});
