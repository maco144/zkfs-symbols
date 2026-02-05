// Structural type interfaces mirroring zkfs/src/types.ts

export type Hash = Uint8Array; // 32 bytes

export interface FileNode {
  type: "file";
  content_hash: Hash;
  size: number;
  created: number;
  modified: number;
  chunks: ChunkRef[];
}

export interface DirNode {
  type: "dir";
  smt_root: Hash;
  group_id: Hash | null; // null = inherit from parent
  created: number;
  modified: number;
}

export type Node = FileNode | DirNode;

export interface ChunkRef {
  index: number;
  hash: Hash;
  blob_address: Hash;
  nonce: Uint8Array; // 24 bytes
}

export interface Group {
  id: Hash;
  members: GroupMember[];
}

export interface GroupMember {
  pubkey: Uint8Array; // 32 bytes
  encrypted_dek: Uint8Array;
  role: Role;
}

export type Role = "read" | "write" | "admin";

/** SMT node entry for serialization — path stored as bit string */
export interface SMTEntry {
  path_bits: boolean[];
  value: Hash;
}

export interface SMTData {
  root: Hash;
  entries: SMTEntry[];
}
