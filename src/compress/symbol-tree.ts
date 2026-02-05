// Canonical Huffman tree: build, encode, decode, serialize

/**
 * A canonical Huffman tree represented by code lengths per symbol.
 * Max 15 bits per code. Symbol range: 0-255 (byte values).
 */
export class SymbolTree {
  /** Code length for each of 256 symbols (0 = symbol not present) */
  readonly lengths: Uint8Array;

  /** Lookup: symbol → { code, length } */
  private encode_table: Array<{ code: number; length: number }> | null = null;

  /** Decode lookup: built lazily */
  private decode_table: Map<number, { symbol: number; length: number }> | null = null;

  constructor(lengths: Uint8Array) {
    if (lengths.length !== 256) throw new Error("lengths must have 256 entries");
    this.lengths = lengths;
  }

  /**
   * Build a SymbolTree from byte frequency counts.
   * Uses the standard Huffman algorithm, then converts to canonical form.
   */
  static from_frequencies(frequencies: Uint32Array): SymbolTree {
    if (frequencies.length !== 256) throw new Error("frequencies must have 256 entries");

    // Count active symbols
    const active: Array<{ symbol: number; freq: number }> = [];
    for (let i = 0; i < 256; i++) {
      if (frequencies[i] > 0) {
        active.push({ symbol: i, freq: frequencies[i] });
      }
    }

    const lengths = new Uint8Array(256);

    if (active.length === 0) return new SymbolTree(lengths);

    if (active.length === 1) {
      lengths[active[0].symbol] = 1;
      return new SymbolTree(lengths);
    }

    // Build Huffman tree using a priority queue (simple sorted array)
    interface HNode { freq: number; symbols: number[]; depth: number }
    let nodes: HNode[] = active.map(a => ({ freq: a.freq, symbols: [a.symbol], depth: 0 }));
    nodes.sort((a, b) => a.freq - b.freq);

    while (nodes.length > 1) {
      const left = nodes.shift()!;
      const right = nodes.shift()!;
      const merged: HNode = {
        freq: left.freq + right.freq,
        symbols: [...left.symbols, ...right.symbols],
        depth: Math.max(left.depth, right.depth) + 1,
      };
      // Insert in sorted position
      let idx = 0;
      while (idx < nodes.length && nodes[idx].freq <= merged.freq) idx++;
      nodes.splice(idx, 0, merged);
    }

    // BFS to assign depths
    interface TreeNode { left?: TreeNode; right?: TreeNode; symbol?: number }
    function build_tree(items: HNode[]): void {
      // Re-build from scratch using proper tree construction
      interface QNode { freq: number; tree: TreeNode }
      let q: QNode[] = active.map(a => ({ freq: a.freq, tree: { symbol: a.symbol } }));
      q.sort((a, b) => a.freq - b.freq);

      while (q.length > 1) {
        const l = q.shift()!;
        const r = q.shift()!;
        const parent: QNode = { freq: l.freq + r.freq, tree: { left: l.tree, right: r.tree } };
        let i = 0;
        while (i < q.length && q[i].freq <= parent.freq) i++;
        q.splice(i, 0, parent);
      }

      // Walk tree to get depths
      function walk(node: TreeNode, depth: number): void {
        if (node.symbol !== undefined) {
          lengths[node.symbol] = Math.min(depth, 15) as number;
          return;
        }
        if (node.left) walk(node.left, depth + 1);
        if (node.right) walk(node.right, depth + 1);
      }

      if (q.length > 0) walk(q[0].tree, 0);
    }

    build_tree(nodes);

    // Clamp to 15 bits max (kraft inequality adjustment)
    SymbolTree.clamp_lengths(lengths, 15);

    return new SymbolTree(lengths);
  }

  /** Ensure no code length exceeds max_len, redistributing as needed. */
  private static clamp_lengths(lengths: Uint8Array, max_len: number): void {
    let overflow = true;
    while (overflow) {
      overflow = false;
      for (let i = 0; i < 256; i++) {
        if (lengths[i] > max_len) {
          lengths[i] = max_len;
          overflow = true;
        }
      }
      if (!overflow) break;

      // Verify Kraft inequality: sum of 2^(-length) <= 1
      let kraft = 0;
      for (let i = 0; i < 256; i++) {
        if (lengths[i] > 0) kraft += 1 / (1 << lengths[i]);
      }
      if (kraft > 1) {
        // Increase some lengths to compensate
        for (let i = 0; i < 256 && kraft > 1; i++) {
          if (lengths[i] > 0 && lengths[i] < max_len) {
            kraft -= 1 / (1 << lengths[i]);
            lengths[i]++;
            kraft += 1 / (1 << lengths[i]);
          }
        }
      }
    }
  }

  /** Build the encoding table (canonical code assignment). */
  private build_encode_table(): Array<{ code: number; length: number }> {
    if (this.encode_table) return this.encode_table;

    const table: Array<{ code: number; length: number }> = new Array(256);
    for (let i = 0; i < 256; i++) table[i] = { code: 0, length: 0 };

    // Collect symbols that have non-zero lengths
    const symbols: Array<{ symbol: number; length: number }> = [];
    for (let i = 0; i < 256; i++) {
      if (this.lengths[i] > 0) {
        symbols.push({ symbol: i, length: this.lengths[i] });
      }
    }

    // Sort by length, then by symbol (canonical ordering)
    symbols.sort((a, b) => a.length - b.length || a.symbol - b.symbol);

    // Assign canonical codes
    let code = 0;
    let prev_len = 0;
    for (const s of symbols) {
      if (prev_len > 0) {
        code = (code + 1) << (s.length - prev_len);
      }
      table[s.symbol] = { code, length: s.length };
      prev_len = s.length;
    }

    this.encode_table = table;
    return table;
  }

  /** Build the decode table. */
  private build_decode_table(): Map<number, { symbol: number; length: number }> {
    if (this.decode_table) return this.decode_table;

    const encode = this.build_encode_table();
    const decode = new Map<number, { symbol: number; length: number }>();

    for (let i = 0; i < 256; i++) {
      if (encode[i].length > 0) {
        // Key: pack (length, code) into a single number for fast lookup
        const key = (encode[i].length << 16) | encode[i].code;
        decode.set(key, { symbol: i, length: encode[i].length });
      }
    }

    this.decode_table = decode;
    return decode;
  }

  /**
   * Encode bytes into a bit stream.
   * Returns a Uint8Array with the encoded bits, plus the total bit count.
   */
  encode(data: Uint8Array): { bits: Uint8Array; bit_count: number } {
    const table = this.build_encode_table();

    // First pass: count total bits needed
    let total_bits = 0;
    for (let i = 0; i < data.length; i++) {
      const entry = table[data[i]];
      if (entry.length === 0) throw new Error(`symbol ${data[i]} has no code`);
      total_bits += entry.length;
    }

    const byte_count = Math.ceil(total_bits / 8);
    const bits = new Uint8Array(byte_count);

    // Second pass: write bits
    let bit_pos = 0;
    for (let i = 0; i < data.length; i++) {
      const { code, length } = table[data[i]];
      for (let b = length - 1; b >= 0; b--) {
        if ((code >> b) & 1) {
          bits[Math.floor(bit_pos / 8)] |= 0x80 >> (bit_pos % 8);
        }
        bit_pos++;
      }
    }

    return { bits, bit_count: total_bits };
  }

  /**
   * Decode a bit stream back to bytes.
   * @param bits - The encoded bit stream
   * @param bit_count - Total number of valid bits
   * @param expected_length - Expected number of output bytes
   */
  decode(bits: Uint8Array, bit_count: number, expected_length: number): Uint8Array {
    const decode_map = this.build_decode_table();
    const output = new Uint8Array(expected_length);
    let out_pos = 0;
    let bit_pos = 0;

    const max_len = Math.max(...Array.from(this.lengths));

    while (bit_pos < bit_count && out_pos < expected_length) {
      let code = 0;
      let length = 0;

      for (let len = 1; len <= max_len && bit_pos + len <= bit_count; len++) {
        // Read next bit
        const byte_idx = Math.floor((bit_pos + len - 1) / 8);
        const bit_idx = 7 - ((bit_pos + len - 1) % 8);
        code = (code << 1) | ((bits[byte_idx] >> bit_idx) & 1);
        length = len;

        const key = (length << 16) | code;
        const entry = decode_map.get(key);
        if (entry) {
          output[out_pos++] = entry.symbol;
          bit_pos += length;
          code = 0;
          length = 0;
          break;
        }
      }

      if (length > 0) {
        throw new Error(`invalid huffman code at bit position ${bit_pos}`);
      }
    }

    if (out_pos !== expected_length) {
      throw new Error(`decoded ${out_pos} bytes, expected ${expected_length}`);
    }

    return output;
  }

  /** Serialize tree as 256 bytes (one length per symbol). */
  serialize(): Uint8Array {
    return new Uint8Array(this.lengths);
  }

  /** Deserialize tree from 256 bytes. */
  static deserialize(data: Uint8Array): SymbolTree {
    if (data.length < 256) throw new Error("need 256 bytes for symbol tree");
    return new SymbolTree(data.slice(0, 256));
  }
}
