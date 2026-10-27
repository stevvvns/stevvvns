import { ref, store, derive } from '@stevvvns/incomponent';
import msgpack from 'msgpack5/dist/msgpack5';
const { encode: mpack } = msgpack();

const IDENTITY_VERSION = 1;
const ACCOUNTS_VERSION = 2;

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

  putMany(storeName, values) {
    return this.#mut(storeName, (store) => {
      for (const value of values) {
        store.put(value);
      }
    });
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

const randomUint32 = () => crypto.getRandomValues(new Uint32Array(1))[0];

class Accounts extends IndexedStore {
  constructor() {
    super('accounts', ACCOUNTS_VERSION, (db) => {
      if (!db.objectStoreNames.contains('accounts')) {
        const store = db.createObjectStore('accounts', { keyPath: 'id' });
        store.createIndex('accounts', 'name', { unique: true });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta');
      }
    });
  }

  async getList() {
    const list = await this.getAll('accounts');
    return list.sort((a, b) => a.ordering - b.ordering);
  }

  getCurrent() {
    return this.getOne('meta', 'current');
  }

  setCurrent(id) {
    return this.putAll('meta', { current: id });
  }

  async add(name) {
    if (name.trim() === '') {
      throw new Error('account name cannot be blank');
    }
    const list = await this.getList();
    const id = crypto.randomUUID();
    try {
      await this.putOne('accounts', {
        id,
        name,
        seed: randomUint32(),
        ordering: list.length
      });
      await this.setCurrent(id);
    } catch (ex) {
      if (ex.name === 'ConstraintError') {
        throw new Error('duplicate account name', { cause: ex });
      }
      throw ex;
    }
  }

  async update(id, acc) {
    const account = await this.getOne('accounts', id);
    if (!account) {
      throw new Error(`account ${id} not found`);
    }
    return this.putOne('accounts', { ...account, ...acc, id });
  }

  async reroll(id) {
    const account = await this.getOne('accounts', id);
    if (!account) {
      throw new Error(`account ${id} not found`);
    }
    return this.putOne('accounts', { ...account, seed: randomUint32() });
  }

  async move(id, idx) {
    const list = await this.getList();
    const from = list.findIndex((account) => account.id === id);
    if (from === -1) {
      throw new Error(`account ${id} not found`);
    }

    const to = Math.max(0, Math.min(idx, list.length - 1));
    if (from === to) {
      return;
    }

    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);

    const changed = [];
    for (let i = 0; i < list.length; i++) {
      if (list[i].ordering !== i) {
        changed.push({ ...list[i], ordering: i });
      }
    }

    if (changed.length > 0) {
      await this.putMany('accounts', changed);
    }
  }

  async remove(id) {
    await this.deleteOne('accounts', id);
    const remaining = await this.getList();
    if (remaining.length === 0) {
      await this.add('default');
      return;
    }
    const changed = [];
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].ordering !== i) {
        changed.push({ ...remaining[i], ordering: i });
      }
    }
    if (changed.length > 0) {
      await this.putMany('accounts', changed);
    }
    const current = await this.getCurrent();
    if (current === id || current === undefined) {
      await this.setCurrent(remaining[0].id);
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
  if (list.length === 0) {
    await accounts.add('default');
  } else if ((await accounts.getCurrent()) === undefined) {
    await accounts.setCurrent(list[0].id);
  }
  return {
    sign,
    accounts
  };
}

export const useIdentity = store(function identityStore(log = () => {}) {
  let accounts, deviceSign;
  const accountList = ref([]);
  const currentAccountId = ref();
  const currentAccount = derive(() => {
    return accountList.value.find(({ id }) => id === currentAccountId.value);
  }, [accountList, currentAccountId]);
  async function refresh() {
    accountList.value = await accounts.getList();
    currentAccountId.value = await accounts.getCurrent();
  }

  const ready = (async () => {
    const ident = await initIdentity(log);
    accounts = ident.accounts;
    deviceSign = ident.sign;
    await refresh();
  })();

  async function addAccount(name) {
    await ready;
    await accounts.add(name);
    await refresh();
  }
  async function setCurrentAccount(id) {
    await ready;
    await accounts.setCurrent(id);
    await refresh();
  }
  async function rerollAccountSeed(id = null) {
    await ready;
    await accounts.reroll(id ?? currentAccountId.value);
    await refresh();
  }
  async function moveAccount(idx, id = null) {
    await ready;
    await accounts.move(id ?? currentAccountId.value, idx);
    await refresh();
  }
  async function removeAccount(id = null) {
    await ready;
    await accounts.remove(id ?? currentAccountId.value);
    await refresh();
  }
  async function sign(msg) {
    if (typeof msg !== 'object' || msg === null || Array.isArray(msg)) {
      throw new Error('sign() expects a message object');
    }
    await ready;
    return deviceSign({ ...msg, _account: currentAccountId.value });
  }
  async function updateAccount(vals, id = null) {
    await ready;
    await accounts.update(id ?? currentAccountId.value, vals);
    await refresh();
  }
  return {
    sign,
    accountList,
    currentAccount,
    addAccount,
    setCurrentAccount,
    rerollAccountSeed,
    moveAccount,
    removeAccount,
    updateAccount
  };
});
