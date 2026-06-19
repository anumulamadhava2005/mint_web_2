# Anchored Summary: Expense Approval System Build

## Goal
Build a complete Expense Approval System mobile app in Mint Web 2 by writing Penpot JSONB design files, runtime schema, and database schema directly to the database for project `8ba3d6a8-890b-450c-b027-3200a6592ca5`.

## Constraints & Preferences
- Build via API calls (DB bridge) writing JSONB directly to database
- All features: multi-level approval workflows, tables, actions, global state, bindings, repeaters
- Components must render properly with proper button/view bindings
- Break into phases to avoid upstream idle timeout
- Use React Native (Expo) export target with SDUI runtime

## Progress

### Done
- Analyzed complete Mint Web 2 architecture (proxy, convert, runtime, database, API routes)
- Verified project exists: `8ba3d6a8-890b-450c-b027-3200a6592ca5` (name: "expense")
- Created 4-phase todo plan

### In Progress
- Phase 1: Create database schema (tables, relations, RLS policies)

### Blocked
- Need to execute DB bridge calls to create tables and insert schema data

## Key Decisions
- Use DB bridge (`https://api.mintit.pro/api/mint-db`) for all database operations
- Write Penpot-format JSONB directly to `files` table for design screens
- Write runtime schema to `runtime_schemas` table
- Use `project_commits` for versioned exports
- Multi-level approval: employee → manager → director → finance (configurable via `approval_rules` table)

## Next Steps
1. **Execute Phase 1**: Create 6 tables (`expense_categories`, `expenses`, `approval_rules`, `approval_history`, `budgets`, `policies`) with relations and RLS
2. **Execute Phase 2**: Insert runtime schema (AppSchema) with `globalState`, `actions`, `workflows`, `navigation`, `auth`, `database` config
3. **Execute Phase 3**: Create Penpot JSONB files for 8 screens (login, dashboard, new expense, detail, approval queue, finance dashboard, admin settings, reports)
4. **Execute Phase 4**: Trigger commit to generate React Native code

## Critical Context
- **Project ID**: `3be58ba8-fcfa-48a8-bda4-0de6fd2bb780` (owned by dev@expense.app)
- **DB Bridge URL**: `http://localhost:3001/api/db/{projectId}`
- **Tables use namespace prefix**: `mint_proj_3be58ba8fcfa48a8bda40de6fd2bb780_`
- **Session token**: `6d309db2b94d6e43462e37aeab5d878c903e427b0aad1d70f3a94bbea859f8e9` (cookie-based auth)
- **Penpot file structure**: `pages` → `pagesIndex` → `objects` with shapes hierarchy

## Relevant Files
- `/lib/db.ts`: DB bridge client with circuit breaker
- `/lib/runtime/schema.ts`: AppSchema TypeScript definitions
- `/app/api/db/[projectId]/route.ts`: Managed DB API (namespaced SQL)
- `/app/api/runtime-schema/[projectId]/route.ts`: Runtime schema CRUD
- `/app/api/files/route.ts`: File CRUD (Penpot documents)
- `/app/api/commit/route.ts`: Code generation commit endpoint