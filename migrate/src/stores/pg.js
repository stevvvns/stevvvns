import { MigrationStore } from '../index.js';

export default (pg, connInfo) =>
  class PgConfig extends MigrationStore {
    connected = false;

    constructor() {
      super();
      this.dbh = new pg.Client(connInfo);
      this.context = [this.dbh];
    }

    async connect() {
      if (this.connected) {
        return;
      }
      await this.dbh.connect();
      try {
        await this.dbh.query(`
        CREATE TABLE migrations (
          name text not null primary key,
          applied timestamp not null default now()
        )
      `);
      } catch (ex) {
        if (!/already exists/.test(ex.toString())) {
          throw ex;
        }
      }
      this.connected = true;
    }

    async begin() {
      await this.connect();
      await this.dbh.query('BEGIN');
    }
    async commit() {
      await this.dbh.query('COMMIT');
    }
    async rollback() {
      await this.dbh.query('ROLLBACK');
    }

    async getAppliedNames() {
      await this.connect();
      const { rows } = await this.dbh.query('SELECT name FROM migrations ORDER BY name');
      return rows.map(({ name }) => name);
    }

    async record(name) {
      await this.dbh.query('INSERT INTO migrations(name) VALUES ($1)', [name]);
    }

    async erase(name) {
      await this.dbh.query('DELETE FROM migrations WHERE name = $1', [name]);
    }

    async handleOperations(ops) {
      if (typeof ops === 'string') {
        await this.dbh.query(ops);
      } else if (Array.isArray(ops)) {
        for (const query of ops) {
          await this.dbh.query(query);
        }
      }
    }

    close() {
      if (this.connected) {
        this.dbh.end();
      }
    }
  };
