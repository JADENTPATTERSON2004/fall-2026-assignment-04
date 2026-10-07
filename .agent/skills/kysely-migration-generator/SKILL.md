---
name: kysely-migration-generator
description: >-
  Translates Mermaid Entity-Relationship Diagrams (ERDs) into type-safe Kysely
  database migration scripts. Use this skill whenever requested to generate Kysely
  migrations, convert docs/architecture/schema.mmd into database migrations, or
  implement schema DDL from an ERD.
---

# Kysely Migration Generator Skill

This skill guides the agent through parsing a Mermaid Entity-Relationship Diagram (`erDiagram` from `docs/architecture/schema.mmd`) and translating it into a type-safe, production-ready Kysely database migration script in TypeScript.

---

## Translation Rules & Mapping Guardrails

When generating Kysely database migrations from Mermaid ERDs, strictly enforce the following mapping guardrails:

### 1. Entities $\rightarrow$ Tables
- Map uppercase Mermaid entities to lowercase `snake_case` table names.
  - Examples: `USERS` $\rightarrow$ `users`, `BOOKS` $\rightarrow$ `books`, `AUTHORS` $\rightarrow$ `authors`, `GENRES` $\rightarrow$ `genres`, `LOANS` $\rightarrow$ `loans`.
- **Pre-existing tables:** Inspect existing migrations in `src/db/migrations/` (e.g., `001_initial_schema.ts`). Do NOT re-create already existing tables (like `users`) with `createTable()`. Only reference their columns in foreign keys.

### 2. Keys & Columns
- **Primary Keys (`PK`):** Convert `PK` attributes to auto-generating IDs/UUIDs:
  ```typescript
  .addColumn('id', 'serial', (col) => col.primaryKey())
  ```
- **Foreign Keys (`FK`):** Convert `FK` attributes to `.references().onDelete('cascade')`:
  ```typescript
  .addColumn('author_id', 'integer', (col) =>
    col.references('authors.id').onDelete('cascade').notNull()
  )
  ```
- **Attribute Data Types:** Map Mermaid data types to PostgreSQL DDL:
  - `serial` $\rightarrow$ `'serial'`
  - `varchar(N)` $\rightarrow$ `'varchar(N)'` (e.g., `'varchar(255)'`, `'varchar(100)'`, `'varchar(50)'`)
  - `text` $\rightarrow$ `'text'`
  - `int` / `integer` $\rightarrow$ `'integer'`
  - `boolean` $\rightarrow$ `'boolean'`
  - `timestamp` $\rightarrow$ `'timestamp'` (use `.defaultTo(sql\`NOW()\`).notNull()` for default timestamps)
- **Nullability:** Mark mandatory fields and foreign keys with `.notNull()`.

### 3. Cardinalities
- **One-to-Many (`||--o{` or `||--|{`):**
  - Place a foreign key column on the "many" (child) table referencing the "one" (parent) table:
    ```typescript
    // Inside child table builder (e.g. books referencing authors)
    .addColumn('author_id', 'integer', (col) =>
      col.references('authors.id').onDelete('cascade').notNull()
    )
    ```
- **One-to-One (`||--o|` or `||--||`):**
  - Place a foreign key column on the child table with a unique constraint to enforce the 1:1 relationship:
    ```typescript
    // Inside child table builder with unique constraint
    .addColumn('user_id', 'integer', (col) =>
      col.references('users.id').onDelete('cascade').unique().notNull()
    )
    ```

### 4. File Output
- Write the generated TypeScript migration to:
  ```text
  src/db/migrations/<timestamp>_<migration_name>.ts
  ```
- Use a current millisecond timestamp prefix (`Date.now()`) or sequential timestamp followed by a descriptive snake_case name (e.g., `src/db/migrations/1728312000000_create_library_schema.ts`).

### 5. Structure & Dependency Ordering
- **Exports:** Enforce exports for both `up(db: Kysely<any>): Promise<void>` and `down(db: Kysely<any>): Promise<void>` functions.
- **`up` Function:** Create tables in dependency order (independent parent tables first, followed by child tables with foreign key dependencies).
- **`down` Function:** Drop tables in **reverse dependency order** to avoid foreign key constraint errors:
  ```typescript
  import { Kysely, sql } from 'kysely';

  export async function up(db: Kysely<any>): Promise<void> {
    // 1. Independent parent tables
    await db.schema
      .createTable('authors')
      .addColumn('id', 'serial', (col) => col.primaryKey())
      .addColumn('name', 'varchar(255)', (col) => col.notNull())
      .execute();

    await db.schema
      .createTable('genres')
      .addColumn('id', 'serial', (col) => col.primaryKey())
      .addColumn('name', 'varchar(100)', (col) => col.notNull().unique())
      .execute();

    // 2. Child tables with foreign keys
    await db.schema
      .createTable('books')
      .addColumn('id', 'serial', (col) => col.primaryKey())
      .addColumn('title', 'varchar(255)', (col) => col.notNull())
      .addColumn('isbn', 'varchar(50)', (col) => col.notNull().unique())
      .addColumn('author_id', 'integer', (col) =>
        col.references('authors.id').onDelete('cascade').notNull()
      )
      .addColumn('genre_id', 'integer', (col) =>
        col.references('genres.id').onDelete('cascade').notNull()
      )
      .execute();

    // 3. Leaf child tables
    await db.schema
      .createTable('loans')
      .addColumn('id', 'serial', (col) => col.primaryKey())
      .addColumn('user_id', 'integer', (col) =>
        col.references('users.id').onDelete('cascade').notNull()
      )
      .addColumn('book_id', 'integer', (col) =>
        col.references('books.id').onDelete('cascade').notNull()
      )
      .addColumn('borrowed_at', 'timestamp', (col) =>
        col.defaultTo(sql`NOW()`).notNull()
      )
      .addColumn('returned_at', 'timestamp')
      .execute();
  }

  export async function down(db: Kysely<any>): Promise<void> {
    // Drop in reverse dependency order: loans -> books -> genres -> authors
    await db.schema.dropTable('loans').execute();
    await db.schema.dropTable('books').execute();
    await db.schema.dropTable('genres').execute();
    await db.schema.dropTable('authors').execute();
  }
  ```

---

## Verification & Self-Correction Workflow

1. **Verify TypeScript Compilation:**
   ```bash
   npm run build
   ```
   Must pass type-checking (`tsc --noEmit`) without errors.

2. **Execute Database Migration (if database container is running):**
   ```bash
   npm run migrate:up
   ```
   Verify that all migrations execute cleanly.

3. **Self-Correction:**
   If `npm run build` or `npm run migrate:up` fails, parse the error trace, repair table definitions, references, or drop order in the migration file, and re-run verification until successful.

4. **Deliver Final Output:**
   - Present the relative path to the new migration file in `src/db/migrations/`.
   - Output the complete TypeScript migration code block.
   - Summarize the tables created, column constraints, relationships, and reverse drop order.
