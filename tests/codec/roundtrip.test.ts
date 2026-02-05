import { describe, it, expect } from "vitest";
import { encode_node, decode_node } from "../../src/codec/node.js";
import { encode_group, decode_group } from "../../src/codec/group.js";
import { encode_smt, decode_smt } from "../../src/codec/smt.js";
import type { FileNode, DirNode, Group, SMTData } from "../../src/types.js";

function random_bytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  for (let i = 0; i < n; i++) buf[i] = Math.floor(Math.random() * 256);
  return buf;
}

function random_bits(n: number): boolean[] {
  return Array.from({ length: n }, () => Math.random() > 0.5);
}

describe("roundtrip property tests", () => {
  // Run many iterations with random data
  const ITERATIONS = 50;

  it("FileNode round-trips with random data", () => {
    for (let iter = 0; iter < ITERATIONS; iter++) {
      const chunk_count = Math.floor(Math.random() * 20);
      const node: FileNode = {
        type: "file",
        content_hash: random_bytes(32),
        size: Math.floor(Math.random() * 10_000_000),
        created: Math.floor(Math.random() * 2 ** 48),
        modified: Math.floor(Math.random() * 2 ** 48),
        chunks: Array.from({ length: chunk_count }, (_, i) => ({
          index: i,
          hash: random_bytes(32),
          blob_address: random_bytes(32),
          nonce: random_bytes(24),
        })),
      };

      const encoded = encode_node(node);
      const decoded = decode_node(encoded);

      expect(decoded.type).toBe("file");
      if (decoded.type === "file") {
        expect(decoded.content_hash).toEqual(node.content_hash);
        expect(decoded.size).toBe(node.size);
        expect(decoded.created).toBe(node.created);
        expect(decoded.modified).toBe(node.modified);
        expect(decoded.chunks.length).toBe(chunk_count);
      }
    }
  });

  it("DirNode round-trips with random data", () => {
    for (let iter = 0; iter < ITERATIONS; iter++) {
      const node: DirNode = {
        type: "dir",
        smt_root: random_bytes(32),
        group_id: Math.random() > 0.5 ? random_bytes(32) : null,
        created: Math.floor(Math.random() * 2 ** 48),
        modified: Math.floor(Math.random() * 2 ** 48),
      };

      const encoded = encode_node(node);
      const decoded = decode_node(encoded);

      expect(decoded.type).toBe("dir");
      if (decoded.type === "dir") {
        expect(decoded.smt_root).toEqual(node.smt_root);
        if (node.group_id) {
          expect(decoded.group_id).toEqual(node.group_id);
        } else {
          expect(decoded.group_id).toBeNull();
        }
        expect(decoded.created).toBe(node.created);
        expect(decoded.modified).toBe(node.modified);
      }
    }
  });

  it("Group round-trips with random data", () => {
    for (let iter = 0; iter < ITERATIONS; iter++) {
      const member_count = Math.floor(Math.random() * 10);
      const roles = ["read", "write", "admin"] as const;
      const group: Group = {
        id: random_bytes(32),
        members: Array.from({ length: member_count }, () => ({
          pubkey: random_bytes(32),
          encrypted_dek: random_bytes(48 + Math.floor(Math.random() * 80)),
          role: roles[Math.floor(Math.random() * 3)],
        })),
      };

      const encoded = encode_group(group);
      const decoded = decode_group(encoded);

      expect(decoded.id).toEqual(group.id);
      expect(decoded.members.length).toBe(member_count);
      for (let i = 0; i < member_count; i++) {
        expect(decoded.members[i].pubkey).toEqual(group.members[i].pubkey);
        expect(decoded.members[i].encrypted_dek).toEqual(group.members[i].encrypted_dek);
        expect(decoded.members[i].role).toBe(group.members[i].role);
      }
    }
  });

  it("SMT round-trips with random data", () => {
    for (let iter = 0; iter < ITERATIONS; iter++) {
      const entry_count = Math.floor(Math.random() * 30);
      const smt: SMTData = {
        root: random_bytes(32),
        entries: Array.from({ length: entry_count }, () => ({
          path_bits: random_bits(1 + Math.floor(Math.random() * 256)),
          value: random_bytes(32),
        })),
      };

      const encoded = encode_smt(smt);
      const decoded = decode_smt(encoded);

      expect(decoded.root).toEqual(smt.root);
      expect(decoded.entries.length).toBe(entry_count);
      for (let i = 0; i < entry_count; i++) {
        expect(decoded.entries[i].path_bits).toEqual(smt.entries[i].path_bits);
        expect(decoded.entries[i].value).toEqual(smt.entries[i].value);
      }
    }
  });
});
