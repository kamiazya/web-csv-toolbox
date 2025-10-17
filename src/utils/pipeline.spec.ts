import { describe, it, expect } from 'vitest';
import { pipeline } from './pipeline';

describe('pipeline', () => {
  it('should chain two transformers', async () => {
    const input = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.enqueue(2);
        controller.close();
      }
    });

    const double = new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk * 2);
      }
    });

    const addOne = new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk + 1);
      }
    });

    const result = pipeline(input, double, addOne);
    const reader = result.getReader();
    
    expect((await reader.read()).value).toBe(3); // (1 * 2) + 1
    expect((await reader.read()).value).toBe(5); // (2 * 2) + 1
    expect((await reader.read()).done).toBe(true);
  });

  it('should chain three transformers', async () => {
    const input = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.enqueue(2);
        controller.close();
      }
    });

    const double = new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk * 2);
      }
    });

    const addOne = new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk + 1);
      }
    });

    const toString = new TransformStream({
        transform(chunk, controller) {
          controller.enqueue(String(chunk));
        }
      });

    const result = pipeline(input, double, addOne, toString);
    const reader = result.getReader();
    
    expect((await reader.read()).value).toBe('3');
    expect((await reader.read()).value).toBe('5');
    expect((await reader.read()).done).toBe(true);
  });

  it('should propagate errors', async () => {
    const input = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.close();
      }
    });

    const errorTransformer = new TransformStream({
      transform() {
        throw new Error('test error');
      }
    });

    const result = pipeline(input, errorTransformer);
    const reader = result.getReader();

    await expect(reader.read()).rejects.toThrow('test error');
  });

  it('should propagate errors from controller', async () => {
    const input = new ReadableStream({
        start(controller) {
          controller.enqueue(1);
          controller.close();
        }
      });
  
      const errorTransformer = new TransformStream({
        transform(chunk, controller) {
          controller.error(new Error('test error'));
        }
      });
  
      const result = pipeline(input, errorTransformer);
      const reader = result.getReader();
  
      await expect(reader.read()).rejects.toThrow('test error');
  });

  it('should close the stream', async () => {
    const input = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.close();
      }
    });

    const identity = new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk);
      }
    });

    const result = pipeline(input, identity);
    const reader = result.getReader();
    
    await reader.read();
    const { done } = await reader.read();
    expect(done).toBe(true);
  });
});
