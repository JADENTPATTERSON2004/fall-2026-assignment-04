---
name: erd-generator
description: >-
  Generates, validates, and compiles Mermaid Entity-Relationship Diagrams (ERDs)
  into SVG assets. Use this skill whenever requested to design a database schema,
  ERD, data model, or architecture diagram.
---

# ERD Generator Skill

This skill guides the agent through converting domain requirements into a syntactically valid Mermaid Entity-Relationship Diagram (`erDiagram`), compiling it into a visual SVG asset using a deterministic validator script, and self-correcting any compilation errors.

---

## Operational Workflow

When triggered to design or update an ERD, follow these sequential steps:

### Step 1: Requirements Analysis & Domain Modeling
1. Parse domain requirements into entities, attributes, primary keys (`PK`), foreign keys (`FK`), and cardinalities.
2. Check existing schema migrations (e.g., in `src/db/migrations/`) to identify pre-existing tables (such as `users`) so relationships properly reference existing tables rather than recreating conflicting definitions.
3. Determine data types, Primary Keys (`PK`), Foreign Keys (`FK`), and cardinalities:
   - Exactly one to zero or many: `||--o{`
   - Exactly one to one or more: `||--|{`
   - Exactly one to zero or one: `||--o|`
   - Exactly one to exactly one: `||--||`

### Step 2: Draft Mermaid Diagram to File
Write the drafted Mermaid syntax directly to `docs/architecture/schema.mmd`.

#### Mermaid Syntax Guidelines
- The file must start with `erDiagram`.
- Entity names should be uppercase identifiers without spaces (e.g., `USERS`, `BOOKS`, `LOANS`).
- Attribute definitions follow the format:
  ```text
  <data_type> <column_name> [PK|FK] ["optional comment"]
  ```
- Example:
  ```mermaid
  erDiagram
      USERS ||--o{ LOANS : "places"
      BOOKS ||--o{ LOANS : "borrowed in"
      AUTHORS ||--o{ BOOKS : "writes"
      GENRES ||--o{ BOOKS : "categorizes"

      USERS {
          serial id PK
          varchar(255) email
          varchar(255) name
          timestamp created_at
      }

      AUTHORS {
          serial id PK
          varchar(255) name
      }

      GENRES {
          serial id PK
          varchar(100) name
      }

      BOOKS {
          serial id PK
          varchar(255) title
          varchar(50) isbn
          int author_id FK
          int genre_id FK
      }

      LOANS {
          serial id PK
          int user_id FK
          int book_id FK
          timestamp borrowed_at
          timestamp returned_at
      }
  ```

### Step 3: Execute Renderer & Validator Script
Compile and validate the Mermaid diagram using the local CLI script:

```bash
node scripts/render_erd.js docs/architecture/schema.mmd
```

### Step 4: Self-Correction Loop
- **If exit code is `0` and output is `SUCCESS`:** The diagram compiled cleanly into `docs/architecture/erd.svg`. Proceed to Step 5.
- **If execution fails with `SYNTAX_ERROR` (exit code `1`):**
  1. Inspect the stderr trace from the output and identify the failing line number and unexpected tokens.
  2. Adjust the Mermaid syntax in `docs/architecture/schema.mmd` to fix the error.
  3. Re-run the validation script:
     ```bash
     node scripts/render_erd.js docs/architecture/schema.mmd
     ```
  4. Repeat this self-correction loop up to 3 retries until `SUCCESS` is achieved.

### Step 5: Deliver Final Output
Once compilation succeeds:
1. Present the complete, raw Mermaid diagram block to the user inside a ````mermaid ... ```` code block.
2. Reference the generated image asset path: `docs/architecture/erd.svg`.
3. Provide a concise summary of the entities, keys, and cardinalities modeled.
