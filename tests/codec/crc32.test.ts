import { describe, it, expect } from "vitest";
import { crc32, crc32_bytes, verify_crc32 } from "../../src/codec/crc32.js";

describe("crc32", () => {
  it("computes correct CRC32 for empty input", () => {
    expect(crc32(new Uint8Array([]))).toBe(0x00000000);
  });

  it("computes correct CRC32 for known value", () => {
    // "123456789" CRC32 = 0xCBF43926
    const data = new TextEncoder().encode("123456789");
    expect(crc32(data)).toBe(0xcbf43926);
  });

  it("crc32_bytes returns 4 big-endian bytes", () => {
    const data = new TextEncoder().encode("123456789");
    const bytes = crc32_bytes(data);
    expect(bytes.length).toBe(4);
    expect(bytes[0]).toBe(0xcb);
    expect(bytes[1]).toBe(0xf4);
    expect(bytes[2]).toBe(0x39);
    expect(bytes[3]).toBe(0x26);
  });

  it("verify_crc32 accepts valid data", () => {
    const data = new TextEncoder().encode("hello world");
    const checksum = crc32_bytes(data);
    const buf = new Uint8Array(data.length + 4);
    buf.set(data, 0);
    buf.set(checksum, data.length);
    expect(verify_crc32(buf)).toBe(true);
  });

  it("verify_crc32 rejects corrupted data", () => {
    const data = new TextEncoder().encode("hello world");
    const checksum = crc32_bytes(data);
    const buf = new Uint8Array(data.length + 4);
    buf.set(data, 0);
    buf.set(checksum, data.length);

    // Corrupt one byte
    buf[3] ^= 0xff;
    expect(verify_crc32(buf)).toBe(false);
  });

  it("verify_crc32 rejects too-short buffer", () => {
    expect(verify_crc32(new Uint8Array([0x00, 0x00, 0x00]))).toBe(false);
  });
});
