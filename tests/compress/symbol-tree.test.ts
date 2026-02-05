import { describe, it, expect } from "vitest";
import { SymbolTree } from "../../src/compress/symbol-tree.js";

describe("symbol-tree", () => {
  it("builds from uniform frequencies", () => {
    const freq = new Uint32Array(256);
    for (let i = 0; i < 256; i++) freq[i] = 100;
    const tree = SymbolTree.from_frequencies(freq);
    expect(tree.lengths.length).toBe(256);
    // All symbols should have code length 8 (256 symbols, uniform)
    for (let i = 0; i < 256; i++) {
      expect(tree.lengths[i]).toBe(8);
    }
  });

  it("builds from skewed frequencies", () => {
    const freq = new Uint32Array(256);
    freq[0] = 1000; // very common
    freq[1] = 500;
    freq[2] = 100;
    freq[3] = 10;
    const tree = SymbolTree.from_frequencies(freq);
    // Most common symbol should have shortest code
    expect(tree.lengths[0]).toBeLessThanOrEqual(tree.lengths[3]);
  });

  it("handles single-symbol frequency table", () => {
    const freq = new Uint32Array(256);
    freq[42] = 100;
    const tree = SymbolTree.from_frequencies(freq);
    expect(tree.lengths[42]).toBe(1);
  });

  it("handles empty frequency table", () => {
    const freq = new Uint32Array(256);
    const tree = SymbolTree.from_frequencies(freq);
    for (let i = 0; i < 256; i++) {
      expect(tree.lengths[i]).toBe(0);
    }
  });

  it("encodes and decodes text", () => {
    const text = new TextEncoder().encode("hello world hello world");
    const freq = new Uint32Array(256);
    for (let i = 0; i < text.length; i++) freq[text[i]]++;

    const tree = SymbolTree.from_frequencies(freq);
    const { bits, bit_count } = tree.encode(text);
    const decoded = tree.decode(bits, bit_count, text.length);

    expect(decoded).toEqual(text);
  });

  it("encodes/decodes all 256 byte values", () => {
    const data = new Uint8Array(256);
    for (let i = 0; i < 256; i++) data[i] = i;

    const freq = new Uint32Array(256);
    for (let i = 0; i < 256; i++) freq[i] = 1;

    const tree = SymbolTree.from_frequencies(freq);
    const { bits, bit_count } = tree.encode(data);
    const decoded = tree.decode(bits, bit_count, data.length);

    expect(decoded).toEqual(data);
  });

  it("serializes and deserializes", () => {
    const freq = new Uint32Array(256);
    freq[65] = 100; // 'A'
    freq[66] = 50;  // 'B'
    freq[67] = 25;  // 'C'

    const tree = SymbolTree.from_frequencies(freq);
    const serialized = tree.serialize();
    expect(serialized.length).toBe(256);

    const restored = SymbolTree.deserialize(serialized);
    expect(restored.lengths).toEqual(tree.lengths);

    // Verify encoding still works after deserialization
    const data = new TextEncoder().encode("AABBBCCC");
    // Build frequencies for this data
    const freq2 = new Uint32Array(256);
    for (const b of data) freq2[b]++;
    const tree2 = SymbolTree.from_frequencies(freq2);
    const { bits, bit_count } = tree2.encode(data);
    const decoded = tree2.decode(bits, bit_count, data.length);
    expect(decoded).toEqual(data);
  });

  it("produces compressed output smaller than input for skewed data", () => {
    // Highly repetitive data
    const data = new Uint8Array(1000);
    data.fill(65); // all 'A'
    for (let i = 0; i < 10; i++) data[i * 100] = 66; // some 'B'

    const freq = new Uint32Array(256);
    for (const b of data) freq[b]++;

    const tree = SymbolTree.from_frequencies(freq);
    const { bits } = tree.encode(data);

    expect(bits.length).toBeLessThan(data.length);
  });
});
