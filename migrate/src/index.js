export class IrreversibleMigrationError extends Error {}

export class MigrationStore {
  template = `import { IrreversibleMigrationError } from '@stevvvns/migrate';

export const up = dbh => [
];

export const down = dbh => {
  throw new IrreversibleMigrationError;
};`;

  context = [];

  getAppliedNames() {
    throw new Error('you must override `MigrationConfig.getAppliedNames()`');
  }

  record(_name) {
    throw new Error('you must override `MigrationConfig.record(name)`');
  }

  erase(_name) {
    throw new Error('you must override `MigrationConfig.erase(name)`');
  }

  handleOperations() {}
  begin() {}
  commit() {}
  rollback() {}
  close() {}
}
