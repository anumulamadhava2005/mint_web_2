// ═══════════════════════════════════════════════════════════════
// Database Schema Engine — SQL migration generator & query builder
//
// Converts visual TableSchema definitions into:
//   1. SQL CREATE/ALTER migrations
//   2. CRUD query builders
//   3. Managed database client for mintit.pro
// ═══════════════════════════════════════════════════════════════

import type {
  DatabaseConfigSchema,
  TableSchema,
  FieldSchema,
  FieldType,
  RelationSchema,
  PolicySchema,
} from "./schema";

// ── SQL Type Mapping ─────────────────────────────────────────

const FIELD_TYPE_MAP: Record<FieldType, string> = {
  uuid: "UUID",
  text: "TEXT",
  integer: "INTEGER",
  float: "DOUBLE PRECISION",
  boolean: "BOOLEAN",
  date: "DATE",
  datetime: "TIMESTAMP",
  timestamp: "TIMESTAMPTZ",
  json: "JSON",
  jsonb: "JSONB",
  enum: "TEXT", // enforced via CHECK constraint
  array: "TEXT[]",
  binary: "BYTEA",
};

// ── Migration Generator ──────────────────────────────────────

export interface Migration {
  id: string;
  name: string;
  upSQL: string;
  downSQL: string;
  createdAt: number;
}

export function generateMigrations(schema: DatabaseConfigSchema): Migration[] {
  const migrations: Migration[] = [];
  const timestamp = Date.now();

  for (const table of schema.tables) {
    const up = generateCreateTable(table);
    const down = `DROP TABLE IF EXISTS "${table.name}" CASCADE;`;

    migrations.push({
      id: `${timestamp}_create_${table.name}`,
      name: `Create ${table.name}`,
      upSQL: up,
      downSQL: down,
      createdAt: timestamp,
    });
  }

  // Generate junction tables for many-to-many
  for (const table of schema.tables) {
    for (const rel of table.relations) {
      if (rel.type === "many-to-many" && rel.junctionTable) {
        const jt = generateJunctionTable(table.name, rel);
        migrations.push({
          id: `${timestamp}_junction_${rel.junctionTable}`,
          name: `Create junction ${rel.junctionTable}`,
          upSQL: jt.up,
          downSQL: jt.down,
          createdAt: timestamp,
        });
      }
    }
  }

  return migrations;
}

// ── Idempotent schema sync ───────────────────────────────────
// Unlike generateMigrations (create-only), this emits statements that
// converge an existing table to the desired schema on every deploy:
//   • CREATE TABLE IF NOT EXISTS (id only) — safe whether or not it exists
//   • ALTER TABLE ADD COLUMN IF NOT EXISTS for every column (adds new ones)
//   • CREATE INDEX IF NOT EXISTS
//   • DROP/CREATE for policies + enum CHECKs so edits round-trip
//   • FK columns + constraints guarded by existence checks
// It is intentionally ADDITIVE: it never drops columns/tables or alters
// column types (those are destructive and left to manual migration).

export interface SyncStatement { sql: string; label: string }

export function generateSyncStatements(
  schema: DatabaseConfigSchema,
  existingTables: Set<string>,
): SyncStatement[] {
  const pass1: SyncStatement[] = []; // tables, columns, indexes, checks
  const pass2: SyncStatement[] = []; // FKs, junctions, RLS, triggers (need targets to exist)

  for (const table of schema.tables) {
    const isNew = !existingTables.has(table.name);

    pass1.push({
      label: `table ${table.name}`,
      sql: `CREATE TABLE IF NOT EXISTS "${table.name}" ("id" UUID PRIMARY KEY DEFAULT gen_random_uuid());`,
    });

    for (const field of table.fields) {
      if (field.name === "id") continue;
      pass1.push({
        label: `column ${table.name}.${field.name}`,
        sql: `ALTER TABLE "${table.name}" ADD COLUMN IF NOT EXISTS ${syncColumn(field, isNew)};`,
      });
    }

    if (table.timestamps !== false) {
      if (!table.fields.some((f) => f.name === "created_at"))
        pass1.push({ label: `column ${table.name}.created_at`, sql: `ALTER TABLE "${table.name}" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT now();` });
      if (!table.fields.some((f) => f.name === "updated_at"))
        pass1.push({ label: `column ${table.name}.updated_at`, sql: `ALTER TABLE "${table.name}" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now();` });
    }
    if (table.softDelete && !table.fields.some((f) => f.name === "deleted_at")) {
      pass1.push({ label: `column ${table.name}.deleted_at`, sql: `ALTER TABLE "${table.name}" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ DEFAULT NULL;` });
    }

    for (const idx of table.indexes) {
      const type = idx.type ? ` USING ${idx.type}` : "";
      const unique = idx.unique ? "UNIQUE " : "";
      const cols = idx.fields.map((f) => `"${f}"`).join(", ");
      pass1.push({ label: `index ${idx.name}`, sql: `CREATE ${unique}INDEX IF NOT EXISTS "${idx.name}" ON "${table.name}"${type} (${cols});` });
    }

    for (const field of table.fields) {
      if (field.type === "enum" && field.enumValues?.length) {
        const cn = `chk_${table.name}_${field.name}`;
        const vals = field.enumValues.map((v) => `'${v}'`).join(", ");
        pass1.push({
          label: `check ${cn}`,
          sql: `ALTER TABLE "${table.name}" DROP CONSTRAINT IF EXISTS "${cn}"; ALTER TABLE "${table.name}" ADD CONSTRAINT "${cn}" CHECK ("${field.name}" IN (${vals}));`,
        });
      }
    }

    for (const rel of table.relations) {
      if (rel.type !== "many-to-many") {
        const onDel = (rel.onDelete || "cascade").toUpperCase().replace("-", " ");
        // Postgres truncates identifiers to 63 bytes; pre-truncate so the
        // existence check below matches the name actually stored.
        const fkName = `fk_${table.name}_${rel.foreignKey}`.slice(0, 63);
        pass2.push({
          label: `fk ${table.name}.${rel.foreignKey}`,
          sql:
            `ALTER TABLE "${table.name}" ADD COLUMN IF NOT EXISTS "${rel.foreignKey}" UUID; ` +
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${fkName}') THEN ` +
            `ALTER TABLE "${table.name}" ADD CONSTRAINT "${fkName}" FOREIGN KEY ("${rel.foreignKey}") ` +
            `REFERENCES "${rel.targetTable}"("${rel.targetKey || "id"}") ON DELETE ${onDel}; END IF; END $$;`,
        });
      } else if (rel.junctionTable) {
        pass2.push({
          label: `junction ${rel.junctionTable}`,
          sql: `CREATE TABLE IF NOT EXISTS "${rel.junctionTable}" (` +
            `"${table.name}_id" UUID NOT NULL REFERENCES "${table.name}"("id") ON DELETE CASCADE, ` +
            `"${rel.targetTable}_id" UUID NOT NULL REFERENCES "${rel.targetTable}"("${rel.targetKey || "id"}") ON DELETE CASCADE, ` +
            `"created_at" TIMESTAMPTZ DEFAULT now(), PRIMARY KEY ("${table.name}_id", "${rel.targetTable}_id"));`,
        });
      }
    }

    if (table.policies.length > 0) {
      pass2.push({ label: `rls ${table.name}`, sql: `ALTER TABLE "${table.name}" ENABLE ROW LEVEL SECURITY;` });
      for (const policy of table.policies) {
        pass2.push({
          label: `policy ${policy.name}`,
          sql: `DROP POLICY IF EXISTS "${policy.name}" ON "${table.name}"; ${generatePolicy(table.name, policy)}`,
        });
      }
    }

    if (table.timestamps !== false) {
      pass2.push({
        label: `trigger ${table.name}`,
        sql: `CREATE OR REPLACE FUNCTION update_${table.name}_modified_at() RETURNS TRIGGER AS $$ BEGIN NEW."updated_at" = now(); RETURN NEW; END; $$ LANGUAGE plpgsql; ` +
          `DROP TRIGGER IF EXISTS "trg_${table.name}_updated_at" ON "${table.name}"; ` +
          `CREATE TRIGGER "trg_${table.name}_updated_at" BEFORE UPDATE ON "${table.name}" FOR EACH ROW EXECUTE FUNCTION update_${table.name}_modified_at();`,
      });
    }
  }

  return [...pass1, ...pass2];
}

// Prefix every table/relation/index/policy name for per-project isolation
// (mint_proj_<projectId>_<name>). Shared by the migrate + rollback routes.
export function prefixSchemaTables(schema: DatabaseConfigSchema, projectId: string): DatabaseConfigSchema {
  const prefix = `mint_proj_${projectId.replace(/[^a-zA-Z0-9_]/g, "")}_`;
  return {
    ...schema,
    tables: schema.tables.map((t) => ({
      ...t,
      name: `${prefix}${t.name}`,
      relations: (t.relations || []).map((r) => ({
        ...r,
        targetTable: `${prefix}${r.targetTable}`,
        junctionTable: r.junctionTable ? `${prefix}${r.junctionTable}` : undefined,
      })),
      indexes: (t.indexes || []).map((idx) => ({ ...idx, name: `${prefix}${idx.name}` })),
      policies: (t.policies || []).map((p) => ({ ...p, name: `${prefix}${p.name}` })),
    })),
  };
}

// The "down" side of a rollback: drop what the current schema has but the
// target does not. Operates on prefixed schemas. Destructive by design —
// only ever invoked by an explicit rollback, never by a normal deploy.
// Conservatively scoped to dropped tables, user columns, policies, indexes,
// and junction tables (system columns like created_at are left in place).
export function generateDropStatements(
  current: DatabaseConfigSchema,
  target: DatabaseConfigSchema,
): SyncStatement[] {
  const out: SyncStatement[] = [];
  const targetTables = new Map(target.tables.map((t) => [t.name, t]));

  const junctionsOf = (schema: DatabaseConfigSchema) => {
    const s = new Set<string>();
    for (const t of schema.tables)
      for (const r of t.relations)
        if (r.type === "many-to-many" && r.junctionTable) s.add(r.junctionTable);
    return s;
  };
  const targetJunctions = junctionsOf(target);

  for (const cur of current.tables) {
    const tgt = targetTables.get(cur.name);
    if (!tgt) {
      out.push({ label: `drop table ${cur.name}`, sql: `DROP TABLE IF EXISTS "${cur.name}" CASCADE;` });
      continue;
    }
    const targetCols = new Set(tgt.fields.map((f) => f.name));
    for (const f of cur.fields) {
      if (f.name === "id") continue;
      if (!targetCols.has(f.name))
        out.push({ label: `drop column ${cur.name}.${f.name}`, sql: `ALTER TABLE "${cur.name}" DROP COLUMN IF EXISTS "${f.name}" CASCADE;` });
    }
    const targetPolicies = new Set(tgt.policies.map((p) => p.name));
    for (const p of cur.policies) {
      if (!targetPolicies.has(p.name))
        out.push({ label: `drop policy ${p.name}`, sql: `DROP POLICY IF EXISTS "${p.name}" ON "${cur.name}";` });
    }
    const targetIdx = new Set(tgt.indexes.map((i) => i.name));
    for (const i of cur.indexes) {
      if (!targetIdx.has(i.name))
        out.push({ label: `drop index ${i.name}`, sql: `DROP INDEX IF EXISTS "${i.name}";` });
    }
  }

  for (const jt of junctionsOf(current)) {
    if (!targetJunctions.has(jt))
      out.push({ label: `drop junction ${jt}`, sql: `DROP TABLE IF EXISTS "${jt}" CASCADE;` });
  }

  return out;
}

function syncColumn(field: FieldSchema, tableIsNew: boolean): string {
  let col = `"${field.name}" ${FIELD_TYPE_MAP[field.type] || "TEXT"}`;
  // Only enforce NOT NULL when safe: a default exists, or the table is brand
  // new (no existing rows that would violate it).
  if (field.required && (field.default !== undefined || tableIsNew)) col += " NOT NULL";
  if (field.unique) col += " UNIQUE";
  if (field.default !== undefined) {
    if (typeof field.default === "string") col += ` DEFAULT '${field.default}'`;
    else if (typeof field.default === "boolean") col += ` DEFAULT ${field.default}`;
    else if (typeof field.default === "number") col += ` DEFAULT ${field.default}`;
    else if (field.default === null) col += " DEFAULT NULL";
    else col += ` DEFAULT '${JSON.stringify(field.default)}'`;
  }
  return col;
}

function generateCreateTable(table: TableSchema): string {
  const lines: string[] = [];

  // Primary key
  lines.push(`  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid()`);

  // Fields
  for (const field of table.fields) {
    if (field.name === "id") continue;
    lines.push(`  ${generateColumn(field)}`);
  }

  // Timestamps
  if (table.timestamps !== false) {
    const hasCreatedAt = table.fields.some((f) => f.name === "created_at");
    const hasUpdatedAt = table.fields.some((f) => f.name === "updated_at");
    if (!hasCreatedAt) {
      lines.push(`  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()`);
    }
    if (!hasUpdatedAt) {
      lines.push(`  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()`);
    }
  }

  // Soft delete
  if (table.softDelete) {
    const hasDeletedAt = table.fields.some((f) => f.name === "deleted_at");
    if (!hasDeletedAt) {
      lines.push(`  "deleted_at" TIMESTAMPTZ DEFAULT NULL`);
    }
  }

  // Foreign keys from relations
  for (const rel of table.relations) {
    if (rel.type !== "many-to-many") {
      const onDel = (rel.onDelete || "cascade").toUpperCase().replace("-", " ");
      lines.push(
        `  "${rel.foreignKey}" UUID REFERENCES "${rel.targetTable}"("${rel.targetKey || "id"}") ON DELETE ${onDel}`
      );
    }
  }

  let sql = `CREATE TABLE IF NOT EXISTS "${table.name}" (\n${lines.join(",\n")}\n);\n`;

  // Indexes
  for (const idx of table.indexes) {
    const type = idx.type ? ` USING ${idx.type}` : "";
    const unique = idx.unique ? "UNIQUE " : "";
    const cols = idx.fields.map((f) => `"${f}"`).join(", ");
    sql += `\nCREATE ${unique}INDEX IF NOT EXISTS "${idx.name}" ON "${table.name}"${type} (${cols});`;
  }

  // Enum CHECK constraints
  for (const field of table.fields) {
    if (field.type === "enum" && field.enumValues?.length) {
      const vals = field.enumValues.map((v) => `'${v}'`).join(", ");
      sql += `\nALTER TABLE "${table.name}" ADD CONSTRAINT "chk_${table.name}_${field.name}" CHECK ("${field.name}" IN (${vals}));`;
    }
  }

  // RLS policies
  if (table.policies.length > 0) {
    sql += `\nALTER TABLE "${table.name}" ENABLE ROW LEVEL SECURITY;`;
    for (const policy of table.policies) {
      sql += `\n${generatePolicy(table.name, policy)}`;
    }
  }

  // Auto-update trigger for updated_at
  if (table.timestamps !== false) {
    sql += `\n\nCREATE OR REPLACE FUNCTION update_${table.name}_modified_at()
RETURNS TRIGGER AS $$
BEGIN NEW."updated_at" = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_${table.name}_updated_at" ON "${table.name}";
CREATE TRIGGER "trg_${table.name}_updated_at"
BEFORE UPDATE ON "${table.name}"
FOR EACH ROW EXECUTE FUNCTION update_${table.name}_modified_at();`;
  }

  return sql;
}

function generateColumn(field: FieldSchema): string {
  let col = `"${field.name}" ${FIELD_TYPE_MAP[field.type] || "TEXT"}`;
  if (field.required) col += " NOT NULL";
  if (field.unique) col += " UNIQUE";
  if (field.default !== undefined) {
    if (typeof field.default === "string") col += ` DEFAULT '${field.default}'`;
    else if (typeof field.default === "boolean") col += ` DEFAULT ${field.default}`;
    else if (typeof field.default === "number") col += ` DEFAULT ${field.default}`;
    else if (field.default === null) col += " DEFAULT NULL";
    else col += ` DEFAULT '${JSON.stringify(field.default)}'`;
  }
  return col;
}

function generateJunctionTable(
  sourceTable: string,
  rel: RelationSchema
): { up: string; down: string } {
  const jt = rel.junctionTable!;
  return {
    up: `CREATE TABLE IF NOT EXISTS "${jt}" (
  "${sourceTable}_id" UUID NOT NULL REFERENCES "${sourceTable}"("id") ON DELETE CASCADE,
  "${rel.targetTable}_id" UUID NOT NULL REFERENCES "${rel.targetTable}"("${rel.targetKey || "id"}") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY ("${sourceTable}_id", "${rel.targetTable}_id")
);`,
    down: `DROP TABLE IF EXISTS "${jt}" CASCADE;`,
  };
}

function generatePolicy(tableName: string, policy: PolicySchema): string {
  const op = policy.operation === "all"
    ? "ALL"
    : policy.operation.toUpperCase();
  let sql = `CREATE POLICY "${policy.name}" ON "${tableName}" FOR ${op}`;
  if (policy.role) sql += ` TO "${policy.role}"`;
  if (policy.condition) sql += ` USING (${policy.condition})`;
  if (policy.check) sql += ` WITH CHECK (${policy.check})`;
  return sql + ";";
}

// ── CRUD Query Builder ───────────────────────────────────────

export class QueryBuilder {
  private table: string;
  private tableSchema: TableSchema;

  constructor(table: string, schema: TableSchema) {
    this.table = table;
    this.tableSchema = schema;
  }

  select(options?: {
    fields?: string[];
    where?: Record<string, unknown>;
    orderBy?: string;
    order?: "ASC" | "DESC";
    limit?: number;
    offset?: number;
    includeDeleted?: boolean;
  }): { sql: string; params: unknown[] } {
    const cols = options?.fields?.map((f) => `"${f}"`).join(", ") || "*";
    const params: unknown[] = [];
    const wheres: string[] = [];

    if (this.tableSchema.softDelete && !options?.includeDeleted) {
      wheres.push(`"deleted_at" IS NULL`);
    }

    if (options?.where) {
      for (const [key, value] of Object.entries(options.where)) {
        params.push(value);
        wheres.push(`"${key}" = $${params.length}`);
      }
    }

    let sql = `SELECT ${cols} FROM "${this.table}"`;
    if (wheres.length) sql += ` WHERE ${wheres.join(" AND ")}`;
    if (options?.orderBy) sql += ` ORDER BY "${options.orderBy}" ${options?.order || "ASC"}`;
    if (options?.limit) { params.push(options.limit); sql += ` LIMIT $${params.length}`; }
    if (options?.offset) { params.push(options.offset); sql += ` OFFSET $${params.length}`; }

    return { sql, params };
  }

  selectOne(id: string): { sql: string; params: unknown[] } {
    return {
      sql: `SELECT * FROM "${this.table}" WHERE "id" = $1${this.tableSchema.softDelete ? ' AND "deleted_at" IS NULL' : ""}`,
      params: [id],
    };
  }

  insert(data: Record<string, unknown>): { sql: string; params: unknown[] } {
    const keys = Object.keys(data).filter((k) => k !== "id");
    const params = keys.map((k) => data[k]);
    const cols = keys.map((k) => `"${k}"`).join(", ");
    const vals = keys.map((_, i) => `$${i + 1}`).join(", ");

    return {
      sql: `INSERT INTO "${this.table}" (${cols}) VALUES (${vals}) RETURNING *`,
      params,
    };
  }

  update(id: string, data: Record<string, unknown>): { sql: string; params: unknown[] } {
    const keys = Object.keys(data).filter((k) => k !== "id");
    const params: unknown[] = [id];
    const sets = keys.map((k) => { params.push(data[k]); return `"${k}" = $${params.length}`; });

    return {
      sql: `UPDATE "${this.table}" SET ${sets.join(", ")} WHERE "id" = $1 RETURNING *`,
      params,
    };
  }

  delete(id: string): { sql: string; params: unknown[] } {
    if (this.tableSchema.softDelete) {
      return {
        sql: `UPDATE "${this.table}" SET "deleted_at" = now() WHERE "id" = $1 RETURNING *`,
        params: [id],
      };
    }
    return {
      sql: `DELETE FROM "${this.table}" WHERE "id" = $1 RETURNING *`,
      params: [id],
    };
  }

  count(where?: Record<string, unknown>): { sql: string; params: unknown[] } {
    const params: unknown[] = [];
    const wheres: string[] = [];
    if (this.tableSchema.softDelete) wheres.push(`"deleted_at" IS NULL`);
    if (where) {
      for (const [key, value] of Object.entries(where)) {
        params.push(value);
        wheres.push(`"${key}" = $${params.length}`);
      }
    }
    let sql = `SELECT COUNT(*) as count FROM "${this.table}"`;
    if (wheres.length) sql += ` WHERE ${wheres.join(" AND ")}`;
    return { sql, params };
  }
}

// ── Managed Database Client ──────────────────────────────────
// Connects exported apps to their project's database on mintit.pro

export class MintDatabaseClient {
  private baseUrl: string;
  private apiKey: string;
  private queryBuilders = new Map<string, QueryBuilder>();

  constructor(config: {
    projectId: string;
    userId: string;
    apiKey?: string;
    baseUrl?: string;
  }) {
    this.baseUrl =
      config.baseUrl || `https://${config.projectId}_${config.userId}.mintit.pro`;
    this.apiKey = config.apiKey || "";
  }

  /** Register table schemas for query building */
  registerTables(tables: TableSchema[]): void {
    for (const table of tables) {
      this.queryBuilders.set(table.name, new QueryBuilder(table.name, table));
    }
  }

  /** Get a typed query builder for a table */
  table(name: string): QueryBuilder {
    const qb = this.queryBuilders.get(name);
    if (!qb) throw new Error(`Table "${name}" not registered`);
    return qb;
  }

  /** Execute a raw query through the managed database */
  async query(sql: string, params: unknown[] = []): Promise<{ rows: Record<string, unknown>[]; rowCount: number }> {
    const response = await fetch(`${this.baseUrl}/api/db/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({ sql, params }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Database query failed: ${response.status} ${text}`);
    }

    return response.json();
  }

  /** Convenience: SELECT all from table */
  async findAll(tableName: string, options?: Parameters<QueryBuilder["select"]>[0]) {
    const qb = this.table(tableName);
    const { sql, params } = qb.select(options);
    return this.query(sql, params);
  }

  /** Convenience: SELECT one by ID */
  async findById(tableName: string, id: string) {
    const qb = this.table(tableName);
    const { sql, params } = qb.selectOne(id);
    const result = await this.query(sql, params);
    return result.rows[0] || null;
  }

  /** Convenience: INSERT */
  async create(tableName: string, data: Record<string, unknown>) {
    const qb = this.table(tableName);
    const { sql, params } = qb.insert(data);
    const result = await this.query(sql, params);
    return result.rows[0];
  }

  /** Convenience: UPDATE */
  async update(tableName: string, id: string, data: Record<string, unknown>) {
    const qb = this.table(tableName);
    const { sql, params } = qb.update(id, data);
    const result = await this.query(sql, params);
    return result.rows[0];
  }

  /** Convenience: DELETE / soft-delete */
  async remove(tableName: string, id: string) {
    const qb = this.table(tableName);
    const { sql, params } = qb.delete(id);
    const result = await this.query(sql, params);
    return result.rows[0];
  }

  /** Run migrations on the managed database */
  async migrate(schema: DatabaseConfigSchema): Promise<{ applied: string[]; errors: string[] }> {
    const migrations = generateMigrations(schema);
    const applied: string[] = [];
    const errors: string[] = [];

    // Ensure migrations tracking table
    await this.query(`
      CREATE TABLE IF NOT EXISTS "_mint_migrations" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "applied_at" TIMESTAMPTZ DEFAULT now()
      )
    `);

    const existing = await this.query(`SELECT "id" FROM "_mint_migrations"`);
    const appliedIds = new Set(existing.rows.map((r) => r.id as string));

    for (const migration of migrations) {
      if (appliedIds.has(migration.id)) continue;
      try {
        await this.query(migration.upSQL);
        await this.query(
          `INSERT INTO "_mint_migrations" ("id", "name") VALUES ($1, $2)`,
          [migration.id, migration.name]
        );
        applied.push(migration.id);
      } catch (e) {
        errors.push(`${migration.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return { applied, errors };
  }

  /** Rollback last migration */
  async rollback(): Promise<{ rolledBack: string | null; error?: string }> {
    try {
      const last = await this.query(
        `SELECT "id" FROM "_mint_migrations" ORDER BY "applied_at" DESC LIMIT 1`
      );
      if (!last.rows.length) return { rolledBack: null };
      // Note: actual down SQL would need to be stored; for now just remove tracking
      const id = last.rows[0].id as string;
      await this.query(`DELETE FROM "_mint_migrations" WHERE "id" = $1`, [id]);
      return { rolledBack: id };
    } catch (e) {
      return { rolledBack: null, error: e instanceof Error ? e.message : String(e) };
    }
  }
}

// ── Backend API Generator ────────────────────────────────────
// Generates REST API route code for exported projects

export function generateCRUDRoutes(tables: TableSchema[]): string {
  const routes: string[] = [];

  for (const table of tables) {
    const name = table.name;
    const route = name.toLowerCase().replace(/_/g, "-");

    routes.push(`
// ── ${name} CRUD ──────────────────────────────────
app.get("/api/${route}", async (req, res) => {
  try {
    const { limit = 50, offset = 0, orderBy = "created_at", order = "DESC", ...where } = req.query;
    const qb = db.table("${name}");
    const { sql, params } = qb.select({ where, orderBy, order, limit: Number(limit), offset: Number(offset) });
    const result = await db.query(sql, params);
    res.json({ data: result.rows, total: result.rowCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/${route}/:id", async (req, res) => {
  try {
    const qb = db.table("${name}");
    const { sql, params } = qb.selectOne(req.params.id);
    const result = await db.query(sql, params);
    if (!result.rows.length) return res.status(404).json({ error: "Not found" });
    res.json({ data: result.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/${route}", async (req, res) => {
  try {
    const qb = db.table("${name}");
    const { sql, params } = qb.insert(req.body);
    const result = await db.query(sql, params);
    res.status(201).json({ data: result.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/${route}/:id", async (req, res) => {
  try {
    const qb = db.table("${name}");
    const { sql, params } = qb.update(req.params.id, req.body);
    const result = await db.query(sql, params);
    res.json({ data: result.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/${route}/:id", async (req, res) => {
  try {
    const qb = db.table("${name}");
    const { sql, params } = qb.delete(req.params.id);
    const result = await db.query(sql, params);
    res.json({ data: result.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});`);
  }

  return routes.join("\n");
}
