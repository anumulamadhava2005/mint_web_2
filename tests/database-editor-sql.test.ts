// Unit tests for the genSQL function exported from DatabaseEditor.
// genSQL is a pure function: TableSchema[] → SQL string, no DOM needed.

import { describe, it, expect } from "vitest";
import { genSQL } from "@/components/studio/DatabaseEditor";
import type { TableSchema } from "@/lib/runtime/schema";

// ── fixtures ──────────────────────────────────────────────────────

const usersTable: TableSchema = {
  id: "tbl-users",
  name: "users",
  fields: [
    { name: "id", type: "uuid", required: true, unique: true },
    { name: "email", type: "text", required: true, unique: true },
    { name: "name", type: "text", required: true, unique: false },
    { name: "role", type: "text", required: false, unique: false },
  ],
  relations: [],
  indexes: [],
  policies: [],
};

const postsTable: TableSchema = {
  id: "tbl-posts",
  name: "posts",
  fields: [
    { name: "id", type: "uuid", required: true, unique: true },
    { name: "user_id", type: "uuid", required: true, unique: false },
    { name: "title", type: "text", required: true, unique: false },
    { name: "content", type: "text", required: false, unique: false },
  ],
  relations: [
    { type: "one-to-many", targetTable: "users", foreignKey: "user_id", targetKey: "id" },
  ],
  indexes: [],
  policies: [],
};

const categoriesTable: TableSchema = {
  id: "tbl-categories",
  name: "categories",
  fields: [
    { name: "id", type: "uuid", required: true, unique: true },
    { name: "slug", type: "text", required: true, unique: true },
  ],
  relations: [],
  indexes: [],
  policies: [],
};

const unknownTypeTable: TableSchema = {
  id: "tbl-misc",
  name: "misc",
  fields: [
    // Use a cast to simulate an unsupported type reaching the function
    { name: "data", type: "jsonb", required: false, unique: false },
    { name: "weird", type: "custom_type" as any, required: false, unique: false },
  ],
  relations: [],
  indexes: [],
  policies: [],
};

// ── tests ─────────────────────────────────────────────────────────

describe("genSQL", () => {
  it("generates CREATE TABLE IF NOT EXISTS with NOT NULL for required fields", () => {
    const sql = genSQL([usersTable]);
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS users");
    // required fields must carry NOT NULL
    expect(sql).toMatch(/email\s+TEXT\s+NOT NULL/);
    expect(sql).toMatch(/name\s+TEXT\s+NOT NULL/);
    // optional field must NOT carry NOT NULL
    expect(sql).not.toMatch(/role\s+TEXT\s+NOT NULL/);
  });

  it("generates UNIQUE constraint for unique fields (non-pk)", () => {
    const sql = genSQL([usersTable]);
    // email is required + unique (not the pk) → should have UNIQUE
    expect(sql).toMatch(/email\s+TEXT\s+NOT NULL\s+UNIQUE/);
    // 'id' is the pk field — PRIMARY KEY already implies unique, no extra UNIQUE
    expect(sql).not.toMatch(/id\s+UUID\s+PRIMARY KEY\s+.*UNIQUE/);
  });

  it("generates FOREIGN KEY for relations", () => {
    const sql = genSQL([postsTable]);
    expect(sql).toContain("FOREIGN KEY (user_id) REFERENCES users(id)");
  });

  it("produces multiple CREATE TABLE statements separated by a blank line for multiple tables", () => {
    const sql = genSQL([usersTable, postsTable]);
    // Two CREATE TABLE blocks
    const matches = sql.match(/CREATE TABLE IF NOT EXISTS/g);
    expect(matches).toHaveLength(2);
    // Separated by a blank line (two newlines between the closing ';' and the next CREATE)
    expect(sql).toContain(";\n\nCREATE TABLE");
  });

  it("falls back to TEXT for unknown field types", () => {
    const sql = genSQL([unknownTypeTable]);
    // 'data' is a known type (jsonb → JSONB), 'weird' is unknown → should be TEXT
    expect(sql).toContain("weird TEXT");
    // known type still maps correctly
    expect(sql).toContain("data JSONB");
  });

  it("maps all supported pg types correctly", () => {
    const typesTable: TableSchema = {
      id: "tbl-types",
      name: "type_check",
      fields: [
        { name: "a", type: "uuid", required: false, unique: false },
        { name: "b", type: "text", required: false, unique: false },
        { name: "c", type: "integer", required: false, unique: false },
        { name: "d", type: "float", required: false, unique: false },
        { name: "e", type: "boolean", required: false, unique: false },
        { name: "f", type: "timestamp", required: false, unique: false },
        { name: "g", type: "jsonb", required: false, unique: false },
      ],
      relations: [],
      indexes: [],
      policies: [],
    };
    const sql = genSQL([typesTable]);
    expect(sql).toContain("a UUID");
    expect(sql).toContain("b TEXT");
    expect(sql).toContain("c INTEGER");
    expect(sql).toContain("d FLOAT");
    expect(sql).toContain("e BOOLEAN");
    expect(sql).toContain("f TIMESTAMPTZ");
    expect(sql).toContain("g JSONB");
  });

  it("returns empty string for an empty table list", () => {
    const sql = genSQL([]);
    expect(sql).toBe("");
  });

  it("generates PRIMARY KEY on the id field", () => {
    const sql = genSQL([categoriesTable]);
    expect(sql).toMatch(/id\s+UUID\s+PRIMARY KEY/);
  });
});
