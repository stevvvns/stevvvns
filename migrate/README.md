# migrate

## What?
This is a database migration utility target node and postgres, although theoretically you can use other databases.

## Why?
It's simpler and more ergonomic to use that many alternatives.

## How?
```
$ npm i --save-dev @stevvvns/migrate`
$ mkdir migrations
$ ln -s node_modules/.bin/migrate
```

Then, create `./migrations/config.js` to choose which database(s) you want to manage. For example:

```
import pgStore from '@stevvvns/migrate/stores/pg';
import pg from 'pg';
import conf from '../config.js'; // however you get your connection credentials

export default pgStore(pg, conf.pg);
```

(In the unlikely event that you use this and you can't figure out how to extend stores to suit your needs, LMK. There is an interface to target in `index.js`.)

After setting up, `./migrate create make some shit` creates a file like:
```
// migrations/2025-11-12T07-00-03-706Z-make-some-shit.js
import { IrreversibleMigrationError } from '@stevvvns/migrate';

export const up = dbh => [
];

export const down = dbh => {
  throw new IrreversibleMigrationError;
};
```

You can modify this by creating `migrations/template.js`.

For `up` and `down`, you can return a list of SQL strings, throw an error, or do arbitrary JS stuff. However, if you do arbitrary JS stuff dry runs may or may not work, with an emphasis on may not.

`./migrate up` or just `./migrate` will apply all pending migrations.

`./migrate down` will roll back the most recent migration.

`./migrate down <some substring>` will roll back migrations until one contains the given substring. This is pretty dangerous if you don't make destructive `down` ops irreversible, but I'm sure you have backups.
