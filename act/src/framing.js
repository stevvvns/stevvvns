// Length-prefixed framing for messages over a byte stream (TCP). Each frame is
// a 4-byte big-endian length followed by the msgpack payload, so a message that
// is split across chunks — or coalesced with the next one — is reassembled
// correctly.

export function frame(payload) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(payload.length);
  return Buffer.concat([head, payload]);
}

export function createFrameParser(onFrame) {
  let buf = Buffer.alloc(0);
  return (chunk) => {
    buf = buf.length === 0 ? chunk : Buffer.concat([buf, chunk]);
    while (buf.length >= 4) {
      const len = buf.readUInt32BE(0);
      if (buf.length < 4 + len) {
        break;
      }
      onFrame(buf.subarray(4, 4 + len));
      buf = buf.subarray(4 + len);
    }
  };
}
