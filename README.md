# TypeBridge

> **Automatically sync backend TypeScript types to your frontend — zero manual duplication.**

TypeBridge is a CLI tool and library that parses your backend TypeScript source, strips backend-only constructs (Mongoose Documents, Express Request/Response, sensitive fields, etc.), and emits clean, tree-shakable type files ready for your frontend to import.

---

## Table of Contents

- [Why TypeBridge?](#why-type-bridge)
- [How It Works](#how-it-works)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
  - [All Options](#all-options)
- [CLI Reference](#cli-reference)
  - [generate](#generate)
  - [watch](#watch)
  - [info](#info)
- [Programmatic API](#programmatic-api)
- [Edge Cases Handled](#edge-cases-handled)
  - [Mongoose / ORM types](#mongoose--orm-types)
  - [Sensitive fields](#sensitive-fields)
  - [Date handling](#date-handling)
  - [ObjectId](#objectid)
  - [Enums](#enums)
  - [Circular / recursive types](#circular--recursive-types)
  - [@type-bridge-ignore](#type-bridge-ignore)
  - [Path parameters](#path-parameters)
- [SDK Generator](#sdk-generator)
- [Watch Mode](#watch-mode)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [License](#license)

---

## Why TypeBridge?

In a typical MERN + TypeScript setup you define types once on the backend and then **re-define the same types manually on the frontend**. This creates:

| Problem | Impact |
|---|---|
| Type duplication | Violates DRY; maintenance overhead |
| Contract drift | Frontend & backend types silently diverge |
| Painful refactors | You must update types in two (or more) places |
| Security risks | Sensitive fields can accidentally leak |

TypeBridge solves all of this with a **build-time automation pipeline**.

---

## How It Works

```
Backend TypeScript source
        │
        ▼
┌─────────────────────┐
│  Type Extractor     │  (ts-morph)
│  interfaces, types, │
│  enums, classes     │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│  Transformer /      │  strips backend types, excluded
│  Normalizer         │  fields, converts Date → string,
│                     │  ObjectId → string, enum → union
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│  Code Generator     │  writes .ts files, formats with
│                     │  Prettier, emits barrel index.ts
└─────────────────────┘
        │
        ▼
frontend/src/types/generated/
  user.ts   auth.ts   index.ts
```

Optionally, the **SDK Generator** scans Express route registrations and emits a fully-typed `sdk.ts` API client.

---

## Installation

```bash
# As a dev dependency in your project
npm install --save-dev @joshianuvrat/type-bridge

# Or globally
npm install -g @joshianuvrat/type-bridge
```

> **Node.js ≥ 18** is required.

---

## Quick Start

1. **Install**

   ```bash
   npm install --save-dev @joshianuvrat/type-bridge
   ```

2. **Create a config file** at the root of your repository:

   ```ts
   // type-bridge.config.ts
   import type { TypeBridgeConfig } from "@joshianuvrat/type-bridge";

   const config: TypeBridgeConfig = {
     input: "backend/src",
     outDir: "frontend/src/types/generated",
   };

   export default config;
   ```

3. **Generate**

   ```bash
   npx @joshianuvrat/type-bridge generate
   ```

4. **Import in your frontend**

   ```ts
   import type { User, AuthResponse } from "@/types/generated";
   ```

That's it. The generated files are **never committed** — add them to `.gitignore` and regenerate as part of your build step.

---

## Configuration

TypeBridge uses [cosmiconfig](https://github.com/cosmiconfig/cosmiconfig) to find your config. Supported locations (in order):

| File | Notes |
|---|---|
| `type-bridge.config.ts` | Recommended — full TypeScript support |
| `type-bridge.config.js` / `.cjs` | JavaScript config |
| `type-bridge.config.json` | JSON config |
| `.typebridgerc` / `.typebridgerc.json` / `.typebridgerc.yaml` | RC files |
| `package.json` → `"type-bridge"` key | Inline config |

### All Options

```ts
interface TypeBridgeConfig {
  /**
   * Root directory (or array) to scan for TypeScript source files.
   * @default "src"
   */
  input: string | string[];

  /**
   * Where to write the generated type files.
   * @default "frontend/src/types/generated"
   */
  outDir: string;

  /**
   * Glob patterns to include (relative to each `input`).
   * @default ["**/*.ts"]
   */
  include: string[];

  /**
   * Glob patterns to exclude.
   * @default ["**/*.test.ts", "**/*.spec.ts", "**/*.d.ts"]
   */
  exclude: string[];

  /**
   * Delete all files in `outDir` before writing.
   * @default true
   */
  cleanOutput: boolean;

  /**
   * Generate an API client SDK file (`sdk.ts`) alongside types.
   * @default false
   */
  generateSDK: boolean;

  /**
   * Field names to strip from every generated type (security).
   * @default ["password", "passwordHash", "token", "refreshToken", "secret"]
   */
  excludeFields: string[];

  /**
   * Type names to exclude from output.
   * Built-in defaults cover common backend-only types.
   */
  excludeTypes: string[];

  /**
   * Keep `Date` as-is instead of converting to `string`.
   * @default false
   */
  preserveDate: boolean;

  /**
   * Emit TypeScript enums instead of converting to union types.
   * @default false
   */
  preserveEnums: boolean;

  /**
   * Path to a tsconfig.json the extractor should use.
   * Auto-detected from cwd if omitted.
   */
  tsConfigFilePath?: string;

  /**
   * Format generated files with Prettier.
   * @default true
   */
  prettier: boolean;

  /**
   * Prepend a hash-comment header to each generated file.
   * Enables fast staleness detection.
   * @default true
   */
  addHashHeader: boolean;
}
```

---

## CLI Reference

### generate

```
npx @joshianuvrat/type-bridge generate [options]
```

| Option | Description |
|---|---|
| `--cwd <path>` | Working directory (default: `process.cwd()`) |
| `--outDir <path>` | Override `outDir` from config |
| `--sdk` | Enable SDK generation |
| `--no-clean` | Skip cleaning the output directory |
| `--no-prettier` | Skip Prettier formatting |
| `--config <path>` | Path to a specific config file |

**Example:**

```bash
npx @joshianuvrat/type-bridge generate --outDir src/types/api --sdk
```

---

### watch

```
npx @joshianuvrat/type-bridge watch [options]
```

Watches the source directory and re-runs `generate` on every change. Uses a 300 ms debounce to batch rapid saves.

| Option | Description |
|---|---|
| `--cwd <path>` | Working directory |
| `--outDir <path>` | Override `outDir` |
| `--sdk` | Enable SDK generation |

**Example:**

```bash
npx @joshianuvrat/type-bridge watch
```

Press `Ctrl + C` to stop.

---

### info

```
npx @joshianuvrat/type-bridge info
```

Prints the resolved, fully-merged configuration as JSON and exits. Useful for debugging.

---

## Programmatic API

You can use TypeBridge as a library instead of a CLI tool:

```ts
import { loadConfig, runPipeline } from "@joshianuvrat/type-bridge";

const config = await loadConfig("/path/to/project");
const result = await runPipeline({ config, cwd: "/path/to/project" });

console.log(`Generated ${result.generatedFiles.length} file(s) in ${result.durationMs}ms`);
```

### `loadConfig(cwd?)`

Returns the fully-merged `TypeBridgeConfig`. Searches `cwd` (defaults to `process.cwd()`) using cosmiconfig.

### `runExtractor({ config, cwd? })`

Returns `ExtractedFile[]` — raw AST metadata from the backend source.

### `runTransformer(extractedFiles, { config })`

Returns `TransformedDeclaration[]` — frontend-safe types.

### `runGenerator(declarations, { config, cwd? })`

Writes files to `config.outDir` and returns `string[]` — absolute paths of written files.

### `runPipeline({ config, cwd? })`

Runs the complete Extract → Transform → Generate pipeline. Returns `PipelineResult`:

```ts
interface PipelineResult {
  extractedFiles: ExtractedFile[];
  transformedDeclarations: TransformedDeclaration[];
  generatedFiles: string[];
  sdkFile?: string;
  durationMs: number;
}
```

---

## Edge Cases Handled

### Mongoose / ORM types

TypeBridge removes all heritage (`extends Document`, `extends Model<…>`) and known backend-only type names from the output. The following are excluded by default:

`Document`, `Model`, `Schema`, `Request`, `Response`, `NextFunction`, `Repository`, `DataSource`, `EntityManager`

Add more via `excludeTypes` in your config.

---

### Sensitive fields

The following fields are stripped from every type by default:

`password`, `passwordHash`, `token`, `refreshToken`, `secret`

Extend or replace the list with `excludeFields`:

```ts
excludeFields: ["password", "apiKey", "internalNotes"],
```

---

### Date handling

By default, `Date` is converted to `string` (ISO format assumed) since `Date` objects do not survive JSON serialization. Set `preserveDate: true` to keep `Date` as-is.

---

### ObjectId

`Types.ObjectId` and `ObjectId` are always converted to `string`.

---

### Enums

By default, TypeScript enums are converted to **string union types**:

```ts
// Backend
export enum Status { Active = "active", Inactive = "inactive" }

// Generated
export type Status = "active" | "inactive";
```

Set `preserveEnums: true` to preserve enum declarations.

---

### Circular / recursive types

ts-morph handles circular references at the AST level. TypeBridge does not artificially resolve them — they are emitted as-is, which TypeScript itself handles correctly.

---

### @type-bridge-ignore

Add a JSDoc tag to **exclude an individual declaration** from generation:

```ts
/** @type-bridge-ignore */
export interface InternalMetadata {
  _debugToken: string;
}
```

The declaration is silently skipped.

---

### Path parameters

The SDK generator correctly handles Express path parameters:

```ts
// Route:  GET /users/:id
// Generated:
export async function getUsersByById(
  client: TypeBridgeClient,
  params: { id: string },
  opts?: RequestOptions
): Promise<unknown> { … }
```

---

## SDK Generator

When `generateSDK: true`, TypeBridge scans your source files for Express route registrations:

```ts
app.get("/users", getAllUsers);
app.post("/users", createUser);
router.delete("/users/:id", deleteUser);
```

And emits a `sdk.ts` file in your output directory containing:

- A `createClient(baseURL)` factory
- One `async` function per detected route, fully typed
- A shared `request<T>()` helper (uses the native `fetch` API)

### Adding body and response types

Currently TypeBridge uses `unknown` for body/response types when it cannot infer them. You can post-process the SDK file or contribute route-annotation support. See [Roadmap](#roadmap).

---

## Watch Mode

```
npx @joshianuvrat/type-bridge watch
```

Watch mode:

- Runs one full pipeline pass on startup
- Uses **chokidar** to watch `input` directories
- Debounces 300 ms before triggering a rebuild (batches rapid saves)
- If a build is in progress when a change fires, queues one additional run
- Ignores the output directory (`outDir`) to prevent feedback loops
- Handles `SIGINT` / `SIGTERM` gracefully

---

## Project Structure

```
type-bridge/
├── src/
│   ├── index.ts                  # Public library API
│   ├── types.ts                  # All shared TypeScript types
│   ├── watcher.ts                # File watcher (chokidar)
│   ├── cli/
│   │   └── index.ts              # CLI entry point (commander)
│   ├── config/
│   │   ├── schema.ts             # TypeBridgeConfig interface + defaults
│   │   ├── loader.ts             # Cosmiconfig loader + validation
│   │   ├── index.ts              # Barrel
│   │   └── __tests__/
│   │       └── loader.test.ts
│   ├── core/
│   │   ├── extractor.ts          # Type Extractor Engine (ts-morph)
│   │   ├── transformer.ts        # Transformer / Normalizer
│   │   ├── generator.ts          # Code Generator
│   │   ├── sdk-generator.ts      # Optional SDK Generator
│   │   ├── pipeline.ts           # Orchestrates all core modules
│   │   └── __tests__/
│   │       ├── extractor.test.ts
│   │       ├── transformer.test.ts
│   │       └── generator.test.ts
│   └── utils/
│       ├── logger.ts             # Chalk-based logger
│       └── prettier.ts           # Prettier formatting helper
├── type-bridge.config.ts            # Example config (self-referential)
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── jest.config.json
```

---

## Testing

```bash
# Run all tests once
npm test

# Watch mode
npm run test:watch

# With coverage
npm test -- --coverage
```

Tests are written with **Jest + ts-jest**. Each module has its own `__tests__/` directory. Test strategy:

| Module | Strategy |
|---|---|
| Extractor | Creates real temp `.ts` files → runs ts-morph extraction |
| Transformer | Unit tests with in-memory `ExtractedDeclaration` objects |
| Generator | Writes to `os.tmpdir()` → asserts file existence & content |
| Config Loader | Creates real temp config files → asserts merged output |

---

## Security Considerations

- **Sensitive fields** — `password`, `passwordHash`, `token`, `refreshToken`, `secret` are stripped from all generated types by default. Extend the list with `excludeFields`.
- **No runtime access** — TypeBridge is a **build-time only** tool. No generated code has access to the database or environment variables.
- **Private declarations are never exported** — only `export`-ed declarations are processed.
- **@type-bridge-ignore** — always available to prevent any specific type from being included in the output.
- **Hash headers** — generated files include a SHA-256 hash comment so stale files can be detected in CI.

---

## Troubleshooting

### "No declarations to generate"

- Check that `input` points to a directory that actually contains `.ts` files.
- Make sure the types you want synced are `export`-ed.
- Run `npx @joshianuvrat/type-bridge info` to see the resolved config.

### Prettier errors on generated files

- TypeBridge falls back gracefully — formatting errors will not crash generation.
- Run `npm install prettier` in your project to ensure it's available.

### "Cannot find module" in ts-morph

- Point `tsConfigFilePath` in your config to the correct `tsconfig.json`.

### Types are being excluded that I want to keep

- Check `excludeTypes` — remove the type name from the list.
- Verify the type is not tagged `@type-bridge-ignore`.

### SDK routes are not detected

- TypeBridge uses a regex to detect `app.get(...)` / `router.post(...)` patterns.
- Routes must be in files matched by `input` / `include`.
- Dynamic route registrations (loops, factories) are **not** supported.

---

## Roadmap

- [ ] VSCode extension with hover diagnostics ("type out of sync")
- [ ] Zod schema generation from extracted types
- [ ] OpenAPI / Swagger spec generation
- [ ] GraphQL schema generation
- [ ] Route annotation comments (`// @type-bridge body: CreateUserDTO → response: UserResponse`)
- [ ] Monorepo auto-detection (Turborepo, Nx)
- [ ] Incremental rebuild cache (skip unchanged files)
- [ ] GitHub Action for CI staleness checks

---

## License

MIT
