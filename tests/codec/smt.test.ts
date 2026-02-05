import { describe, it, expect } from "vitest";
import { encode_smt, decode_smt } from "../../src/codec/smt.js";
import type { SMTData } from "../../src/types.js";

function random_bytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  for (let i = 0; i < n; i++) buf[i] = Math.floor(Math.random() * 256);
  return buf;
}

function random_bits(n: number): boolean[] {
  return Array.from({ length: n }, () => Math.random() > 0.5);
}

describe("smt", () => {
  it("round-trips a simple SMT", () => {
    const smt: SMTData = {
      root: random_bytes(32),
      entries: [
        { path_bits: [true, false, true], value: random_bytes(32) },
        { path_bits: [false, true], value: random_bytes(32) },
      ],
    };

    const encoded = encode_smt(smt);
    const decoded = decode_smt(encoded);

    expect(decoded.root).toEqual(smt.root);
    expect(decoded.entries.length).toBe(2);
    expect(decoded.entries[0].path_bits).toEqual([true, false, true]);
    expect(decoded.entries[0].value).toEqual(smt.entries[0].value);
    expect(decoded.entries[1].path_bits).toEqual([false, true]);
  });

  it("round-trips an empty SMT", () => {
    const smt: SMTData = {
      root: random_bytes(32),
      entries: [],
    };

    const encoded = encode_smt(smt);
    const decoded = decode_smt(encoded);

    expect(decoded.entries.length).toBe(0);
  });

  it("round-trips 256-bit paths", () => {
    const long_path = random_bits(256);
    const smt: SMTData = {
      root: random_bytes(32),
      entries: [
        { path_bits: long_path, value: random_bytes(32) },
      ],
    };

    const encoded = encode_smt(smt);
    const decoded = decode_smt(encoded);

    expect(decoded.entries[0].path_bits).toEqual(long_path);
  });

  it("round-trips 10-entry SMT", () => {
    const entries = Array.from({ length: 10 }, () => ({
      path_bits: random_bits(256),
      value: random_bytes(32),
    }));

    const smt: SMTData = { root: random_bytes(32), entries };

    const encoded = encode_smt(smt);
    const decoded = decode_smt(encoded);

    expect(decoded.entries.length).toBe(10);
    for (let i = 0; i < 10; i++) {
      expect(decoded.entries[i].path_bits).toEqual(entries[i].path_bits);
      expect(decoded.entries[i].value).toEqual(entries[i].value);
    }
  });

  it("handles single-bit paths", () => {
    const smt: SMTData = {
      root: random_bytes(32),
      entries: [
        { path_bits: [true], value: random_bytes(32) },
        { path_bits: [false], value: random_bytes(32) },
      ],
    };

    const encoded = encode_smt(smt);
    const decoded = decode_smt(encoded);

    expect(decoded.entries[0].path_bits).toEqual([true]);
    expect(decoded.entries[1].path_bits).toEqual([false]);
  });
});
