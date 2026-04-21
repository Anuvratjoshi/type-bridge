# Recipes

End-to-end working examples for the most common project setups.

---

## Recipe 1 — Express + Mongoose (classic MERN stack)

### Project layout

```
my-app/
  backend/
    src/
      models/
        user.model.ts
        post.model.ts
      dtos/
        auth.dto.ts
      routes/
        user.routes.ts
    tsconfig.json
  frontend/
    src/
      types/
        generated/    ← TypeBridge writes here
      components/
        ProfileCard.tsx
  type-bridge.config.ts
  package.json
```

### `type-bridge.config.ts`

```ts
import type { TypeBridgeConfig } from "@joshianuvrat/type-bridge";

const config: TypeBridgeConfig = {
  input: "backend/src",
  include: ["**/models/**/*.ts", "**/dtos/**/*.ts"],
  outDir: "frontend/src/types/generated",
  excludeFields: ["password", "passwordHash", "__v"],
};

export default config;
```

### Backend types

```ts
// backend/src/models/user.model.ts
import { Document, Types } from "mongoose";

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string; // will be stripped
  role: "admin" | "user";
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

```ts
// backend/src/dtos/auth.dto.ts
export interface LoginDTO {
  email: string;
  password: string; // will be stripped
}

export interface LoginResponse {
  accessToken: string; // will be stripped
  refreshToken: string; // will be stripped
  user: {
    id: string;
    name: string;
    email: string;
    role: "admin" | "user";
  };
}
```

### Run

```bash
npx @joshianuvrat/type-bridge generate
```

### Generated output

```ts
// frontend/src/types/generated/user.model.ts
export interface IUser {
  _id: string; // ObjectId → string
  name: string;
  email: string;
  // password stripped
  role: "admin" | "user";
  isVerified: boolean;
  createdAt: string; // Date → string
  updatedAt: string;
}
```

```ts
// frontend/src/types/generated/auth.dto.ts
export interface LoginDTO {
  email: string;
  // password stripped
}

export interface LoginResponse {
  // accessToken, refreshToken stripped
  user: {
    id: string;
    name: string;
    email: string;
    role: "admin" | "user";
  };
}
```

### Use in the frontend

```tsx
// frontend/src/components/ProfileCard.tsx
import type { IUser } from "@/types/generated";

interface ProfileCardProps {
  user: IUser;
}

export function ProfileCard({ user }: ProfileCardProps) {
  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
      <span>{user.role === "admin" ? "Admin" : "Member"}</span>
      <small>Joined: {new Date(user.createdAt).toLocaleDateString()}</small>
    </div>
  );
}
```

---

## Recipe 2 — NestJS + class-validator DTOs

NestJS uses classes (not interfaces) decorated with `class-validator`. TypeBridge
extracts the **data properties** from those classes and converts them to
frontend-safe interfaces.

### Backend

```ts
// backend/src/users/dto/create-user.dto.ts
import { IsEmail, IsString, MinLength, IsEnum } from "class-validator";

export enum UserRole {
  Admin = "admin",
  User = "user",
}

export class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string; // will be stripped

  @IsEnum(UserRole)
  role: UserRole;
}

export class UserResponseDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}
```

### `type-bridge.config.ts`

```ts
import type { TypeBridgeConfig } from "@joshianuvrat/type-bridge";

const config: TypeBridgeConfig = {
  input: "backend/src",
  include: ["**/*.dto.ts", "**/*.entity.ts"],
  outDir: "frontend/src/types/generated",
  preserveEnums: true, // keep enums as enums (NestJS compatible)
};

export default config;
```

### Generated output

```ts
// frontend/src/types/generated/create-user.dto.ts

export enum UserRole {
  Admin = "admin",
  User = "user",
}

export interface CreateUserDto {
  name: string;
  email: string;
  // password stripped
  role: UserRole;
}

export interface UserResponseDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string; // Date → string
}
```

### Frontend usage

```ts
// frontend/src/api/users.ts
import type { CreateUserDto, UserResponseDto } from "@/types/generated";

export async function createUser(
  data: CreateUserDto,
): Promise<UserResponseDto> {
  const res = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json() as Promise<UserResponseDto>;
}
```

---

## Recipe 3 — Monorepo with multiple services

### Layout

```
monorepo/
  packages/
    users-service/
      src/
        models/
        dtos/
      type-bridge.config.ts
    posts-service/
      src/
        models/
        dtos/
      type-bridge.config.ts
    frontend/
      src/
        types/
          generated/
            users/
            posts/
```

### Per-service configs

```ts
// packages/users-service/type-bridge.config.ts
import type { TypeBridgeConfig } from "@joshianuvrat/type-bridge";

export default {
  input: "src",
  outDir: "../frontend/src/types/generated/users",
} satisfies TypeBridgeConfig;
```

```ts
// packages/posts-service/type-bridge.config.ts
import type { TypeBridgeConfig } from "@joshianuvrat/type-bridge";

export default {
  input: "src",
  outDir: "../frontend/src/types/generated/posts",
} satisfies TypeBridgeConfig;
```

### Root package.json scripts

```jsonc
{
  "scripts": {
    "types:generate": "type-bridge generate --cwd packages/users-service && type-bridge generate --cwd packages/posts-service",
    "types:watch": "concurrently \"type-bridge watch --cwd packages/users-service\" \"type-bridge watch --cwd packages/posts-service\""
  }
}
```

### Programmatic version (custom build script)

```ts
// scripts/generate-all-types.ts
import { loadConfig, runPipeline } from "@joshianuvrat/type-bridge";
import path from "path";

const services = ["packages/users-service", "packages/posts-service"];

async function main() {
  for (const service of services) {
    const cwd = path.resolve(__dirname, "..", service);
    const config = await loadConfig(cwd);
    const result = await runPipeline({ config, cwd });
    console.log(`✔ ${service}: ${result.generatedFiles.length} files`);
  }
}

main().catch(console.error);
```

---

## Recipe 4 — CI/CD — prevent stale types

Ensure the frontend types are always in sync by checking them in CI.

### GitHub Actions

```yaml
# .github/workflows/typecheck.yml
name: Type Check

on: [push, pull_request]

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Generate types
        run: npx @joshianuvrat/type-bridge generate --no-prettier

      - name: Type-check backend
        run: npx tsc --project backend/tsconfig.json --noEmit

      - name: Type-check frontend
        run: npx tsc --project frontend/tsconfig.json --noEmit
```

### Detect stale types (hash check)

Add a script that compares the hash embedded in generated files against a fresh run:

```ts
// scripts/check-types-fresh.ts
import { loadConfig, runExtractor, runTransformer } from "@joshianuvrat/type-bridge";
import { computeHash } from "type-bridge/dist/core/generator";
import fs from "fs";
import path from "path";

async function main() {
  const config = await loadConfig();
  const extracted = await runExtractor({ config });
  const transformed = runTransformer(extracted, { config });

  // Group by source file (same logic as the generator)
  const groups = new Map<string, typeof transformed>();
  for (const decl of transformed) {
    const k = decl.sourceFile;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(decl);
  }

  let stale = false;
  for (const [sourceFile, decls] of groups) {
    const freshHash = computeHash(decls.map((d) => d.typeText).join(""));
    const outputFile = path.join(
      config.outDir,
      path.basename(sourceFile, ".ts") + ".ts",
    );
    if (!fs.existsSync(outputFile)) {
      console.error(`✖ Missing: ${outputFile}`);
      stale = true;
      continue;
    }
    const existing = fs.readFileSync(outputFile, "utf-8");
    if (!existing.includes(freshHash)) {
      console.error(`✖ Stale:   ${outputFile}`);
      stale = true;
    }
  }

  if (stale) {
    console.error("\nRun `npx @joshianuvrat/type-bridge generate` to refresh.");
    process.exit(1);
  }

  console.log("✔ All generated types are up to date.");
}

main().catch(console.error);
```

---

## Recipe 5 — Vite project with path aliases

```ts
// type-bridge.config.ts
import type { TypeBridgeConfig } from "@joshianuvrat/type-bridge";

export default {
  input: "src/server",
  outDir: "src/client/types/generated",
  include: ["**/*.types.ts", "**/*.dto.ts"],
  // Tell TypeBridge which tsconfig to use for resolving path aliases
  tsConfigFilePath: "src/server/tsconfig.json",
} satisfies TypeBridgeConfig;
```

```ts
// vite.config.ts (excerpt) — alias must match the outDir
import path from "path";

export default {
  resolve: {
    alias: {
      "@types": path.resolve(__dirname, "src/client/types/generated"),
    },
  },
};
```

Frontend import:

```ts
import type { IUser } from "@types"; // resolves to generated index.ts
```

---

## Recipe 6 — Team workflow (backend dev + frontend dev)

For teams where a backend developer owns the server-side code and a separate
frontend developer consumes the types.

### Project layout

```
my-app/                         ← shared repo root
  backend/
    src/
      models/
      dtos/
  frontend/
    src/
      types/
        generated/              ← TypeBridge writes here (gitignored)
      components/
      hooks/
  type-bridge.config.ts            ← lives at root, owned by backend dev
  package.json
  .gitignore
```

---

### Backend dev responsibilities (one-time)

**1. Install and configure TypeBridge:**

```bash
npm install --save-dev @joshianuvrat/type-bridge
```

```ts
// type-bridge.config.ts
import type { TypeBridgeConfig } from "@joshianuvrat/type-bridge";

export default {
  input: "backend/src",
  outDir: "frontend/src/types/generated",
  include: ["**/*.model.ts", "**/*.dto.ts", "**/*.interface.ts"],
  excludeFields: [
    "password",
    "passwordHash",
    "token",
    "refreshToken",
    "secret",
  ],
} satisfies TypeBridgeConfig;
```

**2. Add scripts to `package.json`:**

```json
{
  "scripts": {
    "types:generate": "type-bridge generate",
    "types:watch": "type-bridge watch",
    "prebuild": "type-bridge generate"
  }
}
```

**3. Gitignore the generated output:**

```
# .gitignore
frontend/src/types/generated/
```

**4. Document it in the project README** so every dev knows what to run.

---

### Backend dev — ongoing workflow

Write types normally. TypeBridge will handle the rest.

```ts
// backend/src/models/user.model.ts
export interface IUser {
  _id: string;
  name: string;
  email: string;
  password: string; // TypeBridge strips this automatically
  role: "admin" | "user";
  createdAt: Date; // TypeBridge converts to string
}

export interface CreateUserDTO {
  name: string;
  email: string;
  password: string; // stripped
}
```

When you rename a field, add a field, or change a type — commit as usual.
CI will re-generate types and type-check the frontend, catching any mismatches
before the PR is merged.

---

### Frontend dev — first-time setup

```bash
git clone https://github.com/your-org/my-app.git
cd my-app
npm install

# Generate all types before opening the editor
npm run types:generate
```

Output:

```
[TypeBridge] Extracting types…
  Found 8 declaration(s) across 3 file(s).
[TypeBridge] Transforming…
  7 declaration(s) after transformation.
[TypeBridge] ✔ Done in 820ms — 4 file(s) written.
```

Now open the editor — all types are available immediately.

---

### Frontend dev — daily workflow

**After pulling backend changes:**

```bash
git pull
npm run types:generate
# If TypeScript now shows errors → those are contract mismatches to fix
```

**During active development alongside the backend:**

```bash
# Terminal 1 — keep types in sync automatically
npm run types:watch

# Terminal 2 — run the frontend dev server normally
npm run dev
```

Every time the backend dev saves a file, the frontend types update within
300 ms. TypeScript in the editor immediately highlights any new mismatches.

**Writing components — zero boilerplate:**

```tsx
// frontend/src/components/UserCard.tsx
import type { IUser } from "@/types/generated";

interface Props {
  user: IUser;
}

export function UserCard({ user }: Props) {
  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
      <span className={user.role === "admin" ? "badge-red" : "badge-blue"}>
        {user.role}
      </span>
      {/* user.password does not exist here — TypeBridge stripped it */}
    </div>
  );
}
```

**Writing API calls — fully typed:**

```ts
// frontend/src/api/users.ts
import type { IUser, CreateUserDTO } from "@/types/generated";

export async function getUser(id: string): Promise<IUser> {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) throw new Error(`[${res.status}] ${await res.text()}`);
  return res.json();
}

export async function createUser(data: CreateUserDTO): Promise<IUser> {
  const res = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`[${res.status}] ${await res.text()}`);
  return res.json();
}
```

---

### What TypeScript catches automatically

Because generated types always reflect the live backend contract, TypeScript
flags mismatches **at compile time** the moment you run `types:generate`:

| Backend change                      | What TS shows in frontend                  |
| ----------------------------------- | ------------------------------------------ |
| Renamed `userName` → `name`         | Red squiggle everywhere `userName` is used |
| Made `role` required (removed `?`)  | Error if any component doesn't handle it   |
| Added required field `isVerified`   | Error in any place building the object     |
| Changed `id: number` → `id: string` | Type mismatch in every comparison / usage  |
| Removed a field entirely            | Error on any access                        |

---

### CI pipeline (no stale types ever reach production)

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: "npm" }
      - run: npm ci

      # Step 1 — always generate fresh types
      - name: Generate types
        run: npx @joshianuvrat/type-bridge generate --no-prettier

      # Step 2 — type-check the frontend against them
      - name: Type-check frontend
        run: npx tsc --project frontend/tsconfig.json --noEmit

      # Step 3 — run your tests
      - name: Test
        run: npm test
```

If the backend changed a type contract and the frontend wasn't updated, the
`tsc` step fails — **the PR is blocked until it's fixed**.

---

### Git hook (optional — enforce locally before every commit)

```bash
npx husky init
echo 'npx @joshianuvrat/type-bridge generate --no-prettier && git add frontend/src/types/generated/' > .husky/pre-commit
```

This auto-regenerates and stages the updated types on every `git commit` so
no one can accidentally push stale types.
