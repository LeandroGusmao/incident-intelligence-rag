/** A migration by name and content hash: a file on disk, or a row in `schema_migrations`. */
export interface MigrationFile {
  readonly name: string;
  readonly checksum: string;
}

export class MigrationError extends Error {
  override name = "MigrationError";
}

/** Zero-padded, so name order is apply order: `0001_enable_pgvector.sql`. */
const FILE_NAME = /^(\d{4})_[a-z0-9_]+\.sql$/;

/** Code-unit order, not `localeCompare`: apply order must not depend on the machine's locale. */
function byName(a: MigrationFile, b: MigrationFile): number {
  if (a.name === b.name) return 0;
  return a.name < b.name ? -1 : 1;
}

function assertValidNames(sorted: readonly MigrationFile[]): void {
  const seen = new Map<string, string>();
  for (const { name } of sorted) {
    const number = FILE_NAME.exec(name)?.[1];
    if (number === undefined) {
      throw new MigrationError(
        `invalid migration file name "${name}": expected NNNN_snake_case.sql`,
      );
    }
    const other = seen.get(number);
    if (other !== undefined) {
      throw new MigrationError(
        `duplicate migration number ${number}: ${other} and ${name}`,
      );
    }
    seen.set(number, name);
  }
}

/**
 * Returns the pending files in apply order, as the same objects it was given.
 * Throws a `MigrationError` naming the file when an applied migration was
 * edited, renamed, removed, or overtaken by an older one. Pure, so every rule
 * is unit-testable without a database.
 */
export function planMigrations<T extends MigrationFile>(
  files: readonly T[],
  applied: readonly MigrationFile[],
): T[] {
  const sorted = [...files].sort(byName);
  assertValidNames(sorted);

  const filesByName = new Map(sorted.map((file) => [file.name, file]));
  for (const row of applied) {
    const file = filesByName.get(row.name);
    if (file === undefined) {
      throw new MigrationError(
        `${row.name} was applied but is missing from the migrations directory`,
      );
    }
    if (file.checksum !== row.checksum) {
      throw new MigrationError(
        `${row.name} was changed after it was applied; write a new migration instead`,
      );
    }
  }

  const appliedNames = new Set(applied.map((row) => row.name));
  const pending = sorted.filter((file) => !appliedNames.has(file.name));

  // Both are in name order, so only the first pending file can predate the last applied one.
  const lastApplied = sorted.findLast((file) => appliedNames.has(file.name));
  const firstPending = pending[0];
  if (lastApplied && firstPending && firstPending.name < lastApplied.name) {
    throw new MigrationError(
      `${firstPending.name} is older than the last applied migration, ${lastApplied.name}; renumber it after ${lastApplied.name}`,
    );
  }

  return pending;
}
