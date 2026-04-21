# Programmatic API

You can use TypeBridge as a Node.js library instead of (or alongside) the CLI.
This is useful for custom build scripts, Gulp/Grunt tasks, or embedding
TypeBridge into your own tooling.

All public functions are exported from the root `"@joshianuvrat/type-bridge"` package:

```ts
import {
  loadConfig,
  runExtractor,
  runTransformer,
  runGenerator,
  runPipeline,
} from "@joshianuvrat/type-bridge";
```

---

## `loadConfig(cwd?)`

Finds, loads, and validates the type-bridge config file for the given directory,
then merges it with the built-in defaults.

```ts
async function loadConfig(cwd?: string): Promise<TypeBridgeConfig>;
```

| Parameter | Type     | Default         | Description                             |
| --------- | -------- | --------------- | --------------------------------------- |
| `cwd`     | `string` | `process.cwd()` | Directory to search for the config file |

**Returns:** The fully merged `TypeBridgeConfig` object.

**Throws:** If the config file is found but contains invalid options.

### Example

```ts
import { loadConfig } from "@joshianuvrat/type-bridge";

const config = await loadConfig("/path/to/my-project");

console.log(config.input); // "backend/src"
console.log(config.outDir); // "frontend/src/types/generated"
```

### Overriding options at runtime

`loadConfig` returns a plain object — you can mutate it before passing it to
the pipeline:

```ts
const config = await loadConfig();

// Force SDK generation for this programmatic run only
config.generateSDK = true;
config.outDir = "dist/types";

await runPipeline({ config });
```

---

## `runExtractor(options)`

Parses all TypeScript source files matched by the config and returns raw AST
metadata for every exported declaration.

```ts
async function runExtractor(
  options: ExtractorOptions,
): Promise<ExtractedFile[]>;

interface ExtractorOptions {
  config: TypeBridgeConfig;
  cwd?: string; // defaults to process.cwd()
}
```

**Returns:** `ExtractedFile[]` — one entry per source file that contained at
least one exported declaration.

```ts
interface ExtractedFile {
  filePath: string;
  declarations: ExtractedDeclaration[];
}

interface ExtractedDeclaration {
  kind: "interface" | "typeAlias" | "enum" | "class" | "function";
  name: string;
  typeParameters?: string; // e.g. "<T, U extends string>"
  typeText: string; // full original source text
  properties?: TypeProperty[];
  enumMembers?: EnumMember[];
  heritage?: string[];
  sourceFile: string;
  jsDoc?: string;
  ignored: boolean; // true when tagged @type-bridge-ignore
}
```

### Example — inspect raw extracted data

```ts
import { loadConfig, runExtractor } from "@joshianuvrat/type-bridge";

const config = await loadConfig();
const files = await runExtractor({ config });

for (const file of files) {
  console.log(`\n=== ${file.filePath} ===`);

  for (const decl of file.declarations) {
    console.log(`  [${decl.kind}] ${decl.name}${decl.typeParameters ?? ""}`);

    if (decl.properties) {
      for (const prop of decl.properties) {
        console.log(
          `    ${prop.isOptional ? "?" : " "} ${prop.name}: ${prop.typeText}`,
        );
      }
    }

    if (decl.enumMembers) {
      for (const member of decl.enumMembers) {
        console.log(`    ${member.name} = ${JSON.stringify(member.value)}`);
      }
    }
  }
}
```

Sample output:

```
=== /app/backend/src/models/user.model.ts ===
  [interface] IUser
      _id: Types.ObjectId
      name: string
      email: string
      password: string
    ? role: "admin" | "user"
      createdAt: Date
```

---

## `runTransformer(extractedFiles, options)`

Converts raw `ExtractedFile[]` into frontend-safe `TransformedDeclaration[]`.

```ts
function runTransformer(
  extractedFiles: ExtractedFile[],
  options: TransformerOptions,
): TransformedDeclaration[];

interface TransformerOptions {
  config: TypeBridgeConfig;
}

interface TransformedDeclaration {
  kind: "interface" | "typeAlias" | "enum" | "class" | "function";
  name: string;
  typeParameters?: string;
  typeText: string; // clean, frontend-ready TypeScript text
  jsDoc?: string;
  sourceFile: string;
}
```

### Example — log the transformation delta

```ts
import {
  loadConfig,
  runExtractor,
  runTransformer,
} from "@joshianuvrat/type-bridge";

const config = await loadConfig();
const files = await runExtractor({ config });
const results = runTransformer(files, { config });

console.log(
  `Extracted: ${files.flatMap((f) => f.declarations).length} declarations`,
);
console.log(`After transform: ${results.length} declarations`);

for (const decl of results) {
  console.log(`\n// ${decl.sourceFile}`);
  console.log(decl.typeText);
}
```

Sample output:

```
Extracted: 6 declarations
After transform: 4 declarations   ← 2 backend-only types stripped

// /app/backend/src/models/user.model.ts
export interface IUser {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  createdAt: string;
}
```

---

## `runGenerator(declarations, options)`

Writes transformed declarations to disk.

```ts
async function runGenerator(
  declarations: TransformedDeclaration[],
  options: GeneratorOptions,
): Promise<string[]>;

interface GeneratorOptions {
  config: TypeBridgeConfig;
  cwd?: string; // defaults to process.cwd()
}
```

**Returns:** `string[]` — absolute paths of every file written (type files
**and** the barrel `index.ts`).

### Example

```ts
import {
  loadConfig,
  runExtractor,
  runTransformer,
  runGenerator,
} from "@joshianuvrat/type-bridge";

const config = await loadConfig();
const extracted = await runExtractor({ config });
const transformed = runTransformer(extracted, { config });
const writtenFiles = await runGenerator(transformed, { config });

console.log("Wrote:");
for (const file of writtenFiles) {
  console.log(" ", file);
}
// Wrote:
//   /app/frontend/src/types/generated/user.model.ts
//   /app/frontend/src/types/generated/auth.dto.ts
//   /app/frontend/src/types/generated/index.ts
```

---

## `runPipeline(options)`

Convenience function that runs all three stages in sequence. This is what the
CLI calls internally.

```ts
async function runPipeline(options: PipelineOptions): Promise<PipelineResult>;

interface PipelineOptions {
  config: TypeBridgeConfig;
  cwd?: string;
}

interface PipelineResult {
  extractedFiles: ExtractedFile[];
  transformedDeclarations: TransformedDeclaration[];
  generatedFiles: string[];
  sdkFile?: string; // present when generateSDK: true
  durationMs: number;
}
```

### Basic usage

```ts
import { loadConfig, runPipeline } from "@joshianuvrat/type-bridge";

const config = await loadConfig();
const result = await runPipeline({ config });

console.log(`Done in ${result.durationMs}ms`);
console.log(`Written files: ${result.generatedFiles.length}`);
```

### Usage in a custom build script

```ts
// scripts/generate-types.ts
import { loadConfig, runPipeline } from "@joshianuvrat/type-bridge";
import path from "path";

async function main() {
  const root = path.resolve(__dirname, "..");
  const config = await loadConfig(root);

  // Adjust output for the current environment
  if (process.env.NODE_ENV === "production") {
    config.prettier = false; // skip formatting in CI for speed
    config.addHashHeader = true; // always add hash in production
  }

  const result = await runPipeline({ config, cwd: root });

  if (result.generatedFiles.length === 0) {
    console.error("No files generated. Check your `input` path.");
    process.exit(1);
  }

  console.log(`✔ Generated ${result.generatedFiles.length} files.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Run it:

```bash
npx ts-node scripts/generate-types.ts
```

---

## Using individual stages selectively

You can mix-and-match the stages. For example, you might want to extract and
inspect types **without** writing any files:

```ts
import {
  loadConfig,
  runExtractor,
  runTransformer,
} from "@joshianuvrat/type-bridge";

const config = await loadConfig();
const extracted = await runExtractor({ config });
const transformed = runTransformer(extracted, { config });

// Custom output — write to a database, send over a socket, etc.
const typeMap = Object.fromEntries(
  transformed.map((d) => [d.name, d.typeText]),
);

console.log(JSON.stringify(typeMap, null, 2));
// {
//   "IUser": "export interface IUser { _id: string; name: string; ... }",
//   "CreateUserDTO": "export interface CreateUserDTO { ... }"
// }
```

---

## TypeBridge types reference

All types used by the API are exported from the root package:

```ts
import type {
  TypeBridgeConfig,
  ExtractedFile,
  ExtractedDeclaration,
  TransformedDeclaration,
  TypeProperty,
  EnumMember,
  PipelineResult,
  DeclarationKind,
  RouteInfo,
  HttpMethod,
} from "@joshianuvrat/type-bridge";
```
