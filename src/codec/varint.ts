// LEB128 unsigned varint encode/decode

/** Encode an unsigned integer as LEB128 varint bytes. */
export function encode_varint(value: number): Uint8Array {
  if (value < 0) throw new RangeError("varint must be non-negative");

  const bytes: number[] = [];
  do {
    let byte = value & 0x7f;
    value = Math.floor(value / 128); // avoid bitwise for large numbers
    if (value > 0) byte |= 0x80;
    bytes.push(byte);
  } while (value > 0);

  return new Uint8Array(bytes);
}

/** Decode a LEB128 varint from buf at the given offset. Returns [value, bytesRead]. */
export function decode_varint(buf: Uint8Array, offset: number): [number, number] {
  let value = 0;
  let shift = 0;
  let pos = offset;

  while (pos < buf.length) {
    const byte = buf[pos];
    value += (byte & 0x7f) * (2 ** shift); // avoid bitwise for large numbers
    pos++;

    if ((byte & 0x80) === 0) {
      return [value, pos - offset];
    }

    shift += 7;
    if (shift > 49) throw new RangeError("varint too large"); // max safe integer
  }

  throw new RangeError("varint: unexpected end of buffer");
}
