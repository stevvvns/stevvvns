import msgpack from 'msgpack5';
import crypto from 'node:crypto';

const { decode } = msgpack();

const PUB_BYTES = 33; // compressed SEC1 point: 0x02/0x03 prefix + X (32B)
const SIG_BYTES = 64;

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-([0-9a-f])[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertV7(account) {
  if (account === undefined) {
    return;
  }
  const version = UUID_V7.exec(account)?.[1];
  if (version !== '7') {
    throw new Error('account id is not a version 7 uuid');
  }
}

export async function verify(buffer) {
  if (buffer.byteLength < PUB_BYTES + SIG_BYTES) {
    throw new Error('buffer too short');
  }

  const pub = buffer.subarray(0, PUB_BYTES);
  const sig = buffer.subarray(PUB_BYTES, PUB_BYTES + SIG_BYTES);
  const packed = buffer.subarray(PUB_BYTES + SIG_BYTES);

  // WebCrypto only accepts uncompressed points, so decompress before importing.
  const raw = crypto.ECDH.convertKey(
    Buffer.from(pub),
    'prime256v1',
    undefined,
    undefined,
    'uncompressed'
  );

  const key = await crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['verify']
  );

  const ok = await crypto.subtle.verify(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    key,
    sig,
    packed
  );

  if (!ok) {
    throw new Error('signature verification failed');
  }

  const payload = decode(Buffer.from(packed));
  assertV7(payload?._account);

  return {
    publicKey: pub,
    payload
  };
}
