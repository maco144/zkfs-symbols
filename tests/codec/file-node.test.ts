import { describe, it, expect } from "vitest";
import { encode_file_node, decode_file_node } from "../../src/codec/file-node.js";
import type { FileNode } from "../../src/types.js";

function random_bytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  for (let i = 0; i < n; i++) buf[i] = Math.floor(Math.random() * 256);
  return buf;
}

describe("file-node", () => {
  it("round-trips a single-chunk FileNode", () => {
    const node: FileNode = {
      type: "file",
      content_hash: random_bytes(32),
      size: 1024,
      created: Date.now(),
      modified: Date.now(),
      chunks: [
        {
          index: 0,
          hash: random_bytes(32),
          blob_address: random_bytes(32),
          nonce: random_bytes(24),
        },
      ],
    };

    const encoded = encode_file_node(node);
    const decoded = decode_file_node(encoded);

    expect(decoded.type).toBe("file");
    expect(decoded.content_hash).toEqual(node.content_hash);
    expect(decoded.size).toBe(1024);
    expect(decoded.created).toBe(node.created);
    expect(decoded.modified).toBe(node.modified);
    expect(decoded.chunks.length).toBe(1);
    expect(decoded.chunks[0].index).toBe(0);
    expect(decoded.chunks[0].hash).toEqual(node.chunks[0].hash);
    expect(decoded.chunks[0].blob_address).toEqual(node.chunks[0].blob_address);
    expect(decoded.chunks[0].nonce).toEqual(node.chunks[0].nonce);
  });

  it("round-trips a multi-chunk FileNode", () => {
    const chunks = Array.from({ length: 10 }, (_, i) => ({
      index: i,
      hash: random_bytes(32),
      blob_address: random_bytes(32),
      nonce: random_bytes(24),
    }));

    const node: FileNode = {
      type: "file",
      content_hash: random_bytes(32),
      size: 1_000_000,
      created: 1700000000000,
      modified: 1700001000000,
      chunks,
    };

    const encoded = encode_file_node(node);
    const decoded = decode_file_node(encoded);

    expect(decoded.chunks.length).toBe(10);
    for (let i = 0; i < 10; i++) {
      expect(decoded.chunks[i].index).toBe(i);
      expect(decoded.chunks[i].hash).toEqual(chunks[i].hash);
    }
  });

  it("round-trips a zero-chunk FileNode (empty file)", () => {
    const node: FileNode = {
      type: "file",
      content_hash: random_bytes(32),
      size: 0,
      created: Date.now(),
      modified: Date.now(),
      chunks: [],
    };

    const encoded = encode_file_node(node);
    const decoded = decode_file_node(encoded);

    expect(decoded.size).toBe(0);
    expect(decoded.chunks.length).toBe(0);
  });

  it("single-chunk FileNode is compact (~150 bytes)", () => {
    const node: FileNode = {
      type: "file",
      content_hash: random_bytes(32),
      size: 512,
      created: Date.now(),
      modified: Date.now(),
      chunks: [
        {
          index: 0,
          hash: random_bytes(32),
          blob_address: random_bytes(32),
          nonce: random_bytes(24),
        },
      ],
    };

    const encoded = encode_file_node(node);
    // Should be around 143 bytes + envelope overhead (8 bytes)
    expect(encoded.length).toBeLessThan(160);
  });

  it("rejects corrupted CRC", () => {
    const node: FileNode = {
      type: "file",
      content_hash: random_bytes(32),
      size: 100,
      created: Date.now(),
      modified: Date.now(),
      chunks: [],
    };

    const encoded = encode_file_node(node);
    // Corrupt last byte (CRC)
    encoded[encoded.length - 1] ^= 0xff;
    expect(() => decode_file_node(encoded)).toThrow("CRC32");
  });
});
