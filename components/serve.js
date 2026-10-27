import * as esbuild from 'esbuild';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, relative } from 'node:path';

const entries = readdirSync('src')
  .filter((file) => file.endsWith('.js'))
  .map((file) => `src/${file}`);

// Build in-memory only (never writes to disk, never touches src/).
const result = await esbuild.build({
  entryPoints: entries,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  outdir: 'dist',
  write: false,
  loader: { '.svg': 'text', '.css': 'text' }
});

const bundles = new Map();
for (const file of result.outputFiles) {
  bundles.set('/' + relative(process.cwd(), file.path), file.text);
}

const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png'
};

const port = Number(process.env.PORT) || 3939;

createServer((req, res) => {
  let path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/') {
    path = '/index.html';
  }

  const bundle = bundles.get(path);
  if (bundle !== undefined) {
    res.writeHead(200, { 'content-type': 'text/javascript' });
    res.end(bundle);
    return;
  }

  const file = '.' + path;
  if (existsSync(file) && statSync(file).isFile()) {
    res.writeHead(200, {
      'content-type': mime[extname(file)] || 'application/octet-stream'
    });
    res.end(readFileSync(file));
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
}).listen(port, () => {
  console.log(`demo at http://localhost:${port}`);
});
