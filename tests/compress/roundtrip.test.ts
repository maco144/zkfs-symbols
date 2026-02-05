import { describe, it, expect } from "vitest";
import { compress_blob, decompress_blob } from "../../src/compress/pipeline.js";
import { Dictionary } from "../../src/compress/dictionary.js";

describe("compress roundtrip property tests", () => {
  const ITERATIONS = 30;

  it("round-trips random text data without dictionary", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const len = Math.floor(Math.random() * 1000) + 1;
      const chars = "abcdefghijklmnopqrstuvwxyz0123456789 \n\t{}[]\":,";
      let str = "";
      for (let j = 0; j < len; j++) str += chars[Math.floor(Math.random() * chars.length)];
      const data = new TextEncoder().encode(str);

      const compressed = compress_blob(data);
      const decompressed = decompress_blob(compressed);
      expect(decompressed).toEqual(data);
    }
  });

  it("round-trips random binary data without dictionary", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const len = Math.floor(Math.random() * 500);
      const data = new Uint8Array(len);
      for (let j = 0; j < len; j++) data[j] = Math.floor(Math.random() * 256);

      const compressed = compress_blob(data);
      const decompressed = decompress_blob(compressed);
      expect(decompressed).toEqual(data);
    }
  });

  it("round-trips with trained dictionary on JSON-like data", () => {
    // Training samples
    const templates = [
      '{"type":"file","hash":"XXXX","size":NNN}',
      '{"type":"dir","root":"XXXX","group":null}',
      '{"name":"XXXX","created":NNN,"modified":NNN}',
    ];

    const samples = [];
    for (let i = 0; i < 20; i++) {
      const t = templates[i % templates.length]
        .replace(/XXXX/g, () => Math.random().toString(36).slice(2, 10))
        .replace(/NNN/g, () => String(Math.floor(Math.random() * 1000000)));
      samples.push(new TextEncoder().encode(t));
    }

    const dict = Dictionary.train(samples);

    for (let i = 0; i < ITERATIONS; i++) {
      const t = templates[i % templates.length]
        .replace(/XXXX/g, () => Math.random().toString(36).slice(2, 10))
        .replace(/NNN/g, () => String(Math.floor(Math.random() * 1000000)));
      const data = new TextEncoder().encode(t);

      const compressed = compress_blob(data, { dictionary: dict });
      const decompressed = decompress_blob(compressed, { dictionary: dict });
      expect(decompressed).toEqual(data);
    }
  });
});
