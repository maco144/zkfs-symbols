// compress_blob / decompress_blob orchestrator

import { encode_varint, decode_varint } from "../codec/varint.js";
import {
  TAG_COMPRESSED_BLOB,
  write_envelope,
  read_envelope,
} from "../codec/constants.js";
import { ContentType, detect_content_type } from "./content-detector.js";
import { Dictionary } from "./dictionary.js";

// Compression methods
const METHOD_NONE = 0x00;
const METHOD_DEFLATE = 0x01;
const METHOD_DICTIONARY = 0x02;
const METHOD_DICT_DEFLATE = 0x03;

export type CompressorFn = (data: Uint8Array) => Uint8Array;
export type DecompressorFn = (data: Uint8Array, originalSize: number) => Uint8Array;

export interface PipelineOptions {
  dictionary?: Dictionary;
  fallback_compress?: CompressorFn;
  fallback_decompress?: DecompressorFn;
}

/**
 * Compress a blob. Returns an envelope-wrapped CompressedBlob.
 * If compressed >= original, falls back to uncompressed (method=none).
 */
export function compress_blob(plaintext: Uint8Array, opts?: PipelineOptions): Uint8Array {
  const content_type = detect_content_type(plaintext);
  const dictionary = opts?.dictionary;
  const fallback_compress = opts?.fallback_compress;

  let best_data = plaintext;
  let best_method = METHOD_NONE;

  // Try dictionary compression
  if (dictionary && (content_type === ContentType.TEXT_UTF8 || content_type === ContentType.JSON)) {
    try {
      const dict_compressed = dictionary.compress(plaintext);
      if (dict_compressed.length < best_data.length) {
        best_data = dict_compressed;
        best_method = METHOD_DICTIONARY;
      }
    } catch {
      // Dictionary compression failed, continue with other methods
    }
  }

  // Try fallback (e.g. deflate)
  if (fallback_compress) {
    try {
      // If we already have dictionary-compressed data, try deflate on top
      if (best_method === METHOD_DICTIONARY && dictionary) {
        const dict_deflate = fallback_compress(best_data);
        if (dict_deflate.length < best_data.length) {
          best_data = dict_deflate;
          best_method = METHOD_DICT_DEFLATE;
        }
      }

      // Also try raw deflate on original
      const deflated = fallback_compress(plaintext);
      if (deflated.length < best_data.length) {
        best_data = deflated;
        best_method = METHOD_DEFLATE;
      }
    } catch {
      // Deflate failed, continue with what we have
    }
  }

  // If nothing helped, store uncompressed
  if (best_data.length >= plaintext.length) {
    best_data = plaintext;
    best_method = METHOD_NONE;
  }

  // Build payload: method(1) + content_type(1) + original_size(varint) + compressed_len(varint) + data
  const orig_size_bytes = encode_varint(plaintext.length);
  const comp_len_bytes = encode_varint(best_data.length);

  const payload = new Uint8Array(1 + 1 + orig_size_bytes.length + comp_len_bytes.length + best_data.length);
  let off = 0;
  payload[off++] = best_method;
  payload[off++] = content_type;
  payload.set(orig_size_bytes, off); off += orig_size_bytes.length;
  payload.set(comp_len_bytes, off); off += comp_len_bytes.length;
  payload.set(best_data, off);

  return write_envelope(TAG_COMPRESSED_BLOB, payload);
}

/**
 * Decompress a blob. Accepts an envelope-wrapped CompressedBlob.
 */
export function decompress_blob(compressed: Uint8Array, opts?: PipelineOptions): Uint8Array {
  const { tag, payload } = read_envelope(compressed);
  if (tag !== TAG_COMPRESSED_BLOB) {
    throw new Error(`expected CompressedBlob tag 0x10, got 0x${tag.toString(16)}`);
  }

  let offset = 0;
  const method = payload[offset++];
  const _content_type = payload[offset++]; // preserved for future use

  const [original_size, os_len] = decode_varint(payload, offset);
  offset += os_len;

  const [compressed_len, cl_len] = decode_varint(payload, offset);
  offset += cl_len;

  let data: Uint8Array<ArrayBuffer> = payload.slice(offset, offset + compressed_len);

  const dictionary = opts?.dictionary;
  const fallback_decompress = opts?.fallback_decompress;

  switch (method) {
    case METHOD_NONE:
      return data;

    case METHOD_DEFLATE:
      if (!fallback_decompress) throw new Error("deflate decompressor not provided");
      return fallback_decompress(data, original_size);

    case METHOD_DICTIONARY:
      if (!dictionary) throw new Error("dictionary not provided for decompression");
      return dictionary.decompress(data, original_size);

    case METHOD_DICT_DEFLATE: {
      if (!fallback_decompress) throw new Error("deflate decompressor not provided");
      if (!dictionary) throw new Error("dictionary not provided for decompression");
      // First undo deflate, then undo dictionary
      const inflated = fallback_decompress(data, 0); // intermediate size unknown, pass 0
      return dictionary.decompress(inflated, original_size);
    }

    default:
      throw new Error(`unknown compression method: 0x${method.toString(16)}`);
  }
}
