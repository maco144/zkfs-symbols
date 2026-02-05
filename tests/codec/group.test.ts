import { describe, it, expect } from "vitest";
import { encode_group, decode_group } from "../../src/codec/group.js";
import type { Group } from "../../src/types.js";

function random_bytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  for (let i = 0; i < n; i++) buf[i] = Math.floor(Math.random() * 256);
  return buf;
}

describe("group", () => {
  it("round-trips a 3-member Group", () => {
    const group: Group = {
      id: random_bytes(32),
      members: [
        { pubkey: random_bytes(32), encrypted_dek: random_bytes(80), role: "admin" },
        { pubkey: random_bytes(32), encrypted_dek: random_bytes(80), role: "write" },
        { pubkey: random_bytes(32), encrypted_dek: random_bytes(80), role: "read" },
      ],
    };

    const encoded = encode_group(group);
    const decoded = decode_group(encoded);

    expect(decoded.id).toEqual(group.id);
    expect(decoded.members.length).toBe(3);
    expect(decoded.members[0].role).toBe("admin");
    expect(decoded.members[1].role).toBe("write");
    expect(decoded.members[2].role).toBe("read");
    expect(decoded.members[0].pubkey).toEqual(group.members[0].pubkey);
    expect(decoded.members[0].encrypted_dek).toEqual(group.members[0].encrypted_dek);
  });

  it("round-trips an empty Group", () => {
    const group: Group = {
      id: random_bytes(32),
      members: [],
    };

    const encoded = encode_group(group);
    const decoded = decode_group(encoded);

    expect(decoded.members.length).toBe(0);
  });

  it("3-member Group is compact (~383 bytes)", () => {
    const group: Group = {
      id: random_bytes(32),
      members: [
        { pubkey: random_bytes(32), encrypted_dek: random_bytes(80), role: "admin" },
        { pubkey: random_bytes(32), encrypted_dek: random_bytes(80), role: "write" },
        { pubkey: random_bytes(32), encrypted_dek: random_bytes(80), role: "read" },
      ],
    };

    const encoded = encode_group(group);
    // 32 + 1 + 3*(32 + 1 + 80 + 1) = 32 + 1 + 342 = 375 payload + 8 envelope = 383
    expect(encoded.length).toBeLessThanOrEqual(390);
  });

  it("handles variable-length encrypted_dek", () => {
    const group: Group = {
      id: random_bytes(32),
      members: [
        { pubkey: random_bytes(32), encrypted_dek: random_bytes(48), role: "read" },
        { pubkey: random_bytes(32), encrypted_dek: random_bytes(128), role: "write" },
      ],
    };

    const encoded = encode_group(group);
    const decoded = decode_group(encoded);

    expect(decoded.members[0].encrypted_dek.length).toBe(48);
    expect(decoded.members[1].encrypted_dek.length).toBe(128);
  });
});
