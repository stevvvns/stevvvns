#!/usr/bin/env node
import Koa from 'koa';
import serve from 'koa-static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verify } from '../src/lib/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const root = process.env.DIST_PATH || path.resolve(__dirname, '../../identity-client/dist');

const app = new Koa();

app.use(async (ctx, next) => {
  if (ctx.method !== 'POST' || ctx.path !== '/echo') {
    return next();
  }

  const chunks = [];
  for await (const chunk of ctx.req) {
    chunks.push(chunk);
  }

  try {
    const { payload, publicKey } = await verify(Buffer.concat(chunks));
    ctx.type = 'application/json';
    ctx.body = {
      payload: payload.text.toUpperCase(),
      account: payload._account,
      publicKey: Buffer.from(publicKey).toString('base64'),
    };
  } catch (err) {
    console.error(err);
    ctx.status = 400;
    ctx.type = 'text/plain';
    ctx.body = `verification failed: ${err.message}`;
  }
});

app.use(serve(root));

const server = app.listen(Number(process.env.PORT) || 0, () => {
  const { port } = server.address();
  console.log(`serving ${root} on http://localhost:${port}`);
});
