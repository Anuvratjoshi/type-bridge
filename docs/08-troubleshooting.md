# Troubleshooting & FAQ

---

## Diagnosing issues quickly

Before diving into the sections below, run:

```bash
npx @joshianuvrat/type-bridge info
```

This prints the fully-resolved config. Verify that `input`, `outDir`,
`include`, and `exclude` are exactly what you expect.

---

## Common problems

### "No declarations to generate"

**Symptom:**

```
[TypeBridge] ⚠  No declarations to generate. Output directory is empty.
```

**Causes and fixes:**

| Cause                                           | Fix                                                                                                       |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `input` path does not exist                     | Check the path is relative to `cwd` (which defaults to where you run the command). Use `--cwd` if needed. |
| No files match `include` patterns               | The defaults only match `**/*.ts`. If your files are `.tsx` add `"**/*.tsx"` to `include`.                |
| All matching declarations are non-exported      | Make sure your types/interfaces use `export`. TypeBridge only processes exported declarations.            |
| All declarations are filtered by `excludeTypes` | Run `type-bridge info` to see your `excludeTypes` list.                                                   |
| All files match `exclude` patterns              | Your file name (e.g. `user.dto.ts`) may accidentally match an `exclude` glob.                             |

---

### "Found X declarations but 0 after transformation"

All extracted declarations were dropped by the Transformer.  
Check these config keys:

```bash
npx @joshianuvrat/type-bridge info | grep -E '"excludeTypes|excludeFields"'
```

Common causes:

- The type name exactly matches an entry in `excludeTypes` (e.g. your type is named `Response` or `Model`)
- Every property in every interface is in `excludeFields`

---

### Generated types are outdated / stale

TypeBridge always regenerates from scratch (unless `cleanOutput: false`).

If stale files remain:

1. Confirm `cleanOutput: true` (default) in your config
2. Delete the `outDir` manually and re-run: `npx @joshianuvrat/type-bridge generate`

To prevent stale files in CI, add a type-generation step before your type-check:

```yaml
- run: npx @joshianuvrat/type-bridge generate --no-prettier
- run: npx tsc --noEmit
```

---

### `SyntaxError: Cannot use import statement outside a module`

**Cause:** You are using `type-bridge.config.ts` but `ts-node` or `tsx` is not
installed in the repo.

**Fix:** Install `tsx` (ESM-safe) or `ts-node`:

```bash
npm install --save-dev tsx
```

Or switch to a JSON config:

```json
// .typebridgerc.json
{
  "input": "backend/src",
  "outDir": "frontend/src/types/generated"
}
```

---

### `Cannot find module 'type-bridge'` in config file

The config file imports from `"@joshianuvrat/type-bridge"` for the type annotation:

```ts
import type { TypeBridgeConfig } from "@joshianuvrat/type-bridge";
```

If TypeBridge is not yet installed, the import fails.

**Fix:** Install TypeBridge first, then create the config:

```bash
npm install --save-dev @joshianuvrat/type-bridge
```

---

### Prettier errors on generated files

TypeBridge catches Prettier errors internally and falls back to unformatted
output — it will **never** crash because of a formatting failure.

If you see formatting issues:

1. Ensure Prettier is installed: `npm install --save-dev prettier`
2. Add a `.prettierrc` if you want consistent formatting
3. Or disable formatting entirely: `prettier: false`

---

### ts-morph `Cannot find module` errors for backend imports

**Cause:** The backend uses path aliases or a non-standard tsconfig.

**Fix:** Point TypeBridge to the backend's tsconfig:

```ts
// type-bridge.config.ts
tsConfigFilePath: "backend/tsconfig.json";
```

---

### Watch mode re-runs forever / feedback loop

**Cause:** `outDir` is inside a directory that `input` also watches.

**Fix:** Ensure `outDir` is not inside your `input` directory. TypeBridge
already ignores the `outDir` internally, but if the paths overlap in a
surprising way (e.g. both inside `src/`) you may see loops.

```ts
// ✓ Safe — completely separate directories
input:  "backend/src",
outDir: "frontend/src/types/generated",

// ✗ Dangerous — outDir inside input
input:  "src",
outDir: "src/generated",
```

---

### SDK routes not being detected

TypeBridge uses a simple regex. Routes must be registered as:

```ts
app.get("/path", handler);
router.post("/path", handler);
```

Routes registered via loops, factory functions, or frameworks other than
Express are **not** detected. If you use NestJS decorators, see the
[programmatic API](./04-api.md) for building a custom extractor.

---

### Generated files contain `@ts-ignore` or type errors

TypeBridge emits the raw `typeText` from ts-morph. If a type references another
type that is not in the generated output (because it was excluded), the
frontend might see an unresolved reference.

**Fix:** Either include the missing type in the generation, or add
`@type-bridge-ignore` to the type that references it to exclude both.

---

## FAQ

### Q: Should I commit generated files?

**No.** Treat them like compiled output. Add the `outDir` to `.gitignore` and
regenerate in CI before type-checking.

```
# .gitignore
frontend/src/types/generated/
```

---

### Q: Can I use TypeBridge without a config file?

No. At minimum you need to tell TypeBridge where to find your backend types
(`input`) and where to write the output (`outDir`). Both have defaults, but
the defaults are unlikely to match your project layout.

The quickest config is via `package.json`:

```json
{
  "type-bridge": {
    "input": "src/server",
    "outDir": "src/client/types"
  }
}
```

---

### Q: Do I need to run TypeBridge before `tsc`?

Yes. TypeBridge is a **build-time** code generator. The frontend's `tsconfig`
will complain about missing generated files if you run `tsc` before TypeBridge.

Recommended order:

```bash
type-bridge generate && tsc --noEmit
```

---

### Q: Can I use TypeBridge with JavaScript (non-TS) frontends?

TypeBridge generates TypeScript `.ts` files. For a JavaScript frontend you have
two options:

1. Use the generated files as **JSDoc type annotations** with `// @ts-check`
2. Compile the generated `.ts` files to `.d.ts` declaration files and import
   the declarations:

```bash
tsc --declaration --emitDeclarationOnly --outDir frontend/src/types/generated
```

---

### Q: How do I handle a type that exists in both frontend and backend but means different things?

Add the backend version to `excludeTypes` and define the frontend version
manually. TypeBridge will not touch your manual file since `cleanOutput` only
deletes files it previously wrote (files with the TypeBridge hash header).

Actually — by default `cleanOutput: true` deletes everything in `outDir`. To
keep a manual file alongside generated ones:

1. Place your manual type in a **different** directory (e.g. `src/types/manual/`)
2. Import from both directories in your barrel:

```ts
// src/types/index.ts
export * from "./generated";
export * from "./manual";
```

---

### Q: Is TypeBridge safe to run in parallel across multiple services?

Yes — each TypeBridge run is fully independent. As long as each service writes
to a different `outDir`, there is no shared state.

---

### Q: What version of TypeScript is supported?

TypeBridge requires TypeScript **≥ 4.0** in the consuming project (via ts-morph).
The generated output targets **ES2020** syntax (no special syntax beyond
standard TypeScript interfaces and types).

---

## Still stuck?

1. Run `npx @joshianuvrat/type-bridge info` and verify the resolved config
2. Check the [Edge Cases](./06-edge-cases.md) guide
3. Add `@type-bridge-ignore` to any declaration causing issues and file a bug
4. Open an issue with:
   - Your TypeBridge version (`npx @joshianuvrat/type-bridge --version`)
   - Your resolved config (`npx @joshianuvrat/type-bridge info`)
   - The backend type that causes the problem
