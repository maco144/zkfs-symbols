// Lookup-table CRC32 (IEEE 802.3 polynomial)

const TABLE = new Uint32Array(256);

// Build lookup table once at module load
for (let i = 0; i < 256; i++) {
  let crc = i;
  for (let j = 0; j < 8; j++) {
    crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  TABLE[i] = crc >>> 0;
}

/** Compute CRC32 of a byte array. Returns unsigned 32-bit integer. */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Write CRC32 as 4 bytes big-endian into a new Uint8Array. */
export function crc32_bytes(data: Uint8Array): Uint8Array {
  const c = crc32(data);
  return new Uint8Array([(c >>> 24) & 0xff, (c >>> 16) & 0xff, (c >>> 8) & 0xff, c & 0xff]);
}

/** Verify CRC32: last 4 bytes of buf are big-endian CRC32 of preceding bytes. */
export function verify_crc32(buf: Uint8Array): boolean {
  if (buf.length < 4) return false;
  const payload = buf.subarray(0, buf.length - 4);
  const expected = crc32(payload);
  const view = new DataView(buf.buffer, buf.byteOffset + buf.length - 4, 4);
  return view.getUint32(0) === expected;
}
