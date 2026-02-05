import { describe, it, expect } from "vitest";
import { Dictionary } from "../../src/compress/dictionary.js";

describe("dictionary", () => {
  it("trains from samples and round-trips", () => {
    const samples = [
      new TextEncoder().encode('{"type":"file","content_hash":"abc123"}'),
      new TextEncoder().encode('{"type":"file","content_hash":"def456"}'),
      new TextEncoder().encode('{"type":"dir","smt_root":"aaa","group_id":null}'),
      new TextEncoder().encode('{"type":"file","content_hash":"ghi789"}'),
    ];

    const dict = Dictionary.train(samples);
    expect(dict.strings.length).toBeGreaterThan(0);

    // Round-trip each sample
    for (const sample of samples) {
      const compressed = dict.compress(sample);
      const decompressed = dict.decompress(compressed, sample.length);
      expect(decompressed).toEqual(sample);
    }
  });

  it("serializes and deserializes", () => {
    const samples = [
      new TextEncoder().encode("hello world hello world hello world"),
      new TextEncoder().encode("hello world this is a test hello world"),
    ];

    const dict = Dictionary.train(samples);
    const serialized = dict.serialize();
    const restored = Dictionary.deserialize(serialized);

    expect(restored.strings.length).toBe(dict.strings.length);
    for (let i = 0; i < dict.strings.length; i++) {
      expect(restored.strings[i]).toEqual(dict.strings[i]);
    }

    // Verify compression still works
    const data = new TextEncoder().encode("hello world test");
    const compressed = dict.compress(data);
    const decompressed = dict.decompress(compressed, data.length);
    expect(decompressed).toEqual(data);
  });

  it("handles data with null bytes", () => {
    // Data containing literal 0x00 bytes
    const data = new Uint8Array([0x41, 0x00, 0x42, 0x00, 0x43]);
    const dict = Dictionary.train([data, data, data]);

    const compressed = dict.compress(data);
    const decompressed = dict.decompress(compressed, data.length);
    expect(decompressed).toEqual(data);
  });

  it("trains from empty samples", () => {
    const dict = Dictionary.train([]);
    expect(dict.strings.length).toBe(0);
  });

  it("handles single-byte data", () => {
    const data = new Uint8Array([0x42]);
    const samples = [data, data, data];
    const dict = Dictionary.train(samples);

    const compressed = dict.compress(data);
    const decompressed = dict.decompress(compressed, data.length);
    expect(decompressed).toEqual(data);
  });
});
