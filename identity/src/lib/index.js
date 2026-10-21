export const foo = 42;

const KEYS_VERSION = 1;

class KeyStore {
  constructor() {
    const req = indexedDB.open('identity', KEYS_VERSION);
    this.ready = new Promise((resolve, reject) => {
      req.onerror = evt => reject(evt.error);
      req.onupgradeneeded = evt => {
        const db = evt.target.result;
        if (!db.objectStoreNames.contains('keys')) {
          db.createObjectStore('keys');
        }
      };
      req.onsuccess = evt => {
        resolve(evt.target.result);
      };
    });
  }

  async #trans(mode = 'readonly') {
    const db = await this.ready;
    const tx = db.transaction('keys', mode);
    const store = tx.objectStore('keys');
    return { tx, store };
  }
  async set(name, key) {
    const { tx, store } = await this.#trans('readwrite');
    store.put(key.privateKey, name);
    store.put(key.publicKey, name + '.pub');
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async get(name) {
    const { store } = await this.#trans('readonly');
    return new Promise((resolve, reject) => {
      const req = store.get(name);
      req.onsuccess = evt => resolve(evt.target.result);
      req.onerror = () => reject(req.error);
    });
  }
}

function genKey() {
  return crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256'
    },
    false,
    ['sign', 'verify']
  );
}

async function assertCapabilities() {
  if (!window.crypto?.subtle || !window.indexedDB) {
    throw new Error('browser is missing core capabilities');
  }

  const testKey = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false, // non-extractable test
    ["sign"]
  );

  const channel = new MessageChannel();
  channel.port1.postMessage(testKey);

  // TODO firefox shows a scary warning, should probably be moved to a field in account settings or something
  // there is also a persisted() method to check
  //navigator.storage?.persist?.();
}

export async function test(log = () => {}) {
  await assertCapabilities();
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const store = new KeyStore;
  let deviceKey = await store.get('');
  let devicePub = await store.get('.pub');
  if (!deviceKey) {
    log('generate device key');
    const gen = await genKey();
    await store.set('', gen);
    deviceKey = gen.privateKey;
    devicePub = gen.publicKey;
  } else {
    log('recovered device key');
  }
  function sign(payload) {
    const te = new TextEncoder;
    return crypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' }
      },
      deviceKey,
      te.encode(payload)
    );
  }
  /*
  function verify(signed, payload) {
    const te = new TextEncoder;
    return crypto.subtle.verify(
      { name: 'ECDSA', hash: { name: 'SHA-256' }},
      devicePub,
      signed,
      te.encode(payload)
    );
  }
  console.log(await verify(await sign('asdf'), 'asdf'));
  */
  return sign;
}
