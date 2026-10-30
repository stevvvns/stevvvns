#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { MigrationStore } from './index.js';

const path = (() => {
  let path = process.cwd();
  if (/\/migrations$/.test(path)) {
    return path;
  }
  path = `${path}/migrations`;
  if (!existsSync(path)) {
    throw new Error('not in a `migrations` folder, or a folder containing one');
  }
  return path;
})();

const getDisk = () => {
  return readdirSync(path)
    .map((file) => ({
      path: `${path}/${file}`,
      name: file.replace(/[.]js$/, '')
    }))
    .filter(
      ({ path, name }) =>
        !statSync(path).isDirectory() && /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d+Z-/.test(name)
    )
    .sort();
};

const cfg = `${path}/config.js`;
const cfgErr = `expected '${cfg}' exporting an implementation of MigrationStore`;
if (!existsSync(cfg)) {
  throw new Error(cfgErr);
}
const config = new (await import(cfg)).default();
if (!(config instanceof MigrationStore)) {
  throw new Error(cfgErr);
}

const [_bin, _self, cmdArg, ...rest] = process.argv;
const dry = rest.includes('--dry');

const cmd = cmdArg ?? 'up';

const transaction = async (cb) => {
  try {
    if (dry) {
      const origQuery = config.dbh.query.bind(config.dbh);
      config.dbh.query = (sql, ...args) => {
        if (/SELECT .*?FROM migrations/.test(sql)) {
          return origQuery(sql, ...args);
        }
        if (/(TABLE|INSERT|DELETE) .*?migrations/.test(sql)) {
          return;
        }
        console.log(sql, args);
      };
    }
    await config.begin();
    await cb();
    await config.commit();
  } catch (ex) {
    try {
      await config.rollback();
    } catch (subEx) {
      console.error('while rolling back from error:', subEx);
    }
    console.error(ex);
  } finally {
    await config.close();
  }
};

const commands = {
  create(...nameParts) {
    const name =
      new Date().toISOString().replace(/[:.]/g, '-') +
      '-' +
      nameParts
        .join('-')
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^-_a-z0-9]/g, '');

    const tpl = `${path}/template.js`;
    const template = existsSync(tpl) ? readFileSync(tpl, { encoding: 'utf8' }) : config.template;
    const fullPath = `${path}/${name}.js`;
    writeFileSync(fullPath, template);
    console.log(fullPath);
  },

  async up() {
    const disk = getDisk();
    await transaction(async () => {
      const applied = new Set(await config.getAppliedNames());
      let any = false;
      for (const { name, path } of disk) {
        if (!applied.has(name)) {
          any = true;
          console.log(`\t/\\ ${name}`);
          const { up } = await import(path);
          await config.handleOperations(await up(...config.context));
          await config.record(name);
        }
      }
      if (!any) {
        console.log('up to date');
      }
    });
  },

  async down() {
    const disk = getDisk();
    const stopAt = rest.filter((arg) => arg !== '--dry')[0];
    await transaction(async () => {
      for (const name of (await config.getAppliedNames()).reverse()) {
        if (stopAt && name.includes(stopAt)) {
          break;
        }
        const diskRecord = disk.find((d) => d.name === name);
        if (diskRecord) {
          console.log(`\t\\/ ${name}`);
          const { down } = await import(diskRecord.path);
          await config.handleOperations(await down(...config.context));
          await config.erase(name);
          if (!stopAt) {
            break;
          }
        }
      }
    });
  }
};

if (!(cmd in commands)) {
  throw new Error(`unknown command '${cmd}', expected one of ${Object.keys(commands).join(', ')}`);
}
commands[cmd](...rest);
