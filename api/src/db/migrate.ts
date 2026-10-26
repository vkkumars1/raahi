import fs from "node:fs";
import path from "node:path";
import { pool } from "./pool";

/** Minimal forward-only migration runner: applies migrations/*.sql once, in filename order. */
export async function migrate(dir = path.join(process.cwd(), "migrations")) {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const client = await pool.connect();
    try {
      // advisory lock so two booting instances never run the same migration together
      await client.query("SELECT pg_advisory_lock(727272)");
      const done = await client.query("SELECT 1 FROM schema_migrations WHERE name=$1", [file]);
      if (done.rowCount) continue;
      await client.query("BEGIN");
      await client.query(fs.readFileSync(path.join(dir, file), "utf8"));
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`migrated ${file}`);
    } catch (e) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw e;
    } finally {
      await client.query("SELECT pg_advisory_unlock(727272)").catch(() => undefined);
      client.release();
    }
  }
}

if (require.main === module) {
  migrate()
    .then(() => pool.end())
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
