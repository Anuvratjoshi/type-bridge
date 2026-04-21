# Introduction

## What is TypeBridge?

TypeBridge is a **build-time CLI tool and Node.js library** that automatically
extracts TypeScript types from your backend source code and generates clean,
frontend-safe type files — with zero manual copying.

```
Backend TypeScript  →  TypeBridge Pipeline  →  Frontend Types
```

If you have ever written this on the backend …

```ts
// backend/src/models/user.model.ts
import { Document, Types } from "mongoose";

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string; // ← sensitive
  createdAt: Date;
}
```

… and then re-written this on the frontend …

```ts
// frontend/src/types/user.ts   ← you wrote this by hand
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}
```

… TypeBridge eliminates that duplication entirely.

---

## The problem it solves

| Problem               | Without TypeBridge                          | With TypeBridge                                   |
| --------------------- | ----------------------------------------- | ----------------------------------------------- |
| Type duplication      | Both sides define the same shape          | Single source of truth on the backend           |
| Contract drift        | Frontend silently drifts from backend     | Generated on every build — always fresh         |
| Sensitive field leaks | Easy to accidentally include `password`   | Stripped automatically by default               |
| Refactoring pain      | Update two codebases                      | Update backend only, re-run `type-bridge generate` |
| Mongoose / ORM noise  | `extends Document`, `ObjectId` everywhere | Cleaned automatically                           |

---

## How the pipeline works

```
┌──────────────────────────────────────────────────────┐
│                  Your backend src/                   │
│   user.model.ts   auth.dto.ts   post.interface.ts    │
└───────────────────────┬──────────────────────────────┘
                        │  (ts-morph reads AST)
                        ▼
               ┌─────────────────┐
               │    Extractor    │  reads interfaces, type aliases,
               │                 │  enums, classes
               └────────┬────────┘
                        │
                        ▼
               ┌─────────────────┐
               │   Transformer   │  strips Document/Model/Request,
               │                 │  removes sensitive fields,
               │                 │  Date→string, ObjectId→string,
               │                 │  enum→union
               └────────┬────────┘
                        │
                        ▼
               ┌─────────────────┐
               │    Generator    │  writes .ts files, formats with
               │                 │  Prettier, writes barrel index.ts
               └────────┬────────┘
                        │
            ┌───────────┴────────────┐
            ▼                        ▼
  frontend/src/types/generated/   (optional) sdk.ts
      user.ts                      typed API client
      auth.ts
      index.ts
```

---

## Installation

**Prerequisites:** Node.js ≥ 18

```bash
# As a dev dependency (recommended)
npm install --save-dev @joshianuvrat/type-bridge

# yarn
yarn add -D @joshianuvrat/type-bridge

# pnpm
pnpm add -D @joshianuvrat/type-bridge
```

> TypeBridge is a **dev dependency** — it generates files at build time and is
> never bundled into your production code.

---

## Quick start (5 minutes)

### 1. Create a config file

At the root of your repository create `type-bridge.config.ts`:

```ts
// type-bridge.config.ts
import type { TypeBridgeConfig } from "@joshianuvrat/type-bridge";

const config: TypeBridgeConfig = {
  input: "backend/src", // where your backend types live
  outDir: "frontend/src/types/generated", // where to write the output
};

export default config;
```

That is the minimum required config. Everything else has sensible defaults.

### 2. Write types on the backend

```ts
// backend/src/models/user.model.ts
import { Document, Types } from "mongoose";

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: "admin" | "user";
  createdAt: Date;
}

export interface CreateUserDTO {
  name: string;
  email: string;
  password: string;
}
```

### 3. Run the generator

```bash
npx @joshianuvrat/type-bridge generate
```

Console output:

```
[TypeBridge] Extracting types…
  Found 2 declaration(s) across 1 file(s).

[TypeBridge] Transforming…
  2 declaration(s) after transformation.

[TypeBridge] Generating output files…
  Generated: frontend/src/types/generated/user.model.ts

[TypeBridge] ✔ Done in 412ms — 2 file(s) written.
```

### 4. Inspect the generated files

```ts
// frontend/src/types/generated/user.model.ts  (auto-generated — do not edit)
// ──────────────────────────────────────────────────────────────────────────
// TypeBridge — generated from: user.model.ts
// Hash: 3f8a21bc04d1
// Do NOT edit manually. Re-run `type-bridge generate` to refresh.
// ──────────────────────────────────────────────────────────────────────────

export interface IUser {
  _id: string; // ObjectId → string
  name: string;
  email: string;
  // password stripped  ← excluded by default
  role: "admin" | "user";
  createdAt: string; // Date → string
}

export interface CreateUserDTO {
  name: string;
  email: string;
  // password stripped
}
```

```ts
// frontend/src/types/generated/index.ts  (barrel file)
export * from "./user.model";
```

### 5. Import in your frontend

```ts
// frontend/src/components/ProfileCard.tsx
import type { IUser } from "@/types/generated";

interface Props {
  user: IUser;
}

export function ProfileCard({ user }: Props) {
  return <h2>{user.name}</h2>;
}
```

**Done.** You never touch the frontend types again — just re-run
`npx @joshianuvrat/type-bridge generate` when the backend changes.

---

## Add it to your build script

```jsonc
// package.json
{
  "scripts": {
    "build": "type-bridge generate && tsc",
    "build:watch": "type-bridge watch",
    "prebuild": "type-bridge generate" // or use prebuild hook
  }
}
```

---

## Add generated files to .gitignore

Generated files should be treated like compiled output:

```
# .gitignore
frontend/src/types/generated/
```

Regenerate them as part of CI before type-checking:

```yaml
# .github/workflows/ci.yml  (excerpt)
- name: Generate types
  run: npx @joshianuvrat/type-bridge generate

- name: Type-check frontend
  run: npx tsc --noEmit
```

---

## Team workflow — backend dev & frontend dev

TypeBridge is designed for teams where the backend and frontend live in the
same repo (monorepo) **or** are separate repos that share a workspace.
Here is exactly what each person does.

### The setup (backend dev does this once)

1. Install TypeBridge at the repo root:

```bash
npm install --save-dev @joshianuvrat/type-bridge
```

2. Create `type-bridge.config.ts` at the repo root:

```ts
export default {
  input: "backend/src",
  outDir: "frontend/src/types/generated",
};
```

3. Add npm scripts to `package.json`:

```json
{
  "scripts": {
    "types:generate": "type-bridge generate",
    "types:watch": "type-bridge watch",
    "prebuild": "type-bridge generate"
  }
}
```

4. Add the generated folder to `.gitignore`:

```
# .gitignore
frontend/src/types/generated/
```

That is the **only** one-time cost.

---

### The frontend dev's daily routine

The frontend dev never writes backend types manually. Their full workflow is:

**After cloning the repo for the first time:**

```bash
npm install
npm run types:generate   # populate the generated folder
```

**After pulling backend changes:**

```bash
git pull
npm run types:generate   # refresh types — takes < 1 second
```

**During active development (types auto-update on save):**

```bash
npm run types:watch      # leave this running in a terminal
```

**Then just import and use — no manual type work ever:**

```ts
import type { IUser, CreateUserDTO, LoginResponse } from "@/types/generated";

// TypeScript immediately catches mismatches against the live backend contract
async function createUser(data: CreateUserDTO) {
  const res = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json() as Promise<IUser>;
}
```

---

### The daily loop (visualised)

```
Backend dev edits a type
        │
        ▼
  git push  ──────────────────────────────────────────┐
        │                                              │
        │            Frontend dev's machine            │
        ▼                                              │
  git pull ←─────────────────────────────────────────-┘
        │
        ▼
  npm run types:generate   (or watch does it automatically)
        │
        ▼
  TypeScript highlights every place in the
  frontend that broke due to the backend change
        │
        ▼
  Frontend dev fixes only those spots — done
```

---

### What TypeScript catches automatically

Because the generated types are always in sync with the backend, TypeScript
will **immediately show red squiggles** in your editor if:

- The backend renamed a field (`userName` → `name`)
- The backend made a field optional that was required
- The backend added a required field you haven't handled yet
- The backend changed a type (`string` → `number`)

You catch these at **compile time, not at runtime** — no more mysterious
`undefined` errors in production because a field name changed.

---

### CI — enforce freshness for the whole team

Add this to your GitHub Actions / GitLab CI pipeline:

```yaml
# .github/workflows/ci.yml
jobs:
  typecheck:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: "npm" }

      - run: npm ci

      # Always generate types before type-checking
      - run: npx @joshianuvrat/type-bridge generate --no-prettier

      # Now type-check the frontend against freshly generated types
      - run: npx tsc --project frontend/tsconfig.json --noEmit
```

If a backend dev changes a type without the frontend being updated, the CI
pipeline **fails** — the team is blocked from merging until the mismatch is
fixed. This is the safety net that prevents contract drift permanently.

---

### Using git hooks (optional, for local enforcement)

Install [husky](https://typicode.github.io/husky/) to auto-generate types before
every commit:

```bash
npx husky init
echo 'npx @joshianuvrat/type-bridge generate --no-prettier' > .husky/pre-commit
```

Now `type-bridge generate` runs automatically every time anyone on the team
makes a commit — stale types become impossible.

---

## Next steps

| Topic                                 | Doc                                              |
| ------------------------------------- | ------------------------------------------------ |
| All configuration options             | [Configuration Reference](./02-configuration.md) |
| CLI commands and flags                | [CLI Reference](./03-cli.md)                     |
| Use TypeBridge in Node.js code          | [Programmatic API](./04-api.md)                  |
| Real-world monorepo / NestJS examples | [Recipes](./05-recipes.md)                       |
| Handling Mongoose, enums, generics    | [Edge Cases](./06-edge-cases.md)                 |
| Generate a typed API client           | [SDK Generator](./07-sdk-generator.md)           |
| Something not working?                | [Troubleshooting](./08-troubleshooting.md)       |
