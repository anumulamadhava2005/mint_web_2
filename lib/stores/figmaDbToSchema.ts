// ═══════════════════════════════════════════════════════════════
// figmaStore.database → runtime DatabaseConfigSchema converter
//
// The Dev-tab Database Studio edits the schema living in figmaStore
// (so it rides the Figma file autosave). The real deploy endpoint
// (/api/db/migrate/[projectId]) and the SQL generator
// (lib/runtime/database.ts) both speak the runtime schema model, so
// we convert at deploy / preview time.
// ═══════════════════════════════════════════════════════════════

import type { DatabaseConfig, DbTable, DbField } from "./figmaStore";
import type {
  DatabaseConfigSchema,
  TableSchema,
  FieldSchema,
  FieldType,
  RelationSchema,
  IndexSchema,
  PolicySchema,
} from "@/lib/runtime/schema";

function fieldToSchema(f: DbField): FieldSchema {
  const enumValues = f.enumValues
    ? f.enumValues.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  return {
    name: f.name,
    type: f.type as FieldType,
    // A field is required when it is explicitly non-nullable (or a primary key).
    required: f.nullable === false || f.primary === true,
    unique: f.unique === true,
    ...(f.defaultValue !== undefined && f.defaultValue !== ""
      ? { default: f.defaultValue }
      : {}),
    ...(enumValues && enumValues.length ? { enumValues } : {}),
  };
}

function tableToSchema(t: DbTable): TableSchema {
  const relations: RelationSchema[] = (t.relations ?? []).map((r) => ({
    type: r.type,
    targetTable: r.targetTable,
    foreignKey: r.foreignKey,
    targetKey: r.targetKey,
    junctionTable: r.junctionTable,
    onDelete: r.onDelete,
  }));

  const indexes: IndexSchema[] = (t.indexes ?? []).map((i) => ({
    name: i.name,
    fields: i.fields,
    unique: i.unique,
    type: i.type,
  }));

  const policies: PolicySchema[] = (t.policies ?? []).map((p) => ({
    name: p.name,
    operation: p.operation,
    role: p.role,
    condition: p.condition,
    check: p.check,
  }));

  return {
    id: t.id,
    name: t.name,
    fields: (t.fields ?? []).map(fieldToSchema),
    relations,
    indexes,
    policies,
    timestamps: t.timestamps,
    softDelete: t.softDelete,
  };
}

export function dbConfigToRuntimeSchema(db: DatabaseConfig): DatabaseConfigSchema {
  return {
    provider: db.provider,
    connectionUrl: db.connectionString,
    tables: (db.tables ?? []).map(tableToSchema),
  };
}
