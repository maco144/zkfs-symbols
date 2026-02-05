import { describe, it, expect } from "vitest";
import { encode_dir_node, decode_dir_node } from "../../src/codec/dir-node.js";
import type { DirNode } from "../../src/types.js";

function random_bytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  for (let i = 0; i < n; i++) buf[i] = Math.floor(Math.random() * 256);
  return buf;
}

describe("dir-node", () => {
  it("round-trips DirNode with group_id", () => {
    const node: DirNode = {
      type: "dir",
      smt_root: random_bytes(32),
      group_id: random_bytes(32),
      created: Date.now(),
      modified: Date.now(),
    };

    const encoded = encode_dir_node(node);
    const decoded = decode_dir_node(encoded);

    expect(decoded.type).toBe("dir");
    expect(decoded.smt_root).toEqual(node.smt_root);
    expect(decoded.group_id).toEqual(node.group_id);
    expect(decoded.created).toBe(node.created);
    expect(decoded.modified).toBe(node.modified);
  });

  it("round-trips DirNode with null group_id (inherit)", () => {
    const node: DirNode = {
      type: "dir",
      smt_root: random_bytes(32),
      group_id: null,
      created: 1700000000000,
      modified: 1700001000000,
    };

    const encoded = encode_dir_node(node);
    const decoded = decode_dir_node(encoded);

    expect(decoded.group_id).toBeNull();
    expect(decoded.created).toBe(1700000000000);
  });

  it("DirNode with group is ~85 bytes", () => {
    const node: DirNode = {
      type: "dir",
      smt_root: random_bytes(32),
      group_id: random_bytes(32),
      created: Date.now(),
      modified: Date.now(),
    };

    const encoded = encode_dir_node(node);
    // 32 + 1 + 32 + 6 + 6 = 77 payload + 8 envelope = 85
    expect(encoded.length).toBeLessThanOrEqual(85);
  });

  it("DirNode inherit is ~53 bytes", () => {
    const node: DirNode = {
      type: "dir",
      smt_root: random_bytes(32),
      group_id: null,
      created: Date.now(),
      modified: Date.now(),
    };

    const encoded = encode_dir_node(node);
    // 32 + 1 + 6 + 6 = 45 payload + 8 envelope = 53
    expect(encoded.length).toBeLessThanOrEqual(53);
  });

  it("rejects wrong tag", () => {
    // Encode a FileNode-tagged envelope and try to decode as DirNode
    const node: DirNode = {
      type: "dir",
      smt_root: random_bytes(32),
      group_id: null,
      created: Date.now(),
      modified: Date.now(),
    };

    const encoded = encode_dir_node(node);
    // Tamper tag byte (index 3) — but this will break CRC, so this test
    // verifies the CRC check catches it
    encoded[3] = 0x01; // FileNode tag
    expect(() => decode_dir_node(encoded)).toThrow();
  });
});
