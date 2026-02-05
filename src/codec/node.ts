// Unified Node dispatcher (encode/decode by type with backward-compat JSON fallback)

import type { Node } from "../types.js";
import { has_magic, TAG_FILE_NODE, TAG_DIR_NODE, read_envelope } from "./constants.js";
import { encode_file_node, decode_file_node_payload } from "./file-node.js";
import { encode_dir_node, decode_dir_node_payload } from "./dir-node.js";

/**
 * Encode a Node (FileNode or DirNode) to binary with envelope.
 */
export function encode_node(node: Node): Uint8Array {
  switch (node.type) {
    case "file":
      return encode_file_node(node);
    case "dir":
      return encode_dir_node(node);
    default:
      throw new Error(`unknown node type: ${(node as Node).type}`);
  }
}

/**
 * Decode a Node from binary or legacy JSON format.
 * Auto-detects: if starts with "ZK" magic, decodes binary; otherwise tries JSON.
 */
export function decode_node(buf: Uint8Array): Node {
  if (has_magic(buf)) {
    const { tag, payload } = read_envelope(buf);
    switch (tag) {
      case TAG_FILE_NODE:
        return decode_file_node_payload(payload);
      case TAG_DIR_NODE:
        return decode_dir_node_payload(payload);
      default:
        throw new Error(`unexpected node tag: 0x${tag.toString(16)}`);
    }
  }

  // Legacy JSON fallback
  const json = new TextDecoder().decode(buf);
  return JSON.parse(json, (_, v) =>
    v && typeof v === "object" && "__uint8array" in v ? new Uint8Array(v.__uint8array) : v
  );
}
