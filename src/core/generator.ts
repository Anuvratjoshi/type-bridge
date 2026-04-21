import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { TypeBridgeConfig } from "../config/schema";
import type { TransformedDeclaration } from "../types";
import { formatWithPrettier } from "../utils/prettier";
import { logger } from "../utils/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface GeneratorOptions {
  config: TypeBridgeConfig;
  cwd?: string;
}

/**
 * Write transformed declarations to disk.
 *
 * Strategy:
 *   - Group declarations by their source file basename
 *   - Write one output file per source file group
 *   - Write a root `index.ts` that re-exports everything
 *
 * Returns the list of absolute paths of written files.
 */
export async function runGenerator(
  declarations: TransformedDeclaration[],
  options: GeneratorOptions,
): Promise<string[]> {
  const { config, cwd = process.cwd() } = options;
  const outDir = path.resolve(cwd, config.outDir);

  // Clean output directory if configured
  if (config.cleanOutput && fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outDir, { recursive: true });

  if (declarations.length === 0) {
    logger.warn("No declarations to generate. Output directory is empty.");
    return [];
  }

  // Group declarations by source file
  const groups = groupBySourceFile(declarations);

  const writtenFiles: string[] = [];

  for (const [sourceFile, decls] of groups.entries()) {
    const outputFileName = sourceFileToOutputName(sourceFile);
    const outputPath = path.join(outDir, outputFileName);
    const content = buildFileContent(decls, config, sourceFile);
    await writeFile(outputPath, content, config);
    writtenFiles.push(outputPath);
    logger.info(`  Generated: ${path.relative(cwd, outputPath)}`);
  }

  // Write barrel index.ts
  const indexPath = path.join(outDir, "index.ts");
  const indexContent = buildIndexFile(writtenFiles, outDir, config);
  await writeFile(indexPath, indexContent, config);
  writtenFiles.push(indexPath);

  return writtenFiles;
}

// ─────────────────────────────────────────────────────────────────────────────
// Grouping
// ─────────────────────────────────────────────────────────────────────────────

function groupBySourceFile(
  declarations: TransformedDeclaration[],
): Map<string, TransformedDeclaration[]> {
  const map = new Map<string, TransformedDeclaration[]>();

  for (const decl of declarations) {
    const key = decl.sourceFile;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(decl);
  }

  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// File content builders
// ─────────────────────────────────────────────────────────────────────────────

function buildFileContent(
  decls: TransformedDeclaration[],
  config: TypeBridgeConfig,
  sourceFile: string,
): string {
  const lines: string[] = [];

  // Header banner
  const hash = computeHash(decls.map((d) => d.typeText).join(""));
  lines.push(buildBanner(sourceFile, hash, config, undefined));

  for (const decl of decls) {
    if (decl.jsDoc) {
      lines.push(decl.jsDoc);
    }
    lines.push(decl.typeText);
    lines.push("");
  }

  return lines.join("\n");
}

function buildIndexFile(
  writtenFiles: string[],
  _outDir: string,
  config: TypeBridgeConfig,
): string {
  const lines: string[] = [];

  if (config.addHashHeader) {
    lines.push(
      "// ─────────────────────────────────────────────────────────────────────────────",
    );
    lines.push("// type-bridge \u2014 generated index");
    lines.push(
      "// Do NOT edit manually. Re-run `type-bridge generate` to refresh.",
    );
    lines.push(
      "// ─────────────────────────────────────────────────────────────────────────────",
    );
    lines.push("");
  }

  for (const file of writtenFiles) {
    const basename = path.basename(file, ".ts");
    if (basename === "index") continue;
    lines.push(`export * from "./${basename}";`);
  }

  return lines.join("\n") + "\n";
}

function buildBanner(
  sourceFile: string,
  hash: string,
  config: TypeBridgeConfig,
  _outDir?: string,
): string {
  if (!config.addHashHeader) return "";

  return [
    "// ─────────────────────────────────────────────────────────────────────────────",
    `// type-bridge \u2014 generated from: ${path.basename(sourceFile)}`,
    `// Hash: ${hash}`,
    "// Do NOT edit manually. Re-run `type-bridge generate` to refresh.",
    "// ─────────────────────────────────────────────────────────────────────────────",
    "",
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// File I/O
// ─────────────────────────────────────────────────────────────────────────────

async function writeFile(
  filePath: string,
  content: string,
  config: TypeBridgeConfig,
): Promise<void> {
  let finalContent = content;

  if (config.prettier) {
    finalContent = await formatWithPrettier(content, filePath);
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, finalContent, "utf-8");
}

// ─────────────────────────────────────────────────────────────────────────────
// Hash utility (for staleness detection)
// ─────────────────────────────────────────────────────────────────────────────

export function computeHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 12);
}

// ─────────────────────────────────────────────────────────────────────────────
// Filename derivation
// ─────────────────────────────────────────────────────────────────────────────

function sourceFileToOutputName(sourceFile: string): string {
  // e.g.  /backend/src/models/User.ts  →  User.ts
  const base = path.basename(sourceFile, ".ts");
  return `${base}.ts`;
}
