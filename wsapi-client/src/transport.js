import { store } from '@stevvvns/incomponent';
import { useIdentity } from '@stevvvns/identity-client';
import { useWebsocket } from './index.js';
import msgpack from 'msgpack5/dist/msgpack5.js';

const { decode: munpack } = msgpack();

export const useApi = store(function ApiStore(url, opts = {}) {
  const { log = console, timeout = 30000, ...wsOpts } = opts;
  const ws = useWebsocket(url, wsOpts);
  const ident = useIdentity();
  const inFlight = new Map();

  function msgLog(msgId, mtd, body) {
    const isError = mtd === null && 'error' in body;
    log.debug?.(
      `%c ${mtd ? '>' : '<'} %c ${msgId}\n%c${mtd ?? ''}%c${mtd ? '(' : ''}${isError ? '%c' : ''}${JSON.stringify(body, (_key, val) => (typeof val === 'bigint' ? Number(val) : val), 2)}${isError ? '%c' : ''}${mtd ? ')' : ''}`,
      `background: ${mtd ? 'purple' : isError ? 'red' : 'green'}; font-weight: bold; color: white; border-radius: 3px;`,
      'color: gray',
      'font-weight: bold',
      'color: #555',
      ...(isError ? ['color: darkred; font-weight: bold', 'color: gray'] : [])
    );
  }

  function rejectAll(reason) {
    for (const [, entry] of inFlight) {
      if (entry.timer) {
        clearTimeout(entry.timer);
      }
      entry.reject(reason);
    }
    inFlight.clear();
  }

  ws.onMessage(({ data }) => {
    const { txId, ...msg } = munpack(data);
    msgLog(txId, null, msg);
    const entry = inFlight.get(txId);
    if (!entry) {
      return;
    }
    if (entry.timer) {
      clearTimeout(entry.timer);
    }
    inFlight.delete(txId);
    if ('error' in msg) {
      entry.reject(new Error(msg.error));
    } else {
      entry.resolve(msg.value);
    }
  });

  ws.onClose(() => rejectAll(new Error('connection closed')));

  return new Proxy(
    {
      connected: ws.connected,
      nextRetryIn: ws.nextRetryIn
    },
    {
      get(target, mtd) {
        if (mtd in target) {
          return target[mtd];
        }
        if (typeof mtd === 'symbol') {
          return target[mtd];
        }
        if (mtd === 'then' || mtd === 'toJSON') {
          return undefined;
        }
        return function callApi(arg = {}) {
          return new Promise((resolve, reject) => {
            const txId = crypto.randomUUID();
            const timer =
              timeout > 0
                ? setTimeout(() => {
                  if (inFlight.delete(txId)) {
                    reject(new Error(`request ${String(mtd)} timed out`));
                  }
                }, timeout)
                : null;
            inFlight.set(txId, { resolve, reject, timer });
            msgLog(txId, mtd, arg);
            ident
              .sign({ _txId: txId, mtd, arg })
              .then((signed) => ws.send(signed))
              .catch((ex) => {
                const entry = inFlight.get(txId);
                if (entry) {
                  if (entry.timer) {
                    clearTimeout(entry.timer);
                  }
                  inFlight.delete(txId);
                  reject(ex);
                }
              });
          });
        };
      }
    }
  );
});
