import { Client } from "pg";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import { buildReactNativeFromSchema } from "../lib/convert/builders/reactNativeSchema";

async function main() {
  const PID = process.argv[2];
  const OUT = process.argv[3];
  if (!PID || !OUT) { console.error("usage: run_rn_export.ts <projectId> <outDir>"); process.exit(1); }

  const c = new Client({ host: "localhost", port: 5432, user: "postgres", password: "9989882989@m", database: "mint_web" });
  await c.connect();
  const r = await c.query(
    "SELECT config_json->'designData'->'runtimeSchema' AS rs FROM project_commits WHERE project_id=$1 ORDER BY version DESC LIMIT 1",
    [PID]
  );
  await c.end();
  const schema = r.rows[0].rs;

  const files = buildReactNativeFromSchema(schema, { projectId: PID, apiOrigin: "https://mintweb.mintit.pro", appName: schema.name });

  for (const f of files) {
    const fp = path.join(OUT, f.path);
    mkdirSync(path.dirname(fp), { recursive: true });
    writeFileSync(fp, f.content);
  }
  console.log("WROTE", files.length, "files to", OUT);
  console.log(files.map((f) => "  " + f.path).join("\n"));
}
main().catch((e) => { console.error(e); process.exit(1); });
