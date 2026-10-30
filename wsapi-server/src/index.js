import { WebSocketServer } from 'ws';
import { verify } from '@stevvvns/identity-server';
import { readdirSync } from 'fs';
import { isLeft } from 'fp-ts/lib/Either.js';
import { PathReporter } from 'io-ts/lib/PathReporter.js';
import msgpack from 'msgpack5/dist/msgpack5.js';
import _ from 'lodash';

const { mapKeys, mapValues, camelCase } = _;
const { encode: mpack } = msgpack();

export class PublicError extends Error {}

function camelCaseKeys(map) {
  return mapKeys(map, (val, key) => camelCase(key));
}
function camelCaseMap(map) {
  return mapValues(camelCaseKeys(map), (val) =>
    val?.constructor === Object ? camelCaseKeys(val) : val
  );
}
function camelCaseBody(body) {
  if (Array.isArray(body)) {
    return body.map(camelCaseBody);
  }
  if (body?.constructor === Object) {
    return camelCaseMap(body);
  }
  return body;
}

export default async function attach(app, { path, log, verifyAccount = () => {} }) {
  const actions = {};
  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });

  async function handleMessage(ws, msg) {
    await ready;
    let data;
    try {
      data = await verify(msg);
    } catch (ex) {
      log?.error?.(ex);
    }
    if (
      !data?.payload ||
      !data.payload._txId ||
      !data.payload._account ||
      !data.payload.mtd ||
      !data.payload.arg
    ) {
      ws.send(mpack({ txId: data?.payload?._txId, error: 'transport error' }));
      log?.error?.('transport error');
      return;
    }
    const reply = (msg) => ws.send(mpack({ txId: data.payload._txId, ...msg }));
    try {
      await verifyAccount(data.publicKey, data.payload._account);
    } catch (ex) {
      log?.error?.(ex.message, { ex });
      reply({
        error: ex instanceof PublicError ? ex.message : 'forbidden'
      });
      return;
    }

    if (!(data.payload.mtd in actions)) {
      reply({ error: 'unknown method' });
      return;
    }
    const parsedArg = actions[data.payload.mtd].arg.decode(data.payload.arg);
    if (isLeft(parsedArg)) {
      reply({ error: PathReporter.report(parsedArg) });
      return;
    }
    try {
      reply({
        value: camelCaseBody(await actions[data.payload.mtd].impl(parsedArg.right))
      });
    } catch (ex) {
      log?.error?.(ex.message, { ex });
      reply({
        error: ex instanceof PublicError ? ex.message : 'an error occurred'
      });
    }
  }

  const listen = app.listen.bind(app);
  app.listen = (...args) => {
    const server = listen(...args);
    const wss = new WebSocketServer({ server });
    wss.on('connection', (ws) => {
      ws.on('message', (msg) => handleMessage(ws, msg));
    });
    return server;
  };

  for (const file of readdirSync(path).filter((file) => /[.]js$/.test(file))) {
    const { arg, default: impl } = await import(`${path}/${file}`);
    if (impl.name in actions) {
      throw new Error(`duplicate action name ${impl.name}`);
    }
    log?.info?.(`\t${impl.name}(${arg.name})`);
    actions[impl.name] = { arg, impl };
  }
  resolveReady();
}
