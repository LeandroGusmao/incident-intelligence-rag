import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { env } from "../../src/infra/config/env.ts";
import { MigrationError } from "../../src/infra/database/migration-plan.ts";
import { migrate } from "../../src/infra/database/migrator.ts";

// A schema of its own: `public` already holds the real migrations, which the
// fixture directories here don't have, so every run would be refused.
const SCHEMA = "migrator_test";

const CREATE_WIDGETS = "0001_create_widgets.sql";
const ADD_WIDGET_NAME = "0002_add_widget_name.sql";
const DIVIDE_BY_ZERO = "0002_divide_by_zero.sql";
const DIVISION_BY_ZERO_CODE = "22012";

let pool: Pool;
let dir: string;

beforeAll(() => {
  pool = new Pool({
    connectionString: env.DATABASE_URL,
    options: `-c search_path=${SCHEMA}`,
  });
});

afterAll(async () => {
  await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  await pool.end();
});

beforeEach(async () => {
  await pool.query(
    `DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE; CREATE SCHEMA ${SCHEMA}`,
  );
  dir = await mkdtemp(join(tmpdir(), "migrations-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function writeMigrations(files: Record<string, string>): Promise<void> {
  for (const [name, sql] of Object.entries(files)) {
    await writeFile(join(dir, name), sql);
  }
}

async function appliedNames(): Promise<string[]> {
  const { rows } = await pool.query<{ name: string }>(
    "SELECT name FROM schema_migrations ORDER BY name",
  );
  return rows.map((row) => row.name);
}

async function tableExists(name: string): Promise<boolean> {
  const { rows } = await pool.query<{ exists: boolean }>(
    "SELECT to_regclass($1) IS NOT NULL AS exists",
    [`${SCHEMA}.${name}`],
  );
  return rows[0]?.exists === true;
}

describe("migrate", () => {
  it("applies pending files in name order and records their checksums", async () => {
    const createWidgets = "CREATE TABLE widgets (id int PRIMARY KEY);";
    const addWidgetName = "ALTER TABLE widgets ADD COLUMN name text;";
    await writeMigrations({
      [ADD_WIDGET_NAME]: addWidgetName,
      [CREATE_WIDGETS]: createWidgets,
    });

    await expect(migrate(pool, dir)).resolves.toEqual([
      CREATE_WIDGETS,
      ADD_WIDGET_NAME,
    ]);

    // Pinned: a different hash would make every database refuse the migrations it already applied.
    const sha256 = (sql: string) =>
      createHash("sha256").update(sql).digest("hex");
    const { rows } = await pool.query(
      "SELECT name, checksum FROM schema_migrations ORDER BY name",
    );
    expect(rows).toEqual([
      { name: CREATE_WIDGETS, checksum: sha256(createWidgets) },
      { name: ADD_WIDGET_NAME, checksum: sha256(addWidgetName) },
    ]);
  });

  it("applies only what is new on later runs", async () => {
    await writeMigrations({
      [CREATE_WIDGETS]: "CREATE TABLE widgets (id int PRIMARY KEY);",
    });
    await migrate(pool, dir);

    await expect(migrate(pool, dir)).resolves.toEqual([]);

    await writeMigrations({
      [ADD_WIDGET_NAME]: "ALTER TABLE widgets ADD COLUMN name text;",
    });
    await expect(migrate(pool, dir)).resolves.toEqual([ADD_WIDGET_NAME]);
  });

  it("rolls back the whole run when a file fails", async () => {
    await writeMigrations({
      [CREATE_WIDGETS]: "CREATE TABLE widgets (id int PRIMARY KEY);",
      [DIVIDE_BY_ZERO]: "SELECT 1 / 0;",
    });

    const run = migrate(pool, dir);

    await expect(run).rejects.toBeInstanceOf(MigrationError);
    await expect(run).rejects.toMatchObject({
      message: expect.stringContaining(`${DIVIDE_BY_ZERO} failed`),
      cause: { code: DIVISION_BY_ZERO_CODE },
    });
    expect(await tableExists("widgets")).toBe(false);
    expect(await tableExists("schema_migrations")).toBe(false);
  });

  it("refuses to run when an applied file was edited", async () => {
    await writeMigrations({
      [CREATE_WIDGETS]: "CREATE TABLE widgets (id int PRIMARY KEY);",
    });
    await migrate(pool, dir);
    await writeMigrations({
      [CREATE_WIDGETS]:
        "-- a comment is an edit too\nCREATE TABLE widgets (id int PRIMARY KEY);",
      [ADD_WIDGET_NAME]: "ALTER TABLE widgets ADD COLUMN name text;",
    });

    const run = migrate(pool, dir);

    await expect(run).rejects.toBeInstanceOf(MigrationError);
    await expect(run).rejects.toThrow(`${CREATE_WIDGETS} was changed`);
    expect(await appliedNames()).toEqual([CREATE_WIDGETS]);
  });

  it("lets only one of two concurrent runs apply a migration", async () => {
    // The sleep holds the first run's transaction open until the second one arrives.
    await writeMigrations({
      [CREATE_WIDGETS]:
        "CREATE TABLE widgets (id int PRIMARY KEY); SELECT pg_sleep(0.2);",
    });

    const results = await Promise.all([migrate(pool, dir), migrate(pool, dir)]);

    expect(results.flat()).toEqual([CREATE_WIDGETS]);
    expect(await appliedNames()).toEqual([CREATE_WIDGETS]);
  });
});
