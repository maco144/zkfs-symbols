// Magic bytes, version, type tags, timestamp helpers, envelope read/write

import { crc32_bytes, verify_crc32 } from "./crc32.js";

// Magic bytes: "ZK" = 0x5A 0x4B
export const MAGIC = new Uint8Array([0x5a, 0x4b]);
export const VERSION = 0x01;

// Type tags
export const TAG_FILE_NODE = 0x01;
export const TAG_DIR_NODE = 0x02;
export const TAG_GROUP = 0x03;
export const TAG_SMT = 0x04;
export const TAG_COMPRESSED_BLOB = 0x10;

// Sizes
export const HASH_SIZE = 32;
export const NONCE_SIZE = 24;
export const TIMESTAMP_SIZE = 6;

// Role encoding
export const ROLE_READ = 0x00;
export const ROLE_WRITE = 0x01;
export const ROLE_ADMIN = 0x02;

import type { Role } from "../types.js";

export function encode_role(role: Role): number {
  switch (role) {
    case "read": return ROLE_READ;
    case "write": return ROLE_WRITE;
    case "admin": return ROLE_ADMIN;
  }
}

export function decode_role(byte: number): Role {
  switch (byte) {
    case ROLE_READ: return "read";
    case ROLE_WRITE: return "write";
    case ROLE_ADMIN: return "admin";
    default: throw new Error(`unknown role byte: 0x${byte.toString(16)}`);
  }
}

/** Encode timestamp (ms since epoch) as 6 bytes big-endian. */
export function encode_timestamp(ts: number): Uint8Array {
  const buf = new Uint8Array(TIMESTAMP_SIZE);
  // Write 6 bytes big-endian (max ~281 trillion = ~8900 years)
  let val = ts;
  for (let i = 5; i >= 0; i--) {
    buf[i] = val & 0xff;
    val = Math.floor(val / 256);
  }
  return buf;
}

/** Decode 6-byte big-endian timestamp from buf at offset. */
export function decode_timestamp(buf: Uint8Array, offset: number): number {
  let val = 0;
  for (let i = 0; i < TIMESTAMP_SIZE; i++) {
    val = val * 256 + buf[offset + i];
  }
  return val;
}

// Envelope header size: magic(2) + version(1) + tag(1) = 4 bytes
// Envelope footer: CRC32(4) = 4 bytes
export const ENVELOPE_HEADER_SIZE = 4;
export const ENVELOPE_FOOTER_SIZE = 4;

/**
 * Wrap a payload with envelope: [magic][version][tag][payload][CRC32]
 */
export function write_envelope(tag: number, payload: Uint8Array): Uint8Array {
  const total = ENVELOPE_HEADER_SIZE + payload.length + ENVELOPE_FOOTER_SIZE;
  const buf = new Uint8Array(total);

  // Header
  buf[0] = MAGIC[0];
  buf[1] = MAGIC[1];
  buf[2] = VERSION;
  buf[3] = tag;

  // Payload
  buf.set(payload, ENVELOPE_HEADER_SIZE);

  // CRC32 over header + payload
  const crc_input = buf.subarray(0, ENVELOPE_HEADER_SIZE + payload.length);
  const crc = crc32_bytes(crc_input);
  buf.set(crc, ENVELOPE_HEADER_SIZE + payload.length);

  return buf;
}

/**
 * Read and verify envelope. Returns { tag, payload }.
 * Throws on invalid magic, version, or CRC mismatch.
 */
export function read_envelope(buf: Uint8Array): { tag: number; payload: Uint8Array } {
  if (buf.length < ENVELOPE_HEADER_SIZE + ENVELOPE_FOOTER_SIZE) {
    throw new Error("envelope too short");
  }

  if (buf[0] !== MAGIC[0] || buf[1] !== MAGIC[1]) {
    throw new Error("invalid magic bytes");
  }

  if (buf[2] !== VERSION) {
    throw new Error(`unsupported version: ${buf[2]}`);
  }

  if (!verify_crc32(buf)) {
    throw new Error("CRC32 checksum mismatch");
  }

  const tag = buf[3];
  const payload = buf.subarray(ENVELOPE_HEADER_SIZE, buf.length - ENVELOPE_FOOTER_SIZE);

  return { tag, payload };
}

/** Check if bytes start with "ZK" magic. */
export function has_magic(buf: Uint8Array): boolean {
  return buf.length >= 2 && buf[0] === MAGIC[0] && buf[1] === MAGIC[1];
}
