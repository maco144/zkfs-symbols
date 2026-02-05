// Group/GroupMember binary codec (full envelope)

import type { Group, GroupMember } from "../types.js";
import { encode_varint, decode_varint } from "./varint.js";
import {
  HASH_SIZE,
  TAG_GROUP,
  encode_role,
  decode_role,
  write_envelope,
  read_envelope,
} from "./constants.js";

/**
 * Encode a Group to binary with envelope.
 * Layout: id(32) + member_count(varint) + [member...]
 * Member: pubkey(32) + dek_len(varint) + dek(N) + role(1)
 */
export function encode_group(group: Group): Uint8Array {
  const member_count_bytes = encode_varint(group.members.length);

  const member_bufs: Uint8Array[] = [];
  let members_total = 0;
  for (const m of group.members) {
    const dek_len_bytes = encode_varint(m.encrypted_dek.length);
    const member_len = HASH_SIZE + dek_len_bytes.length + m.encrypted_dek.length + 1;
    const mbuf = new Uint8Array(member_len);

    let off = 0;
    mbuf.set(m.pubkey, off);
    off += HASH_SIZE;

    mbuf.set(dek_len_bytes, off);
    off += dek_len_bytes.length;

    mbuf.set(m.encrypted_dek, off);
    off += m.encrypted_dek.length;

    mbuf[off] = encode_role(m.role);

    member_bufs.push(mbuf);
    members_total += member_len;
  }

  const payload_len = HASH_SIZE + member_count_bytes.length + members_total;
  const payload = new Uint8Array(payload_len);

  let offset = 0;
  payload.set(group.id, offset);
  offset += HASH_SIZE;

  payload.set(member_count_bytes, offset);
  offset += member_count_bytes.length;

  for (const b of member_bufs) {
    payload.set(b, offset);
    offset += b.length;
  }

  return write_envelope(TAG_GROUP, payload);
}

/**
 * Decode a Group from an envelope-wrapped binary buffer.
 */
export function decode_group(buf: Uint8Array): Group {
  const { tag, payload } = read_envelope(buf);
  if (tag !== TAG_GROUP) {
    throw new Error(`expected Group tag 0x03, got 0x${tag.toString(16)}`);
  }
  return decode_group_payload(payload);
}

/** Decode a Group from raw payload (no envelope). */
export function decode_group_payload(payload: Uint8Array): Group {
  let offset = 0;

  const id = payload.slice(offset, offset + HASH_SIZE);
  offset += HASH_SIZE;

  const [member_count, mc_len] = decode_varint(payload, offset);
  offset += mc_len;

  const members: GroupMember[] = [];
  for (let i = 0; i < member_count; i++) {
    const pubkey = payload.slice(offset, offset + HASH_SIZE);
    offset += HASH_SIZE;

    const [dek_len, dl_len] = decode_varint(payload, offset);
    offset += dl_len;

    const encrypted_dek = payload.slice(offset, offset + dek_len);
    offset += dek_len;

    const role = decode_role(payload[offset]);
    offset++;

    members.push({ pubkey, encrypted_dek, role });
  }

  return { id, members };
}
