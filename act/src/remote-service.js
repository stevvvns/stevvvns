import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { fork } from 'node:child_process';
import msgpack from 'msgpack5/dist/msgpack5.js';
import { frame, createFrameParser } from './framing.js';

const { encode, decode } = msgpack();

if (process.argv.length !== 3) {
  console.error(
    'you must provide a path to a configuration file as an argument'
  );
  process.exit(1);
}
const config = (await import(resolve(process.cwd(), process.argv[2]))).default;
const host = config.listen ?? '127.0.0.1';
if (!['127.0.0.1', 'localhost'].includes(host)) {
  console.warn(
    'WARNING: it is dangerous to use this service without firewalling it so that only your application(s) can access it!'
  );
}
const log = config.log ? config.log : () => {};
const actors = {};
for (const [name, path] of Object.entries(config.actors)) {
  log({ evt: 'register', name, path });
  actors[name] = fork(path, [], { serialization: 'advanced' });
}

createServer((sock) => {
  // Forwarding for this connection: actor name -> { proc, handler }. Tracked so
  // reconnects don't stack duplicate listeners and everything is removed on close.
  const forwards = new Map();

  function setForward(name) {
    const prev = forwards.get(name);
    if (prev) {
      prev.proc.removeListener('message', prev.handler);
    }
    const proc = actors[name];
    const handler = (msg) => {
      sock.write(frame(encode(['call', decode(msg)])));
    };
    proc.on('message', handler);
    forwards.set(name, { proc, handler });
  }

  function clearForwards() {
    for (const { proc, handler } of forwards.values()) {
      proc.removeListener('message', handler);
    }
    forwards.clear();
  }

  sock.on('close', clearForwards);
  sock.on('error', clearForwards);

  const onFrame = createFrameParser((payload) => {
    const [op, data] = decode(payload);
    log({ evt: 'rcv', op, data });

    if (op === 'ensure') {
      const ok = actors[data] !== undefined;
      sock.write(
        frame(encode(['ensure', { status: ok ? 'ok' : 'na', name: data }]))
      );
      if (ok) {
        setForward(data);
      }
    }

    if (op === 'call') {
      const [id, name, mtd, args] = data;
      if (!actors[name]) {
        return;
      }
      if (!actors[name].connected) {
        actors[name] = fork(config.actors[name], [], {
          serialization: 'advanced'
        });
        setForward(name);
        sock.write(frame(encode(['crash', { name }])));
        return;
      }
      actors[name].send(encode([id, mtd, args]));
    }
  });

  sock.on('data', (chunk) => onFrame(chunk));
}).listen(config.port ? parseInt(config.port) : 22327, host);
