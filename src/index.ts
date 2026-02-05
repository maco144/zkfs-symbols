// Public API exports

// Metadata codecs
export { encode_node, decode_node } from "./codec/node.js";
export { encode_file_node, decode_file_node } from "./codec/file-node.js";
export { encode_dir_node, decode_dir_node } from "./codec/dir-node.js";
export { encode_group, decode_group } from "./codec/group.js";
export { encode_smt, decode_smt } from "./codec/smt.js";

// Utilities
export { has_magic } from "./codec/constants.js";

// Compression
export { compress_blob, decompress_blob } from "./compress/pipeline.js";
export type { PipelineOptions, CompressorFn, DecompressorFn } from "./compress/pipeline.js";
export { Dictionary } from "./compress/dictionary.js";
export { ContentType } from "./compress/content-detector.js";

// Types
export type {
  Hash,
  FileNode,
  DirNode,
  ChunkRef,
  Group,
  GroupMember,
  Role,
  Node,
  SMTData,
  SMTEntry,
} from "./types.js";
