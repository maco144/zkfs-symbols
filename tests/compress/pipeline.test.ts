import { describe, it, expect } from "vitest";
import { compress_blob, decompress_blob } from "../../src/compress/pipeline.js";
import { Dictionary } from "../../src/compress/dictionary.js";

describe("pipeline", () => {
  it("round-trips without any compression options", () => {
    const data = new TextEncoder().encode("hello world");
    const compressed = compress_blob(data);
    const decompressed = decompress_blob(compressed);
    expect(decompressed).toEqual(data);
  });

  it("round-trips binary data (no compression applied)", () => {
    const data = new Uint8Array(100);
    for (let i = 0; i < 100; i++) data[i] = Math.floor(Math.random() * 256);

    const compressed = compress_blob(data);
    const decompressed = decompress_blob(compressed);
    expect(decompressed).toEqual(data);
  });

  it("round-trips with dictionary on JSON data", () => {
    const samples = [
      new TextEncoder().encode('{"type":"file","content_hash":"abc123","size":100}'),
      new TextEncoder().encode('{"type":"file","content_hash":"def456","size":200}'),
      new TextEncoder().encode('{"type":"file","content_hash":"ghi789","size":300}'),
    ];

    const dict = Dictionary.train(samples);
    const data = new TextEncoder().encode('{"type":"file","content_hash":"xyz000","size":999}');

    const compressed = compress_blob(data, { dictionary: dict });
    const decompressed = decompress_blob(compressed, { dictionary: dict });
    expect(decompressed).toEqual(data);
  });

  it("round-trips with fallback compressor", () => {
    // Simple "compressor" that just copies (for testing the pipeline path)
    const identity_compress = (data: Uint8Array) => {
      // Return data larger than original to force METHOD_NONE
      const bigger = new Uint8Array(data.length + 10);
      bigger.set(data, 0);
      return bigger;
    };
    const identity_decompress = (data: Uint8Array, _size: number) => data;

    const data = new TextEncoder().encode("test data");
    const compressed = compress_blob(data, {
      fallback_compress: identity_compress,
      fallback_decompress: identity_decompress,
    });
    const decompressed = decompress_blob(compressed, {
      fallback_compress: identity_compress,
      fallback_decompress: identity_decompress,
    });
    expect(decompressed).toEqual(data);
  });

  it("falls back to uncompressed when compression doesn't help", () => {
    // Random binary data won't compress well
    const data = new Uint8Array(50);
    for (let i = 0; i < 50; i++) data[i] = Math.floor(Math.random() * 256);

    const samples = [data];
    const dict = Dictionary.train(samples);

    const compressed = compress_blob(data, { dictionary: dict });
    const decompressed = decompress_blob(compressed, { dictionary: dict });
    expect(decompressed).toEqual(data);
  });

  it("handles empty data", () => {
    const data = new Uint8Array(0);
    const compressed = compress_blob(data);
    const decompressed = decompress_blob(compressed);
    expect(decompressed).toEqual(data);
  });
});
