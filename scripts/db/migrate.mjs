import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const migrationsDir = path.join(repoRoot, "infra", "migrations");
const databaseUrl = process.env.AICHESTRA_DATABASE_URL ?? process.env.DATABASE_URL;
const psqlBin = process.env.AICHESTRA_PSQL_BIN ?? "psql";

if (!databaseUrl) {
  console.error("AICHESTRA_DATABASE_URL or DATABASE_URL is required to run migrations.");
  process.exitCode = 1;
  process.exit();
}

const migrations = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

if (migrations.length === 0) {
  console.log("No SQL migrations found.");
  process.exit();
}

for (const migration of migrations) {
  const migrationPath = path.join(migrationsDir, migration);
  const sql = readFileSync(migrationPath, "utf8");
  console.log(`Running migration: ${migration}`);
  const result = spawnSync(
    psqlBin,
    ["-X", "-v", "ON_ERROR_STOP=1", databaseUrl, "-f", migrationPath],
    {
      encoding: "utf8",
      windowsHide: true
    }
  );

  if (result.error) {
    console.error(`Migration failed: ${result.error.message}`);
    process.exitCode = 1;
    process.exit();
  }

  if (result.status !== 0) {
    console.error(result.stderr || result.stdout || `Migration exited with status ${result.status}`);
    process.exitCode = result.status ?? 1;
    process.exit();
  }

  if (sql.trim().length === 0) {
    console.log(`Migration ${migration} was empty.`);
  }
}

console.log("Migrations completed.");
