// SparseMerkleTree binary codec (packed bit-paths, full envelope)

import type { SMTData, SMTEntry } from "../types.js";
import { encode_varint, decode_varint } from "./varint.js";
import { HASH_SIZE, TAG_SMT, write_envelope, read_envelope } from "./constants.js";

/** Pack boolean[] bits into bytes (MSB first). */
function pack_bits(bits: boolean[]): Uint8Array {
  const byte_count = Math.ceil(bits.length / 8);
  const buf = new Uint8Array(byte_count);
  for (let i = 0; i < bits.length; i++) {
    if (bits[i]) {
      buf[Math.floor(i / 8)] |= 0x80 >> (i % 8);
    }
  }
  return buf;
}

/** Unpack bytes into boolean[] bits (MSB first). */
function unpack_bits(buf: Uint8Array, offset: number, bit_count: number): boolean[] {
  const bits: boolean[] = [];
  for (let i = 0; i < bit_count; i++) {
    const byte_idx = Math.floor(i / 8);
    const bit_idx = 7 - (i % 8);
    bits.push(((buf[offset + byte_idx] >> bit_idx) & 1) === 1);
  }
  return bits;
}

/**
 * Encode SMTData to binary with envelope.
 * Layout: root(32) + entry_count(varint) + [entry...]
 * Entry: path_bit_len(varint) + path_bits(ceil(len/8)) + value(32)
 */
export function encode_smt(smt: SMTData): Uint8Array {
  const entry_count_bytes = encode_varint(smt.entries.length);

  const entry_bufs: Uint8Array[] = [];
  let entries_total = 0;
  for (const entry of smt.entries) {
    const bit_len_bytes = encode_varint(entry.path_bits.length);
    const packed = pack_bits(entry.path_bits);
    const entry_len = bit_len_bytes.length + packed.length + HASH_SIZE;
    const ebuf = new Uint8Array(entry_len);

    let off = 0;
    ebuf.set(bit_len_bytes, off);
    off += bit_len_bytes.length;
    ebuf.set(packed, off);
    off += packed.length;
    ebuf.set(entry.value, off);

    entry_bufs.push(ebuf);
    entries_total += entry_len;
  }

  const payload_len = HASH_SIZE + entry_count_bytes.length + entries_total;
  const payload = new Uint8Array(payload_len);

  let offset = 0;
  payload.set(smt.root, offset);
  offset += HASH_SIZE;

  payload.set(entry_count_bytes, offset);
  offset += entry_count_bytes.length;

  for (const b of entry_bufs) {
    payload.set(b, offset);
    offset += b.length;
  }

  return write_envelope(TAG_SMT, payload);
}

/**
 * Decode SMTData from an envelope-wrapped binary buffer.
 */
export function decode_smt(buf: Uint8Array): SMTData {
  const { tag, payload } = read_envelope(buf);
  if (tag !== TAG_SMT) {
    throw new Error(`expected SMT tag 0x04, got 0x${tag.toString(16)}`);
  }
  return decode_smt_payload(payload);
}

/** Decode SMTData from raw payload (no envelope). */
export function decode_smt_payload(payload: Uint8Array): SMTData {
  let offset = 0;

  const root = payload.slice(offset, offset + HASH_SIZE);
  offset += HASH_SIZE;

  const [entry_count, ec_len] = decode_varint(payload, offset);
  offset += ec_len;

  const entries: SMTEntry[] = [];
  for (let i = 0; i < entry_count; i++) {
    const [bit_len, bl_len] = decode_varint(payload, offset);
    offset += bl_len;

    const packed_bytes = Math.ceil(bit_len / 8);
    const path_bits = unpack_bits(payload, offset, bit_len);
    offset += packed_bytes;

    const value = payload.slice(offset, offset + HASH_SIZE);
    offset += HASH_SIZE;

    entries.push({ path_bits, value });
  }

  return { root, entries };
}
