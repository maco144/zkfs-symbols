# zkfs-symbols

Binary codec and blob compression for ZKFS. Drop-in replacement for JSON serialization with 3-6x smaller output.

## What it does

- **Binary metadata codec** — compact symbol-based encoding for FileNode, DirNode, Group, and SparseMerkleTree structures
- **Blob compression** — compress-before-encrypt pipeline with a trainable dictionary ("secret language")
- **Zero runtime dependencies**
- **Backward compatible** — auto-detects binary vs legacy JSON format

## Install

```bash
npm install
```

## Usage

### Metadata encoding

```typescript
import { encode_node, decode_node, encode_group, decode_group, encode_smt, decode_smt } from "zkfs-symbols";

// Encode a FileNode to compact binary
const binary = encode_node(fileNode);  // ~144 bytes vs ~650 JSON

// Decode — auto-detects binary (ZK magic) or legacy JSON
const node = decode_node(binary);

// Groups and SMTs work the same way
const groupBinary = encode_group(group);
const smtBinary = encode_smt(smtData);
```

### Blob compression

```typescript
import { compress_blob, decompress_blob, Dictionary } from "zkfs-symbols";

// Train a dictionary from sample data (the "secret language")
const dictionary = Dictionary.train(samples);

// Compress before encryption
const compressed = compress_blob(plaintext, { dictionary });

// Decompress after decryption
const original = decompress_blob(compressed, { dictionary });
```

### With external deflate (optional)

```typescript
import { compress_blob, decompress_blob } from "zkfs-symbols";
import { deflateSync, inflateSync } from "node:zlib";

const compressed = compress_blob(data, {
  dictionary,
  fallback_compress: (d) => deflateSync(d),
  fallback_decompress: (d, _size) => inflateSync(d),
});
```

## Wire format

Every top-level encoded message is wrapped in an envelope:

```
[0x5A 0x4B] [0x01] [type_tag] [...payload...] [CRC32 4 bytes BE]
  magic      ver     tag
```

Magic bytes `0x5A4B` = "ZK". CRC32 covers header + payload.

### Type tags

| Tag  | Type           |
|------|----------------|
| 0x01 | FileNode       |
| 0x02 | DirNode        |
| 0x03 | Group          |
| 0x04 | SMT            |
| 0x10 | CompressedBlob |

### Primitives

- **Hash**: 32 raw bytes
- **Nonce**: 24 raw bytes
- **Varint**: unsigned LEB128
- **Timestamp**: 6 bytes big-endian (ms since epoch)
- **Role**: 1 byte (0x00=read, 0x01=write, 0x02=admin)

### FileNode (tag 0x01)

```
content_hash   32B | created 6B | modified 6B | size varint
chunk_count    varint
per chunk:     index varint | hash 32B | blob_address 32B | nonce 24B
```

### DirNode (tag 0x02)

```
smt_root       32B | has_group 1B | [group_id 32B] | created 6B | modified 6B
```

### Group (tag 0x03)

```
id             32B | member_count varint
per member:    pubkey 32B | dek_len varint | encrypted_dek NB | role 1B
```

### SMT (tag 0x04)

```
root           32B | entry_count varint
per entry:     path_bit_len varint | path_bits ceil(len/8)B | value 32B
```

### CompressedBlob (tag 0x10)

```
method 1B | content_type 1B | original_size varint | compressed_len varint | data
```

## Size comparison

| Structure              | JSON     | Binary  | Reduction |
|------------------------|----------|---------|-----------|
| FileNode (1 chunk)     | 650 B    | 144 B   | 4.5x      |
| FileNode (10 chunks)   | 4,386 B  | 946 B   | 4.6x      |
| DirNode (with group)   | 355 B    | 85 B    | 4.2x      |
| DirNode (inherit)      | 220 B    | 53 B    | 4.2x      |
| Group (3 members)      | 1,607 B  | 383 B   | 4.2x      |
| SMT (10 entries)       | 3,517 B  | 701 B   | 5.0x      |

## Compression: the "secret language"

The dictionary is a trained codebook shared as a group secret:

1. **String substitution** — up to 255 common substrings replaced with 2-byte escape codes
2. **Huffman encoding** — canonical Huffman tree built on post-substitution byte frequencies

Training:
1. Collect samples from group files
2. Count n-gram frequencies (4/8/16/32-byte), keep top 255 by `freq * length`
3. Apply substitutions to corpus, count byte frequencies, build Huffman tree

The dictionary serializes to ~500-2000 bytes, stored encrypted alongside the group DEK.

## Backward compatibility

`decode_node`, `decode_group`, and `decode_smt` auto-detect format:
- Bytes starting with `0x5A 0x4B` ("ZK") → binary decode
- Otherwise → legacy JSON parse

This enables gradual migration. Old data remains readable; new writes use binary.

## ZKFS integration

After building this package, ZKFS integrates by:

1. Add dependency: `"zkfs-symbols": "file:../zkfs-symbols"`
2. Replace `serialize_node`/`deserialize_node` with `encode_node`/`decode_node`
3. Replace SMT serialization with `encode_smt`/`decode_smt`
4. Add `compress_blob()` before `encrypt()` in the write pipeline
5. Add `decompress_blob()` after `decrypt()` in the read pipeline
6. Store dictionary encrypted alongside group DEK

## Development

```bash
npm test        # Run all tests (vitest)
npm run build   # Compile TypeScript
```

## License

MIT
