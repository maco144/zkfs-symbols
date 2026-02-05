import { describe, it, expect } from "vitest";
import { encode_node, decode_node } from "../../src/codec/node.js";
import type { FileNode, DirNode } from "../../src/types.js";

function random_bytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  for (let i = 0; i < n; i++) buf[i] = Math.floor(Math.random() * 256);
  return buf;
}

describe("node dispatcher", () => {
  it("encodes/decodes FileNode via dispatcher", () => {
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

    const encoded = encode_node(node);
    const decoded = decode_node(encoded);

    expect(decoded.type).toBe("file");
    if (decoded.type === "file") {
      expect(decoded.content_hash).toEqual(node.content_hash);
      expect(decoded.chunks.length).toBe(1);
    }
  });

  it("encodes/decodes DirNode via dispatcher", () => {
    const node: DirNode = {
      type: "dir",
      smt_root: random_bytes(32),
      group_id: random_bytes(32),
      created: Date.now(),
      modified: Date.now(),
    };

    const encoded = encode_node(node);
    const decoded = decode_node(encoded);

    expect(decoded.type).toBe("dir");
    if (decoded.type === "dir") {
      expect(decoded.smt_root).toEqual(node.smt_root);
      expect(decoded.group_id).toEqual(node.group_id);
    }
  });

  it("decodes legacy JSON-encoded FileNode", () => {
    const node: FileNode = {
      type: "file",
      content_hash: new Uint8Array(32),
      size: 100,
      created: 1700000000000,
      modified: 1700000000000,
      chunks: [],
    };

    // Simulate legacy JSON encoding
    const json = JSON.stringify(node, (_, v) =>
      v instanceof Uint8Array ? { __uint8array: Array.from(v) } : v
    );
    const legacy_buf = new TextEncoder().encode(json);

    const decoded = decode_node(legacy_buf);
    expect(decoded.type).toBe("file");
    if (decoded.type === "file") {
      expect(decoded.size).toBe(100);
      expect(decoded.created).toBe(1700000000000);
    }
  });

  it("decodes legacy JSON-encoded DirNode", () => {
    const node: DirNode = {
      type: "dir",
      smt_root: new Uint8Array(32),
      group_id: null,
      created: 1700000000000,
      modified: 1700000000000,
    };

    const json = JSON.stringify(node, (_, v) =>
      v instanceof Uint8Array ? { __uint8array: Array.from(v) } : v
    );
    const legacy_buf = new TextEncoder().encode(json);

    const decoded = decode_node(legacy_buf);
    expect(decoded.type).toBe("dir");
    if (decoded.type === "dir") {
      expect(decoded.group_id).toBeNull();
    }
  });
});
