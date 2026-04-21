# Configuration Reference

TypeBridge is configured through a **config file** that is auto-discovered by
[cosmiconfig](https://github.com/cosmiconfig/cosmiconfig).

---

## Config file formats

TypeBridge accepts any of these file names (searched in order):

| File | Use when |
|---|---|
| `type-bridge.config.ts` | You want full IntelliSense and type safety (**recommended**) |
| `type-bridge.config.js` | Plain JavaScript project |
| `type-bridge.config.cjs` | CommonJS-explicit JavaScript |
| `type-bridge.config.json` | Minimal JSON-only setup |
| `.typebridgerc` | Simple RC file (JSON) |
| `.typebridgerc.yaml` / `.typebridgerc.yml` | YAML format |
| `package.json` → `"type-bridge"` key | Inline config in package.json |

### TypeScript config file (recommended)

```ts
// type-bridge.config.ts
import type { TypeBridgeConfig } from "@joshianuvrat/type-bridge";

const config: TypeBridgeConfig = {
  input:  "backend/src",
  outDir: "frontend/src/types/generated",
};

export default config;
```

### JSON config file

```json
// type-bridge.config.json
{
  "input":  "backend/src",
  "outDir": "frontend/src/types/generated"
}
```

### package.json inline

```jsonc
// package.json
{
  "type-bridge": {
    "input":  "backend/src",
    "outDir": "frontend/src/types/generated"
  }
}
```

---

## All options

### `input`

| | |
|---|---|
| Type | `string \| string[]` |
| Default | `"src"` |
| Required | No |

Root directory (or array of directories) that TypeBridge scans for TypeScript
source files. Glob patterns in `include` / `exclude` are applied relative to
each `input` path.

**Examples:**

```ts
// Single directory
input: "backend/src"

// Multiple directories (monorepo)
input: ["packages/shared/src", "packages/api/src"]

// Relative to cwd
input: "src/server"
```

---

### `outDir`

| | |
|---|---|
| Type | `string` |
| Default | `"frontend/src/types/generated"` |
| Required | No |

Directory where generated `.ts` files are written.

```ts
outDir: "client/src/types/api"
```

---

### `include`

| | |
|---|---|
| Type | `string[]` |
| Default | `["**/*.ts"]` |

Glob patterns relative to each `input` directory. Only files that match at
least one `include` pattern are processed.

```ts
// Only process model and DTO files
include: ["**/*.model.ts", "**/*.dto.ts", "**/*.interface.ts"]
```

---

### `exclude`

| | |
|---|---|
| Type | `string[]` |
| Default | `["**/*.test.ts", "**/*.spec.ts", "**/*.d.ts"]` |

Glob patterns to skip. Always applied on top of `include`.

```ts
// Also skip migration and seed files
exclude: [
  "**/*.test.ts",
  "**/*.spec.ts",
  "**/*.d.ts",
  "**/migrations/**",
  "**/seeds/**",
]
```

---

### `cleanOutput`

| | |
|---|---|
| Type | `boolean` |
| Default | `true` |

When `true`, TypeBridge deletes everything inside `outDir` before writing new
files. This prevents stale types from accumulating when you rename or delete
backend files.

```ts
// Keep old generated files around (not recommended)
cleanOutput: false
```

---

### `generateSDK`

| | |
|---|---|
| Type | `boolean` |
| Default | `false` |

When `true`, TypeBridge scans your source files for Express route registrations
and generates a `sdk.ts` file with a typed API client.

See the [SDK Generator guide](./07-sdk-generator.md) for full details.

```ts
generateSDK: true
```

---

### `excludeFields`

| | |
|---|---|
| Type | `string[]` |
| Default | `["password", "passwordHash", "token", "refreshToken", "secret"]` |

Field names that are stripped from **every** generated type, regardless of
which interface they appear in.

```ts
// Add custom sensitive fields
excludeFields: [
  "password",
  "passwordHash",
  "token",
  "refreshToken",
  "secret",
  "apiKey",
  "privateKey",
  "internalNotes",
]
```

> **Security note:** This list replaces the default — if you override it,
> re-include `"password"` etc. unless you have a reason not to.

---

### `excludeTypes`

| | |
|---|---|
| Type | `string[]` |
| Default | `["Document", "Model", "Schema", "Request", "Response", "NextFunction", "Express"]` |

Declaration names to drop entirely from the output. Useful for backend-only
types that should never reach the frontend.

Built-in patterns (always applied, regardless of this config):

| Pattern | Covers |
|---|---|
| `Document` | `mongoose.Document` |
| `Model` | `mongoose.Model<T>` |
| `Schema` | `mongoose.Schema` |
| `Request` | `express.Request` |
| `Response` | `express.Response` |
| `NextFunction` | `express.NextFunction` |
| `Repository` | TypeORM `Repository<T>` |
| `DataSource` | TypeORM `DataSource` |
| `EntityManager` | TypeORM `EntityManager` |

```ts
// Add your own backend-only types
excludeTypes: [
  ...DEFAULT_CONFIG.excludeTypes,   // keep the defaults
  "AppLogger",
  "RedisClient",
  "KafkaProducer",
]
```

---

### `preserveDate`

| | |
|---|---|
| Type | `boolean` |
| Default | `false` |

By default, every `Date` property is converted to `string` — because `Date`
objects do not survive JSON serialisation (they become ISO strings).

Set `preserveDate: true` if you use a library like `class-transformer` that
reconstructs `Date` instances on the client.

```ts
// Backend
export interface Post {
  publishedAt: Date;
}

// Generated (preserveDate: false — default)
export interface Post {
  publishedAt: string;
}

// Generated (preserveDate: true)
export interface Post {
  publishedAt: Date;
}
```

---

### `preserveEnums`

| | |
|---|---|
| Type | `boolean` |
| Default | `false` |

By default, TypeScript enums are converted to **string union types** for
better tree-shaking and JSON compatibility.

```ts
// Backend
export enum Role { Admin = "admin", User = "user" }

// Generated (preserveEnums: false — default)
export type Role = "admin" | "user";

// Generated (preserveEnums: true)
export enum Role { Admin = "admin", User = "user" }
```

---

### `tsConfigFilePath`

| | |
|---|---|
| Type | `string \| undefined` |
| Default | Auto-detected (`tsconfig.json` in `cwd`) |

Path to a `tsconfig.json` the extractor should use when parsing your backend.
Useful when your backend has a non-standard tsconfig location.

```ts
tsConfigFilePath: "backend/tsconfig.json"
```

---

### `prettier`

| | |
|---|---|
| Type | `boolean` |
| Default | `true` |

Format every generated file with Prettier before writing. TypeBridge resolves
your project's Prettier config automatically. If Prettier is not installed or
formatting fails, TypeBridge falls back gracefully.

```ts
// Skip formatting (e.g. in CI for speed)
prettier: false
```

---

### `addHashHeader`

| | |
|---|---|
| Type | `boolean` |
| Default | `true` |

Prepend a SHA-256 hash comment to every generated file:

```ts
// TypeBridge — generated from: user.model.ts
// Hash: 3f8a21bc04d1
// Do NOT edit manually. Re-run `type-bridge generate` to refresh.
```

The hash lets you detect stale frontend types in CI (compare the hash in the
file against a freshly generated hash).

---

## Full example config

```ts
// type-bridge.config.ts
import type { TypeBridgeConfig } from "@joshianuvrat/type-bridge";

const config: TypeBridgeConfig = {
  // ── Input ──────────────────────────────────────────────────────────────
  input:   "backend/src",
  include: ["**/*.model.ts", "**/*.dto.ts", "**/*.interface.ts"],
  exclude: ["**/*.test.ts", "**/*.spec.ts", "**/*.d.ts", "**/migrations/**"],

  // ── Output ─────────────────────────────────────────────────────────────
  outDir:      "frontend/src/types/generated",
  cleanOutput: true,

  // ── Security ───────────────────────────────────────────────────────────
  excludeFields: ["password", "passwordHash", "token", "refreshToken", "secret", "apiKey"],
  excludeTypes:  ["Document", "Model", "Schema", "Request", "Response", "NextFunction"],

  // ── Type transformations ───────────────────────────────────────────────
  preserveDate:  false,   // Date → string (safe for JSON APIs)
  preserveEnums: false,   // enums → union types (better tree-shaking)

  // ── Tooling ────────────────────────────────────────────────────────────
  tsConfigFilePath: "backend/tsconfig.json",
  prettier:         true,
  addHashHeader:    true,

  // ── Advanced ───────────────────────────────────────────────────────────
  generateSDK: false,
};

export default config;
```

---

## Viewing the resolved config

Run this to see exactly what config TypeBridge will use (after merging defaults
with your overrides):

```bash
npx @joshianuvrat/type-bridge info
```

Example output:

```json
{
  "input": "backend/src",
  "outDir": "frontend/src/types/generated",
  "include": ["**/*.ts"],
  "exclude": ["**/*.test.ts", "**/*.spec.ts", "**/*.d.ts"],
  "cleanOutput": true,
  "generateSDK": false,
  "excludeFields": ["password", "passwordHash", "token", "refreshToken", "secret"],
  "excludeTypes": ["Document", "Model", "Schema", "Request", "Response", "NextFunction", "Express"],
  "preserveDate": false,
  "preserveEnums": false,
  "prettier": true,
  "addHashHeader": true
}
```
