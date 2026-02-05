// DirNode binary codec (full envelope)

import type { DirNode } from "../types.js";
import {
  HASH_SIZE,
  TAG_DIR_NODE,
  TIMESTAMP_SIZE,
  encode_timestamp,
  decode_timestamp,
  write_envelope,
  read_envelope,
} from "./constants.js";

/**
 * Encode a DirNode to binary with envelope.
 * Layout: smt_root(32) + has_group(1) + [group_id(32)] + created(6) + modified(6)
 */
export function encode_dir_node(node: DirNode): Uint8Array {
  const has_group = node.group_id !== null;
  const payload_len = HASH_SIZE + 1 + (has_group ? HASH_SIZE : 0) + TIMESTAMP_SIZE + TIMESTAMP_SIZE;
  const payload = new Uint8Array(payload_len);

  let offset = 0;
  payload.set(node.smt_root, offset);
  offset += HASH_SIZE;

  payload[offset] = has_group ? 0x01 : 0x00;
  offset++;

  if (has_group) {
    payload.set(node.group_id!, offset);
    offset += HASH_SIZE;
  }

  payload.set(encode_timestamp(node.created), offset);
  offset += TIMESTAMP_SIZE;

  payload.set(encode_timestamp(node.modified), offset);

  return write_envelope(TAG_DIR_NODE, payload);
}

/**
 * Decode a DirNode from an envelope-wrapped binary buffer.
 */
export function decode_dir_node(buf: Uint8Array): DirNode {
  const { tag, payload } = read_envelope(buf);
  if (tag !== TAG_DIR_NODE) {
    throw new Error(`expected DirNode tag 0x02, got 0x${tag.toString(16)}`);
  }
  return decode_dir_node_payload(payload);
}

/** Decode a DirNode from raw payload (no envelope). */
export function decode_dir_node_payload(payload: Uint8Array): DirNode {
  let offset = 0;

  const smt_root = payload.slice(offset, offset + HASH_SIZE);
  offset += HASH_SIZE;

  const has_group = payload[offset] === 0x01;
  offset++;

  let group_id: Uint8Array | null = null;
  if (has_group) {
    group_id = payload.slice(offset, offset + HASH_SIZE);
    offset += HASH_SIZE;
  }

  const created = decode_timestamp(payload, offset);
  offset += TIMESTAMP_SIZE;

  const modified = decode_timestamp(payload, offset);

  return { type: "dir", smt_root, group_id, created, modified };
}
