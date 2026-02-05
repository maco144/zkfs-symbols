// Trainable codebook: string substitution table + Huffman tree

import { encode_varint, decode_varint } from "../codec/varint.js";
import { SymbolTree } from "./symbol-tree.js";

const ESCAPE_BYTE = 0x00;
const MAX_STRINGS = 255;

export class Dictionary {
  /** Substitution strings (up to 255, each 2-32 bytes) */
  readonly strings: Uint8Array[];
  /** Trained Huffman tree for post-substitution encoding */
  readonly tree: SymbolTree;

  constructor(strings: Uint8Array[], tree: SymbolTree) {
    if (strings.length > MAX_STRINGS) {
      throw new Error(`too many strings: ${strings.length} (max ${MAX_STRINGS})`);
    }
    this.strings = strings;
    this.tree = tree;
  }

  /**
   * Train a dictionary from sample data.
   * 1. Count n-gram frequencies, keep top 255 by freq*length
   * 2. Apply substitution to samples
   * 3. Count byte frequencies → build Huffman tree
   */
  static train(samples: Uint8Array[]): Dictionary {
    if (samples.length === 0) {
      return new Dictionary([], SymbolTree.from_frequencies(new Uint32Array(256)));
    }

    // Step 1: Count n-gram frequencies
    const ngram_counts = new Map<string, { bytes: Uint8Array; count: number }>();

    for (const sample of samples) {
      for (const gram_size of [4, 8, 16, 32]) {
        if (sample.length < gram_size) continue;
        for (let i = 0; i <= sample.length - gram_size; i++) {
          const slice = sample.slice(i, i + gram_size);
          const key = Array.from(slice).join(",");
          const existing = ngram_counts.get(key);
          if (existing) {
            existing.count++;
          } else {
            ngram_counts.set(key, { bytes: slice, count: 1 });
          }
        }
      }
    }

    // Sort by freq * length (savings score), keep top 255
    const candidates = Array.from(ngram_counts.values())
      .filter(c => c.count >= 2) // must appear at least twice
      .sort((a, b) => (b.count * b.bytes.length) - (a.count * a.bytes.length))
      .slice(0, MAX_STRINGS);

    const strings = candidates.map(c => c.bytes);

    // Step 2: Apply substitution to training corpus
    const substituted_parts: Uint8Array[] = [];
    for (const sample of samples) {
      substituted_parts.push(Dictionary.apply_substitution(sample, strings));
    }

    // Step 3: Count byte frequencies on substituted data → build Huffman tree
    const frequencies = new Uint32Array(256);
    for (const part of substituted_parts) {
      for (let i = 0; i < part.length; i++) {
        frequencies[part[i]]++;
      }
    }

    const tree = SymbolTree.from_frequencies(frequencies);
    return new Dictionary(strings, tree);
  }

  /** Apply string substitution: replace occurrences with [0x00, index+1], escape literal 0x00 as [0x00, 0x00]. */
  private static apply_substitution(data: Uint8Array, strings: Uint8Array[]): Uint8Array {
    // Work on a copy as array for easier manipulation
    const result: number[] = [];
    let i = 0;

    outer: while (i < data.length) {
      // Try to match longest string first (reverse order by length is more efficient)
      for (let s = 0; s < strings.length; s++) {
        const str = strings[s];
        if (i + str.length <= data.length) {
          let match = true;
          for (let j = 0; j < str.length; j++) {
            if (data[i + j] !== str[j]) { match = false; break; }
          }
          if (match) {
            result.push(ESCAPE_BYTE, s + 1); // index+1 (0 reserved for escape)
            i += str.length;
            continue outer;
          }
        }
      }

      // Escape literal 0x00
      if (data[i] === ESCAPE_BYTE) {
        result.push(ESCAPE_BYTE, 0x00);
      } else {
        result.push(data[i]);
      }
      i++;
    }

    return new Uint8Array(result);
  }

  /** Compress data using this dictionary (substitution + Huffman). */
  compress(data: Uint8Array): Uint8Array {
    const substituted = Dictionary.apply_substitution(data, this.strings);
    const { bits, bit_count } = this.tree.encode(substituted);

    // Pack: substituted_len(varint) + bit_count(varint) + bits
    const sub_len_bytes = encode_varint(substituted.length);
    const bit_count_bytes = encode_varint(bit_count);
    const result = new Uint8Array(sub_len_bytes.length + bit_count_bytes.length + bits.length);
    let off = 0;
    result.set(sub_len_bytes, off); off += sub_len_bytes.length;
    result.set(bit_count_bytes, off); off += bit_count_bytes.length;
    result.set(bits, off);
    return result;
  }

  /** Decompress data using this dictionary (Huffman decode + reverse substitution). */
  decompress(compressed: Uint8Array, _original_size: number): Uint8Array {
    let offset = 0;
    const [sub_len, sl_len] = decode_varint(compressed, offset);
    offset += sl_len;

    const [bit_count, bc_len] = decode_varint(compressed, offset);
    offset += bc_len;

    const bits = compressed.subarray(offset);
    const substituted = this.tree.decode(bits, bit_count, sub_len);

    return Dictionary.reverse_substitution(substituted, this.strings);
  }

  /** Reverse string substitution. */
  private static reverse_substitution(data: Uint8Array, strings: Uint8Array[]): Uint8Array {
    const result: number[] = [];
    let i = 0;

    while (i < data.length) {
      if (data[i] === ESCAPE_BYTE && i + 1 < data.length) {
        const idx = data[i + 1];
        if (idx === 0x00) {
          // Escaped literal 0x00
          result.push(0x00);
        } else {
          // String substitution reference
          const str = strings[idx - 1];
          for (let j = 0; j < str.length; j++) {
            result.push(str[j]);
          }
        }
        i += 2;
      } else {
        result.push(data[i]);
        i++;
      }
    }

    return new Uint8Array(result);
  }

  /**
   * Serialize dictionary.
   * Format: version(1) + huffman_lengths(256) + string_count(varint) + [len(varint) + bytes...]
   */
  serialize(): Uint8Array {
    const tree_data = this.tree.serialize(); // 256 bytes
    const count_bytes = encode_varint(this.strings.length);

    const string_parts: Uint8Array[] = [];
    let strings_total = 0;
    for (const s of this.strings) {
      const len_bytes = encode_varint(s.length);
      const part = new Uint8Array(len_bytes.length + s.length);
      part.set(len_bytes, 0);
      part.set(s, len_bytes.length);
      string_parts.push(part);
      strings_total += part.length;
    }

    const result = new Uint8Array(1 + 256 + count_bytes.length + strings_total);
    let off = 0;
    result[off++] = 0x01; // version
    result.set(tree_data, off); off += 256;
    result.set(count_bytes, off); off += count_bytes.length;
    for (const p of string_parts) {
      result.set(p, off); off += p.length;
    }

    return result;
  }

  /** Deserialize dictionary from bytes. */
  static deserialize(data: Uint8Array): Dictionary {
    let offset = 0;

    const version = data[offset++];
    if (version !== 0x01) throw new Error(`unsupported dictionary version: ${version}`);

    const tree = SymbolTree.deserialize(data.subarray(offset, offset + 256));
    offset += 256;

    const [string_count, sc_len] = decode_varint(data, offset);
    offset += sc_len;

    const strings: Uint8Array[] = [];
    for (let i = 0; i < string_count; i++) {
      const [len, l_len] = decode_varint(data, offset);
      offset += l_len;
      strings.push(data.slice(offset, offset + len));
      offset += len;
    }

    return new Dictionary(strings, tree);
  }
}
