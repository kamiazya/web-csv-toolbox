import { describe, it, expect } from 'vitest';
import { pipeline } from './pipeline';

async function streamToArray<T>(stream: ReadableStream<T>): Promise<T[]> {
  const reader = stream.getReader();
  const chunks: T[] = [];
  let result;
  while (!(result = await reader.read()).done) {
    chunks.push(result.value);
  }
  return chunks;
}

const createInputStream = (values: any[]) => new ReadableStream({
  start(controller) {
    for (const value of values) {
      controller.enqueue(value);
    }
    controller.close();
  }
});

const createDoubleTransformer = () => new TransformStream({
  transform(chunk, controller) {
    controller.enqueue(chunk * 2);
  }
});

const createAddOneTransformer = () => new TransformStream({
  transform(chunk, controller) {
    controller.enqueue(chunk + 1);
  }
});

const createToStringTransformer = () => new TransformStream({
    transform(chunk, controller) {
      controller.enqueue(String(chunk));
    }
  });

const createErrorTransformer = () => new TransformStream({
  transform() {
    throw new Error('test error');
  }
});

const createErrorControllerTransformer = () => new TransformStream({
  transform(chunk, controller) {
    controller.error(new Error('test error'));
  }
});

const createIdentityTransformer = () => new TransformStream({
  transform(chunk, controller) {
    controller.enqueue(chunk);
  }
});

describe('pipeline', () => {
  it('should chain two transformers', async () => {
    const input = createInputStream([1, 2]);
    const double = createDoubleTransformer();
    const addOne = createAddOneTransformer();

    const result = pipeline(input, double, addOne);
    
    expect(await streamToArray(result)).toEqual([3, 5]);
  });

  it('should chain three transformers', async () => {
    const input = createInputStream([1, 2]);
    const double = createDoubleTransformer();
    const addOne = createAddOneTransformer();
    const toString = createToStringTransformer();

    const result = pipeline(input, double, addOne, toString);
    
    expect(await streamToArray(result)).toEqual(['3', '5']);
  });

  it('should propagate errors', async () => {
    const input = createInputStream([1]);
    const errorTransformer = createErrorTransformer();

    const result = pipeline(input, errorTransformer);

    await expect(streamToArray(result)).rejects.toThrow('test error');
  });

  it('should propagate errors from controller', async () => {
    const input = createInputStream([1]);
    const errorTransformer = createErrorControllerTransformer();

    const result = pipeline(input, errorTransformer);

    await expect(streamToArray(result)).rejects.toThrow('test error');
  });

  it('should close the stream', async () => {
    const input = createInputStream([1]);
    const identity = createIdentityTransformer();

    const result = pipeline(input, identity);
    
    expect(await streamToArray(result)).toEqual([1]);
  });
});