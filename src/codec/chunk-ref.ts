// ChunkRef binary codec (nested record, no envelope)

import type { ChunkRef } from "../types.js";
import { encode_varint, decode_varint } from "./varint.js";
import { HASH_SIZE, NONCE_SIZE } from "./constants.js";

/**
 * Encode a ChunkRef to binary (no envelope wrapper).
 * Layout: index(varint) + hash(32) + blob_address(32) + nonce(24)
 */
export function encode_chunk_ref(ref: ChunkRef): Uint8Array {
  const index_bytes = encode_varint(ref.index);
  const total = index_bytes.length + HASH_SIZE + HASH_SIZE + NONCE_SIZE;
  const buf = new Uint8Array(total);

  let offset = 0;
  buf.set(index_bytes, offset);
  offset += index_bytes.length;

  buf.set(ref.hash, offset);
  offset += HASH_SIZE;

  buf.set(ref.blob_address, offset);
  offset += HASH_SIZE;

  buf.set(ref.nonce, offset);

  return buf;
}

/**
 * Decode a ChunkRef from binary at offset. Returns [ChunkRef, bytesRead].
 */
export function decode_chunk_ref(buf: Uint8Array, offset: number): [ChunkRef, number] {
  const start = offset;

  const [index, index_len] = decode_varint(buf, offset);
  offset += index_len;

  const hash = buf.slice(offset, offset + HASH_SIZE);
  offset += HASH_SIZE;

  const blob_address = buf.slice(offset, offset + HASH_SIZE);
  offset += HASH_SIZE;

  const nonce = buf.slice(offset, offset + NONCE_SIZE);
  offset += NONCE_SIZE;

  return [{ index, hash, blob_address, nonce }, offset - start];
}
