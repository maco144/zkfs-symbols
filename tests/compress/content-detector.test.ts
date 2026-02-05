import { describe, it, expect } from "vitest";
import { ContentType, detect_content_type } from "../../src/compress/content-detector.js";

describe("content-detector", () => {
  it("detects JSON starting with {", () => {
    const data = new TextEncoder().encode('{"key": "value"}');
    expect(detect_content_type(data)).toBe(ContentType.JSON);
  });

  it("detects JSON starting with [", () => {
    const data = new TextEncoder().encode('[1, 2, 3]');
    expect(detect_content_type(data)).toBe(ContentType.JSON);
  });

  it("detects text/UTF-8", () => {
    const data = new TextEncoder().encode("Hello, world! This is a plain text file.\n");
    expect(detect_content_type(data)).toBe(ContentType.TEXT_UTF8);
  });

  it("detects binary data with null bytes", () => {
    const data = new Uint8Array([0x00, 0x01, 0x02, 0xff, 0x00, 0x50]);
    expect(detect_content_type(data)).toBe(ContentType.BINARY);
  });

  it("detects binary data with low printable ratio", () => {
    const data = new Uint8Array(100);
    for (let i = 0; i < 100; i++) data[i] = i % 20; // lots of control chars
    expect(detect_content_type(data)).toBe(ContentType.BINARY);
  });

  it("returns BINARY for empty data", () => {
    expect(detect_content_type(new Uint8Array([]))).toBe(ContentType.BINARY);
  });

  it("detects text with high-byte UTF-8", () => {
    // UTF-8 encoded "Héllo"
    const data = new TextEncoder().encode("Héllo wörld café");
    expect(detect_content_type(data)).toBe(ContentType.TEXT_UTF8);
  });
});
