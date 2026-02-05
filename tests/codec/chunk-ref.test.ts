import { describe, it, expect } from "vitest";
import { encode_chunk_ref, decode_chunk_ref } from "../../src/codec/chunk-ref.js";
import type { ChunkRef } from "../../src/types.js";

function random_bytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  for (let i = 0; i < n; i++) buf[i] = Math.floor(Math.random() * 256);
  return buf;
}

describe("chunk-ref", () => {
  it("round-trips a basic ChunkRef", () => {
    const ref: ChunkRef = {
      index: 0,
      hash: random_bytes(32),
      blob_address: random_bytes(32),
      nonce: random_bytes(24),
    };

    const encoded = encode_chunk_ref(ref);
    const [decoded, bytes_read] = decode_chunk_ref(encoded, 0);

    expect(bytes_read).toBe(encoded.length);
    expect(decoded.index).toBe(ref.index);
    expect(decoded.hash).toEqual(ref.hash);
    expect(decoded.blob_address).toEqual(ref.blob_address);
    expect(decoded.nonce).toEqual(ref.nonce);
  });

  it("round-trips a ChunkRef with large index", () => {
    const ref: ChunkRef = {
      index: 10000,
      hash: random_bytes(32),
      blob_address: random_bytes(32),
      nonce: random_bytes(24),
    };

    const encoded = encode_chunk_ref(ref);
    const [decoded, _] = decode_chunk_ref(encoded, 0);
    expect(decoded.index).toBe(10000);
  });

  it("decodes at arbitrary offset", () => {
    const ref: ChunkRef = {
      index: 5,
      hash: random_bytes(32),
      blob_address: random_bytes(32),
      nonce: random_bytes(24),
    };

    const encoded = encode_chunk_ref(ref);
    const prefix = new Uint8Array(10);
    const buf = new Uint8Array(prefix.length + encoded.length);
    buf.set(prefix, 0);
    buf.set(encoded, prefix.length);

    const [decoded, bytes_read] = decode_chunk_ref(buf, prefix.length);
    expect(decoded.index).toBe(5);
    expect(bytes_read).toBe(encoded.length);
  });
});
