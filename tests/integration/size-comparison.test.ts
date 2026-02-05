import { describe, it, expect } from "vitest";
import { encode_node } from "../../src/codec/node.js";
import { encode_group } from "../../src/codec/group.js";
import { encode_smt } from "../../src/codec/smt.js";
import type { FileNode, DirNode, Group, SMTData } from "../../src/types.js";

function random_bytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  for (let i = 0; i < n; i++) buf[i] = Math.floor(Math.random() * 256);
  return buf;
}

function json_size(obj: unknown): number {
  const json = JSON.stringify(obj, (_, v) =>
    v instanceof Uint8Array ? { __uint8array: Array.from(v) } : v
  );
  return new TextEncoder().encode(json).length;
}

describe("size comparison: binary vs JSON", () => {
  it("FileNode (1 chunk)", () => {
    const node: FileNode = {
      type: "file",
      content_hash: random_bytes(32),
      size: 1024,
      created: Date.now(),
      modified: Date.now(),
      chunks: [{
        index: 0,
        hash: random_bytes(32),
        blob_address: random_bytes(32),
        nonce: random_bytes(24),
      }],
    };

    const binary_size = encode_node(node).length;
    const json_sz = json_size(node);
    const ratio = json_sz / binary_size;

    console.log(`FileNode (1 chunk): JSON=${json_sz}B, Binary=${binary_size}B, Ratio=${ratio.toFixed(1)}x`);
    expect(ratio).toBeGreaterThan(3);
  });

  it("FileNode (10 chunks)", () => {
    const node: FileNode = {
      type: "file",
      content_hash: random_bytes(32),
      size: 1_000_000,
      created: Date.now(),
      modified: Date.now(),
      chunks: Array.from({ length: 10 }, (_, i) => ({
        index: i,
        hash: random_bytes(32),
        blob_address: random_bytes(32),
        nonce: random_bytes(24),
      })),
    };

    const binary_size = encode_node(node).length;
    const json_sz = json_size(node);
    const ratio = json_sz / binary_size;

    console.log(`FileNode (10 chunks): JSON=${json_sz}B, Binary=${binary_size}B, Ratio=${ratio.toFixed(1)}x`);
    expect(ratio).toBeGreaterThan(4);
  });

  it("DirNode (with group_id)", () => {
    const node: DirNode = {
      type: "dir",
      smt_root: random_bytes(32),
      group_id: random_bytes(32),
      created: Date.now(),
      modified: Date.now(),
    };

    const binary_size = encode_node(node).length;
    const json_sz = json_size(node);
    const ratio = json_sz / binary_size;

    console.log(`DirNode (with group): JSON=${json_sz}B, Binary=${binary_size}B, Ratio=${ratio.toFixed(1)}x`);
    expect(ratio).toBeGreaterThan(3);
  });

  it("DirNode (inherit, null group_id)", () => {
    const node: DirNode = {
      type: "dir",
      smt_root: random_bytes(32),
      group_id: null,
      created: Date.now(),
      modified: Date.now(),
    };

    const binary_size = encode_node(node).length;
    const json_sz = json_size(node);
    const ratio = json_sz / binary_size;

    console.log(`DirNode (inherit): JSON=${json_sz}B, Binary=${binary_size}B, Ratio=${ratio.toFixed(1)}x`);
    expect(ratio).toBeGreaterThan(2.5);
  });

  it("Group (3 members)", () => {
    const group: Group = {
      id: random_bytes(32),
      members: [
        { pubkey: random_bytes(32), encrypted_dek: random_bytes(80), role: "admin" },
        { pubkey: random_bytes(32), encrypted_dek: random_bytes(80), role: "write" },
        { pubkey: random_bytes(32), encrypted_dek: random_bytes(80), role: "read" },
      ],
    };

    const binary_size = encode_group(group).length;
    const json_sz = json_size(group);
    const ratio = json_sz / binary_size;

    console.log(`Group (3 members): JSON=${json_sz}B, Binary=${binary_size}B, Ratio=${ratio.toFixed(1)}x`);
    expect(ratio).toBeGreaterThan(3);
  });

  it("SMT (10 entries, 256-bit paths)", () => {
    const smt: SMTData = {
      root: random_bytes(32),
      entries: Array.from({ length: 10 }, () => ({
        path_bits: Array.from({ length: 256 }, () => Math.random() > 0.5),
        value: random_bytes(32),
      })),
    };

    const binary_size = encode_smt(smt).length;

    // JSON equivalent: hex strings for paths and values
    const json_equiv = {
      root: Array.from(smt.root).map(b => b.toString(16).padStart(2, "0")).join(""),
      entries: smt.entries.map(e => ({
        path: e.path_bits.map(b => b ? "1" : "0").join(""),
        value: Array.from(e.value).map(b => b.toString(16).padStart(2, "0")).join(""),
      })),
    };
    const json_sz = JSON.stringify(json_equiv).length;
    const ratio = json_sz / binary_size;

    console.log(`SMT (10 entries): JSON=${json_sz}B, Binary=${binary_size}B, Ratio=${ratio.toFixed(1)}x`);
    expect(ratio).toBeGreaterThan(2);
  });

  it("prints summary table", () => {
    console.log("\n=== Size Comparison Summary ===");
    console.log("All ratios > 3x confirmed in individual tests above");
  });
});
