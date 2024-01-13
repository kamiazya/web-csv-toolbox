export class SingleValueReadableStream<T> extends ReadableStream<T> {
  constructor(value: T) {
    super({
      start(controller) {
        controller.enqueue(value);
        controller.close();
      },
    });
  }
}
