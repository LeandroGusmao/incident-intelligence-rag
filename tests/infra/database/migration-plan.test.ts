import { describe, expect, it } from "@jest/globals";
import {
  MigrationError,
  planMigrations,
} from "../../../src/infra/database/migration-plan.ts";

function migration(name: string, checksum = `sha-${name}`) {
  return { name, checksum };
}

function pendingNames(...args: Parameters<typeof planMigrations>) {
  return planMigrations(...args).map((file) => file.name);
}

describe("planMigrations", () => {
  it("returns nothing for an empty directory", () => {
    expect(pendingNames([], [])).toEqual([]);
  });

  it("returns every file in name order when nothing has been applied", () => {
    const files = [
      migration("0010_add_index.sql"),
      migration("0001_enable_pgvector.sql"),
      migration("0009_add_column.sql"),
    ];

    expect(pendingNames(files, [])).toEqual([
      "0001_enable_pgvector.sql",
      "0009_add_column.sql",
      "0010_add_index.sql",
    ]);
  });

  it("returns only the files after the ones already applied", () => {
    const files = [
      migration("0001_enable_pgvector.sql"),
      migration("0002_create_sources.sql"),
      migration("0003_create_chunks.sql"),
    ];
    const applied = [migration("0001_enable_pgvector.sql")];

    expect(pendingNames(files, applied)).toEqual([
      "0002_create_sources.sql",
      "0003_create_chunks.sql",
    ]);
  });

  it("returns nothing when every file has been applied", () => {
    const files = [
      migration("0001_enable_pgvector.sql"),
      migration("0002_create_sources.sql"),
    ];

    expect(pendingNames(files, files)).toEqual([]);
  });

  it("hands back the file objects it was given, so callers keep their SQL", () => {
    const file = { ...migration("0001_enable_pgvector.sql"), sql: "SELECT 1;" };

    expect(planMigrations([file], [])).toEqual([file]);
  });

  it.each([
    ["no zero padding", "2_create_sources.sql"],
    ["five digits", "00002_create_sources.sql"],
    ["a hyphen", "0002-create-sources.sql"],
    ["uppercase", "0002_Create_Sources.sql"],
    ["no description", "0002_.sql"],
  ])("rejects a file name with %s", (_label, name) => {
    const files = [migration("0001_enable_pgvector.sql"), migration(name)];

    expect(() => planMigrations(files, [])).toThrow(MigrationError);
    expect(() => planMigrations(files, [])).toThrow(
      new RegExp(`invalid migration file name.*${name}`),
    );
  });

  it("rejects two files with the same number", () => {
    const files = [
      migration("0002_create_sources.sql"),
      migration("0002_create_links.sql"),
    ];

    expect(() => planMigrations(files, [])).toThrow(MigrationError);
    expect(() => planMigrations(files, [])).toThrow(
      /duplicate migration number 0002.*0002_create_links\.sql.*0002_create_sources\.sql/,
    );
  });

  it("rejects an applied migration whose file is gone", () => {
    const files = [migration("0002_create_sources.sql")];
    const applied = [
      migration("0001_enable_pgvector.sql"),
      migration("0002_create_sources.sql"),
    ];

    expect(() => planMigrations(files, applied)).toThrow(MigrationError);
    expect(() => planMigrations(files, applied)).toThrow(
      /0001_enable_pgvector\.sql was applied but is missing/,
    );
  });

  it("rejects an applied migration whose content changed", () => {
    const files = [migration("0001_enable_pgvector.sql", "sha-edited")];
    const applied = [migration("0001_enable_pgvector.sql", "sha-original")];

    expect(() => planMigrations(files, applied)).toThrow(MigrationError);
    expect(() => planMigrations(files, applied)).toThrow(
      /0001_enable_pgvector\.sql was changed after it was applied/,
    );
  });

  it("rejects a pending migration older than the last applied one", () => {
    const files = [
      migration("0001_enable_pgvector.sql"),
      migration("0002_create_sources.sql"),
      migration("0003_create_chunks.sql"),
    ];
    const applied = [
      migration("0001_enable_pgvector.sql"),
      migration("0003_create_chunks.sql"),
    ];

    expect(() => planMigrations(files, applied)).toThrow(MigrationError);
    expect(() => planMigrations(files, applied)).toThrow(
      /0002_create_sources\.sql is older than the last applied migration, 0003_create_chunks\.sql/,
    );
  });
});
