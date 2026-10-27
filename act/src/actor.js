import msgpack from 'msgpack5/dist/msgpack5.js';

const { encode, decode } = msgpack();

export default function actor(callbacks) {
  const reply = (msg) => {
    process.send(encode(msg));
  };

  process.on('message', async (msg) => {
    if (msg === 'exit') {
      process.exit(0);
    }
    const [id, mtd, args] = decode(msg);
    if (!callbacks[mtd]) {
      reply([id, 'error', `no such method ${mtd}`]);
      return;
    }
    try {
      reply([id, 'ok', await callbacks[mtd](...args)]);
    } catch (ex) {
      reply([id, 'error', ex.toString()]);
      // Deliberately crash after replying: the actor restarts fresh on the next
      // call, so a poisoned actor can't get stuck in a bad state.
      throw ex;
    }
  });
}
