import { store } from '@stevvvns/incomponent';
import msgpack from 'msgpack5/dist/msgpack5';
const { encode: mpack } = msgpack();

const IDENTITY_VERSION = 1;
const ACCOUNTS_VERSION = 1;

class IndexedStore {
  constructor(name, version, upgrade) {
    const req = indexedDB.open(name, version);
    this.ready = new Promise((resolve, reject) => {
      req.onerror = (evt) => reject(evt.error);
      req.onupgradeneeded = (evt) => {
        upgrade(evt.target.result);
      };
      req.onsuccess = (evt) => {
        resolve(evt.target.result);
      };
    });
  }

  async trans(store, mode = 'readonly') {
    const db = await this.ready;
    const tx = db.transaction(store, mode);
    return { tx, store: tx.objectStore(store) };
  }

  async #query(storeName, name, mtd) {
    const { store } = await this.trans(storeName);
    return new Promise((resolve, reject) => {
      const req = store[mtd](name);
      req.onsuccess = (evt) => resolve(evt.target.result);
      req.onerror = () => reject(req.error);
    });
  }

  async #mut(storeName, cb) {
    const { tx, store } = await this.trans(storeName, 'readwrite');
    await cb(store);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = (evt) => reject(evt.target.error);
    });
  }

  getOne(store, name) {
    return this.#query(store, name, 'get');
  }

  getAll(store, name = undefined) {
    return this.#query(store, name, 'getAll');
  }

  putAll(storeName, values) {
    return this.#mut(storeName, (store) => {
      for (const [key, val] of Object.entries(values)) {
        store.put(val, key);
      }
    });
  }

  putOne(storeName, value) {
    return this.#mut(storeName, (store) => {
      store.put(value);
    });
  }

  deleteOne(storeName, key) {
    return this.#mut(storeName, (store) => store.delete(key));
  }
}

export class KeyStore extends IndexedStore {
  constructor() {
    super('identity', IDENTITY_VERSION, (db) => {
      if (!db.objectStoreNames.contains('keys')) {
        db.createObjectStore('keys');
      }
    });
  }

  init({ privateKey, pubRaw }) {
    return this.putAll('keys', {
      key: privateKey,
      pub: pubRaw
    });
  }

  get(name) {
    return this.getOne('keys', name);
  }

  static willExpire() {
    /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  }

  static isPersisted() {
    return navigator.storage?.persisted?.();
  }

  static requestPersistence() {
    navigator.storage?.persist?.();
  }

  static async assertCapabilities() {
    if (!window.crypto?.subtle || !window.indexedDB) {
      throw new Error('browser is missing core capabilities');
    }

    const testKey = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );

    const channel = new MessageChannel();
    channel.port1.postMessage(testKey);
  }
}

const ECDSA = { name: 'ECDSA', namedCurve: 'P-256' };

async function genKey() {
  // Generate extractable so we can export the public key; the private key is
  // re-imported non-extractable so it can't leave the browser.
  const pair = await crypto.subtle.generateKey(ECDSA, true, ['sign', 'verify']);

  const pubRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', pair.publicKey)
  );
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    await crypto.subtle.exportKey('pkcs8', pair.privateKey),
    ECDSA,
    false,
    ['sign']
  );

  return { privateKey, pubRaw };
}

class Accounts extends IndexedStore {
  constructor() {
    super('accounts', ACCOUNTS_VERSION, (db) => {
      if (!db.objectStoreNames.contains('accounts')) {
        const store = db.createObjectStore('accounts', { keyPath: 'id' });
        store.createIndex('accounts', 'name', { unique: true });
      }
    });
  }

  getList() {
    return this.getAll('accounts');
  }

  add(name) {
    return this.putOne('accounts', {
      id: crypto.randomUUID(),
      name,
      seed: Math.random()
    });
  }

  async rename(id, name) {
    const account = await this.getOne('accounts', id);
    if (!account) throw new Error(`account ${id} not found`);
    return this.putOne('accounts', { ...account, name });
  }

  async reroll(id) {
    const account = await this.getOne('accounts', id);
    if (!account) throw new Error(`account ${id} not found`);
    return this.putOne('accounts', { ...account, seed: Math.random() });
  }

  async remove(id) {
    await this.deleteOne('accounts', id);
    const remaining = await this.getAll('accounts');
    if (remaining.length === 0) {
      await this.add('default');
    }
  }
}

export default async function initIdentity(log = () => {}) {
  await KeyStore.assertCapabilities();
  const store = new KeyStore();
  let deviceKey = await store.get('key');
  let devicePub = await store.get('pub');
  if (!deviceKey) {
    log('generate device key');
    const gen = await genKey();
    await store.init(gen);
    deviceKey = gen.privateKey;
    devicePub = gen.pubRaw;
  } else {
    log('recovered device key');
  }
  async function sign(payload) {
    const packed = mpack(payload);
    const sig = new Uint8Array(
      await crypto.subtle.sign(
        {
          name: 'ECDSA',
          hash: { name: 'SHA-256' }
        },
        deviceKey,
        packed
      )
    );

    // <public key (65B)><signature (64B)><msgpack payload>
    const out = new Uint8Array(devicePub.length + sig.length + packed.length);
    out.set(devicePub, 0);
    out.set(sig, devicePub.length);
    out.set(packed, devicePub.length + sig.length);
    return out;
  }
  const accounts = new Accounts();
  const list = await accounts.getList();
  console.log({ list });
  if (list.length === 0) {
    await accounts.add('default');
  }
  return {
    sign,
    accounts
  };
}
