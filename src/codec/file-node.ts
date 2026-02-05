// FileNode binary codec (full envelope)

import type { FileNode } from "../types.js";
import { encode_varint, decode_varint } from "./varint.js";
import {
  HASH_SIZE,
  TAG_FILE_NODE,
  encode_timestamp,
  decode_timestamp,
  TIMESTAMP_SIZE,
  write_envelope,
  read_envelope,
} from "./constants.js";
import { encode_chunk_ref, decode_chunk_ref } from "./chunk-ref.js";

/**
 * Encode a FileNode to binary with envelope.
 * Layout: content_hash(32) + created(6) + modified(6) + size(varint)
 *       + chunk_count(varint) + [chunk_ref...]
 */
export function encode_file_node(node: FileNode): Uint8Array {
  const size_bytes = encode_varint(node.size);
  const chunk_count_bytes = encode_varint(node.chunks.length);

  const chunk_bufs: Uint8Array[] = [];
  let chunks_total = 0;
  for (const chunk of node.chunks) {
    const b = encode_chunk_ref(chunk);
    chunk_bufs.push(b);
    chunks_total += b.length;
  }

  const payload_len =
    HASH_SIZE + TIMESTAMP_SIZE + TIMESTAMP_SIZE + size_bytes.length + chunk_count_bytes.length + chunks_total;
  const payload = new Uint8Array(payload_len);

  let offset = 0;
  payload.set(node.content_hash, offset);
  offset += HASH_SIZE;

  payload.set(encode_timestamp(node.created), offset);
  offset += TIMESTAMP_SIZE;

  payload.set(encode_timestamp(node.modified), offset);
  offset += TIMESTAMP_SIZE;

  payload.set(size_bytes, offset);
  offset += size_bytes.length;

  payload.set(chunk_count_bytes, offset);
  offset += chunk_count_bytes.length;

  for (const b of chunk_bufs) {
    payload.set(b, offset);
    offset += b.length;
  }

  return write_envelope(TAG_FILE_NODE, payload);
}

/**
 * Decode a FileNode from an envelope-wrapped binary buffer.
 */
export function decode_file_node(buf: Uint8Array): FileNode {
  const { tag, payload } = read_envelope(buf);
  if (tag !== TAG_FILE_NODE) {
    throw new Error(`expected FileNode tag 0x01, got 0x${tag.toString(16)}`);
  }
  return decode_file_node_payload(payload);
}

/** Decode a FileNode from raw payload (no envelope). */
export function decode_file_node_payload(payload: Uint8Array): FileNode {
  let offset = 0;

  const content_hash = payload.slice(offset, offset + HASH_SIZE);
  offset += HASH_SIZE;

  const created = decode_timestamp(payload, offset);
  offset += TIMESTAMP_SIZE;

  const modified = decode_timestamp(payload, offset);
  offset += TIMESTAMP_SIZE;

  const [size, size_len] = decode_varint(payload, offset);
  offset += size_len;

  const [chunk_count, cc_len] = decode_varint(payload, offset);
  offset += cc_len;

  const chunks = [];
  for (let i = 0; i < chunk_count; i++) {
    const [chunk, bytes_read] = decode_chunk_ref(payload, offset);
    chunks.push(chunk);
    offset += bytes_read;
  }

  return { type: "file", content_hash, size, created, modified, chunks };
}
