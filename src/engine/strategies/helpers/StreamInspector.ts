/**
 * Result of stream inspection.
 * @internal
 */
export interface StreamInspectionResult {
  /**
   * The type of the stream based on the first chunk.
   */
  type: "parseStringStream" | "parseBinaryStream";

  /**
   * The reconstructed stream with the first chunk put back.
   */
  stream: ReadableStream<string | Uint8Array>;
}

/**
 * Inspects a stream's first chunk to determine its type, then reconstructs
 * the stream with the first chunk put back.
 *
 * @param input - The stream to inspect (string or binary stream)
 * @returns Inspection result, or null if the stream is empty
 * @internal
 */
export async function inspectAndReconstructStream(
  input: ReadableStream<string | Uint8Array>,
): Promise<StreamInspectionResult | null> {
  const reader = input.getReader();
  let readerReleased = false;

  try {
    const firstChunk = await reader.read();

    if (firstChunk.done) {
      // Empty stream
      reader.releaseLock();
      readerReleased = true;
      return null;
    }

    // Determine type based on first chunk
    let type: "parseStringStream" | "parseBinaryStream";
    if (typeof firstChunk.value === "string") {
      type = "parseStringStream";
    } else if (firstChunk.value instanceof Uint8Array) {
      type = "parseBinaryStream";
    } else {
      throw new Error(
        `Unsupported stream chunk type: ${typeof firstChunk.value}`,
      );
    }

    // Put the first chunk back by creating a new stream
    const reconstructedStream = new ReadableStream<string | Uint8Array>({
      start(controller) {
        controller.enqueue(firstChunk.value);
      },
      pull(controller) {
        reader
          .read()
          .then(({ done, value }) => {
            if (done) {
              controller.close();
            } else {
              controller.enqueue(value);
            }
          })
          .catch((error) => controller.error(error));
      },
      cancel(reason) {
        return reader.cancel(reason).finally(() => {
          if (!readerReleased) {
            try {
              reader.releaseLock();
              readerReleased = true;
            } catch {
              // Lock may already be released
            }
          }
        });
      },
    });

    return {
      type,
      stream: reconstructedStream,
    };
  } catch (error) {
    // Release reader lock if not already released
    if (!readerReleased) {
      try {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      } catch {
        // Lock may already be released
      }
    }
    throw error;
  }
}
