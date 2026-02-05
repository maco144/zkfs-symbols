import { describe, it, expect } from "vitest";
import { encode_varint, decode_varint } from "../../src/codec/varint.js";

describe("varint", () => {
  it("encodes/decodes 0", () => {
    const buf = encode_varint(0);
    expect(buf).toEqual(new Uint8Array([0x00]));
    expect(decode_varint(buf, 0)).toEqual([0, 1]);
  });

  it("encodes/decodes 1", () => {
    const buf = encode_varint(1);
    expect(buf).toEqual(new Uint8Array([0x01]));
    expect(decode_varint(buf, 0)).toEqual([1, 1]);
  });

  it("encodes/decodes 127 (max single byte)", () => {
    const buf = encode_varint(127);
    expect(buf).toEqual(new Uint8Array([0x7f]));
    expect(decode_varint(buf, 0)).toEqual([127, 1]);
  });

  it("encodes/decodes 128 (first two-byte)", () => {
    const buf = encode_varint(128);
    expect(buf).toEqual(new Uint8Array([0x80, 0x01]));
    expect(decode_varint(buf, 0)).toEqual([128, 2]);
  });

  it("encodes/decodes 300", () => {
    const buf = encode_varint(300);
    const [val, len] = decode_varint(buf, 0);
    expect(val).toBe(300);
    expect(len).toBe(buf.length);
  });

  it("encodes/decodes 16384", () => {
    const buf = encode_varint(16384);
    const [val, len] = decode_varint(buf, 0);
    expect(val).toBe(16384);
    expect(len).toBe(buf.length);
  });

  it("encodes/decodes large number (1_000_000)", () => {
    const buf = encode_varint(1_000_000);
    const [val, len] = decode_varint(buf, 0);
    expect(val).toBe(1_000_000);
    expect(len).toBe(buf.length);
  });

  it("encodes/decodes very large number (2^48)", () => {
    const n = 2 ** 48;
    const buf = encode_varint(n);
    const [val, len] = decode_varint(buf, 0);
    expect(val).toBe(n);
    expect(len).toBe(buf.length);
  });

  it("decodes at arbitrary offset", () => {
    const prefix = new Uint8Array([0xff, 0xff, 0xff]);
    const varint = encode_varint(42);
    const buf = new Uint8Array(prefix.length + varint.length);
    buf.set(prefix, 0);
    buf.set(varint, prefix.length);
    const [val, len] = decode_varint(buf, prefix.length);
    expect(val).toBe(42);
    expect(len).toBe(varint.length);
  });

  it("throws on negative input", () => {
    expect(() => encode_varint(-1)).toThrow("non-negative");
  });

  it("throws on truncated buffer", () => {
    expect(() => decode_varint(new Uint8Array([0x80]), 0)).toThrow("unexpected end");
  });
});
