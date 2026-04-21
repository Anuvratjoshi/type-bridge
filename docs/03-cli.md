# CLI Reference

TypeBridge ships a single binary: `type-bridge`.

```bash
npx type-bridge <command> [options]
```

---

## Global flags

| Flag | Description |
|---|---|
| `-v, --version` | Print the installed TypeBridge version |
| `-h, --help` | Show help for any command |

```bash
npx type-bridge --version
# 1.0.0

npx type-bridge generate --help
```

---

## `type-bridge generate`

**Alias:** `type-bridge gen`

Runs the full Extract → Transform → Generate pipeline once and exits.

```bash
npx type-bridge generate [options]
```

### Options

| Flag | Type | Default | Description |
|---|---|---|---|
| `--cwd <path>` | string | `process.cwd()` | Set the working directory (where config is searched) |
| `--outDir <path>` | string | from config | Override the output directory |
| `--sdk` | boolean flag | `false` | Enable SDK generation for this run |
| `--no-clean` | boolean flag | — | Skip cleaning `outDir` before writing |
| `--no-prettier` | boolean flag | — | Skip Prettier formatting |
| `--config <path>` | string | auto-detected | Path to a specific config file |

### Examples

**Basic usage — uses `type-bridge.config.ts` in the current directory:**

```bash
npx type-bridge generate
```

**Override the output directory without editing the config:**

```bash
npx type-bridge generate --outDir src/types/api
```

**Generate types AND a typed SDK client in one command:**

```bash
npx type-bridge generate --sdk
```

**Run from a different working directory (monorepo root targeting a package):**

```bash
npx type-bridge generate --cwd packages/api
```

**Fast CI run — skip Prettier to save time:**

```bash
npx type-bridge generate --no-prettier
```

**Incremental run — keep existing files, only add new ones:**

```bash
npx type-bridge generate --no-clean
```

**Use a non-standard config file path:**

```bash
npx type-bridge generate --config ./config/type-bridge.prod.ts
```

### Console output

```
[TypeBridge] Extracting types…
  Found 5 declaration(s) across 3 file(s).

[TypeBridge] Transforming…
  5 declaration(s) after transformation.

[TypeBridge] Generating output files…
  Generated: frontend/src/types/generated/user.model.ts
  Generated: frontend/src/types/generated/post.model.ts
  Generated: frontend/src/types/generated/auth.dto.ts

[TypeBridge] ✔ Done in 389ms — 4 file(s) written.
```

---

## `type-bridge watch`

Watches your backend source directory and automatically re-runs `generate`
whenever a file changes.

```bash
npx type-bridge watch [options]
```

### Options

| Flag | Type | Default | Description |
|---|---|---|---|
| `--cwd <path>` | string | `process.cwd()` | Set the working directory |
| `--outDir <path>` | string | from config | Override the output directory |
| `--sdk` | boolean flag | `false` | Enable SDK generation on each rebuild |

### Behaviour

- Runs one full pipeline pass **immediately on startup**
- Debounces for **300 ms** before each rebuild (batches rapid saves)
- If a rebuild is in progress when a new change fires, **queues one more run**
  after the current one finishes — never drops a change
- Ignores `outDir` to prevent feedback loops
- Handles `SIGINT` / `SIGTERM` (Ctrl + C) gracefully

### Examples

**Standard watch — rebuild on any change:**

```bash
npx type-bridge watch
```

**Watch in a monorepo sub-package:**

```bash
npx type-bridge watch --cwd packages/api
```

**Watch with SDK generation:**

```bash
npx type-bridge watch --sdk
```

### Console output (live session)

```
[TypeBridge] ◉ Watching: /home/user/myapp/backend/src
  Press Ctrl+C to stop.

[TypeBridge] Extracting types…
  Found 3 declaration(s) across 2 file(s).
[TypeBridge] ✔ Done in 301ms — 3 file(s) written.

[TypeBridge] ◉ Changed: backend/src/models/user.model.ts
[TypeBridge] Extracting types…
  Found 4 declaration(s) across 2 file(s).
[TypeBridge] ✔ Done in 278ms — 3 file(s) written.

^C
  Stopping watcher…
```

---

## `type-bridge info`

Prints the **fully-resolved, merged configuration** as JSON and exits.
Nothing is generated. Use this to verify your config is being picked up
correctly.

```bash
npx type-bridge info [options]
```

### Options

| Flag | Type | Default | Description |
|---|---|---|---|
| `--cwd <path>` | string | `process.cwd()` | Directory to search for config |

### Examples

**Check resolved config in the current directory:**

```bash
npx type-bridge info
```

**Check config for a sub-package:**

```bash
npx type-bridge info --cwd packages/users-service
```

### Console output

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

---

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Error (config invalid, no files found, unexpected exception) |

---

## Using TypeBridge in npm scripts

```jsonc
// package.json
{
  "scripts": {
    // Run once (production build step)
    "types:generate": "type-bridge generate",

    // Run with watch during development
    "types:watch": "type-bridge watch",

    // Hooks — auto-generate before build / type-check
    "prebuild":   "type-bridge generate",
    "precheck":   "type-bridge generate",

    // Combined dev server
    "dev": "concurrently \"type-bridge watch\" \"vite\""
  }
}
```
