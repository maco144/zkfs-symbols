// Byte-inspection content type sniffing

export const enum ContentType {
  UNKNOWN = 0x00,
  TEXT_UTF8 = 0x01,
  JSON = 0x02,
  BINARY = 0x03,
}

/**
 * Detect content type by inspecting the first bytes of data.
 * - First byte `{`/`[` + valid UTF-8 prefix → JSON
 * - >90% printable ASCII/UTF-8, no nulls → TEXT_UTF8
 * - Otherwise → BINARY
 */
export function detect_content_type(data: Uint8Array): ContentType {
  if (data.length === 0) return ContentType.BINARY;

  const first = data[0];

  // JSON check: starts with { or [
  if (first === 0x7b || first === 0x5b) {
    // Validate a bit more: scan first 64 bytes for non-UTF8 / null bytes
    const check_len = Math.min(data.length, 64);
    let valid = true;
    for (let i = 0; i < check_len; i++) {
      if (data[i] === 0x00) { valid = false; break; }
    }
    if (valid) return ContentType.JSON;
  }

  // Text check: sample up to 512 bytes
  const sample_len = Math.min(data.length, 512);
  let printable = 0;
  let has_null = false;

  for (let i = 0; i < sample_len; i++) {
    const b = data[i];
    if (b === 0x00) { has_null = true; break; }
    // Printable ASCII (0x20-0x7E) + common control chars (tab, newline, carriage return)
    if ((b >= 0x20 && b <= 0x7e) || b === 0x09 || b === 0x0a || b === 0x0d || b >= 0x80) {
      printable++;
    }
  }

  if (!has_null && printable / sample_len > 0.9) {
    return ContentType.TEXT_UTF8;
  }

  return ContentType.BINARY;
}
