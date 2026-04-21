import {
  Project,
  SourceFile,
  InterfaceDeclaration,
  TypeAliasDeclaration,
  EnumDeclaration,
  ClassDeclaration,
  FunctionDeclaration,
  SyntaxKind,
  ts,
} from "ts-morph";
import path from "path";
import { glob } from "glob";
import type { TypeBridgeConfig } from "../config/schema";
import type {
  ExtractedFile,
  ExtractedDeclaration,
  TypeProperty,
  EnumMember,
  DeclarationKind,
} from "../types";

const IGNORE_TAG = "@type-bridge-ignore";

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtractorOptions {
  config: TypeBridgeConfig;
  /** Absolute working directory (defaults to process.cwd()) */
  cwd?: string;
}

/**
 * Run the extractor over all source files matched by `config.input` and
 * `config.include` / `config.exclude` patterns.
 *
 * Returns one `ExtractedFile` per source file that contained at least one
 * exportable declaration.
 */
export async function runExtractor(
  options: ExtractorOptions
): Promise<ExtractedFile[]> {
  const { config, cwd = process.cwd() } = options;

  const sourceFilePaths = await resolveSourceFiles(config, cwd);

  if (sourceFilePaths.length === 0) {
    return [];
  }

  const project = buildProject(config, cwd, sourceFilePaths);
  const results: ExtractedFile[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const declarations = extractFromFile(sourceFile, config);
    if (declarations.length > 0) {
      results.push({
        filePath: sourceFile.getFilePath(),
        declarations,
      });
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// File resolution
// ─────────────────────────────────────────────────────────────────────────────

async function resolveSourceFiles(
  config: TypeBridgeConfig,
  cwd: string
): Promise<string[]> {
  const inputs = Array.isArray(config.input) ? config.input : [config.input];
  const allFiles = new Set<string>();

  for (const inputPattern of inputs) {
    const baseDir = path.resolve(cwd, inputPattern);

    for (const includeGlob of config.include) {
      const matches = await glob(includeGlob, {
        cwd: baseDir,
        absolute: true,
        ignore: config.exclude,
        nodir: true,
      });
      matches.forEach((f) => allFiles.add(f));
    }
  }

  return [...allFiles];
}

function buildProject(
  config: TypeBridgeConfig,
  cwd: string,
  filePaths: string[]
): Project {
  const tsConfigPath = config.tsConfigFilePath
    ? path.resolve(cwd, config.tsConfigFilePath)
    : findTsConfig(cwd);

  const project = new Project({
    tsConfigFilePath: tsConfigPath ?? undefined,
    skipAddingFilesFromTsConfig: true,
    compilerOptions: tsConfigPath
      ? undefined
      : {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.CommonJS,
          strict: true,
          esModuleInterop: true,
        },
  });

  project.addSourceFilesAtPaths(filePaths);
  return project;
}

function findTsConfig(cwd: string): string | null {
  const candidate = path.join(cwd, "tsconfig.json");
  try {
    require("fs").accessSync(candidate);
    return candidate;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-file extraction
// ─────────────────────────────────────────────────────────────────────────────

function extractFromFile(
  sourceFile: SourceFile,
  config: TypeBridgeConfig
): ExtractedDeclaration[] {
  const declarations: ExtractedDeclaration[] = [];

  // Interfaces
  for (const decl of sourceFile.getInterfaces()) {
    if (!isExported(decl)) continue;
    declarations.push(extractInterface(decl, sourceFile, config));
  }

  // Type aliases
  for (const decl of sourceFile.getTypeAliases()) {
    if (!isExported(decl)) continue;
    declarations.push(extractTypeAlias(decl, sourceFile, config));
  }

  // Enums
  for (const decl of sourceFile.getEnums()) {
    if (!isExported(decl)) continue;
    declarations.push(extractEnum(decl, sourceFile));
  }

  // Classes (data-only — we strip methods)
  for (const decl of sourceFile.getClasses()) {
    if (!isExported(decl)) continue;
    declarations.push(extractClass(decl, sourceFile, config));
  }

  return declarations;
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual declaration extractors
// ─────────────────────────────────────────────────────────────────────────────

function extractInterface(
  decl: InterfaceDeclaration,
  sourceFile: SourceFile,
  _config: TypeBridgeConfig
): ExtractedDeclaration {
  const jsDoc = getJsDoc(decl);
  const ignored = jsDoc?.includes(IGNORE_TAG) ?? false;

  const properties = decl.getProperties().map((prop): TypeProperty => {
    const propJsDoc = prop
      .getJsDocs()
      .map((d) => d.getDescription().trim())
      .join("\n");
    return {
      name: prop.getName(),
      typeText: prop.getTypeNode()?.getText() ?? prop.getType().getText(),
      isOptional: prop.hasQuestionToken(),
      isReadonly: prop.isReadonly(),
      jsDoc: propJsDoc || undefined,
    };
  });

  return {
    kind: "interface" as DeclarationKind,
    name: decl.getName(),
    typeParameters: typeParamsText(decl),
    typeText: decl.getText(),
    properties,
    heritage: getHeritage(decl),
    sourceFile: sourceFile.getFilePath(),
    jsDoc,
    ignored,
  };
}

function extractTypeAlias(
  decl: TypeAliasDeclaration,
  sourceFile: SourceFile,
  _config: TypeBridgeConfig
): ExtractedDeclaration {
  const jsDoc = getJsDoc(decl);
  const ignored = jsDoc?.includes(IGNORE_TAG) ?? false;

  return {
    kind: "typeAlias" as DeclarationKind,
    name: decl.getName(),
    typeParameters: typeParamsText(decl),
    typeText: decl.getText(),
    sourceFile: sourceFile.getFilePath(),
    jsDoc,
    ignored,
  };
}

function extractEnum(
  decl: EnumDeclaration,
  sourceFile: SourceFile
): ExtractedDeclaration {
  const jsDoc = getJsDoc(decl);
  const ignored = jsDoc?.includes(IGNORE_TAG) ?? false;

  const enumMembers: EnumMember[] = decl.getMembers().map((m): EnumMember => {
    const val = m.getValue();
    return {
      name: m.getName(),
      value: val !== undefined ? val : m.getName(),
    };
  });

  return {
    kind: "enum" as DeclarationKind,
    name: decl.getName(),
    typeText: decl.getText(),
    enumMembers,
    sourceFile: sourceFile.getFilePath(),
    jsDoc,
    ignored,
  };
}

function extractClass(
  decl: ClassDeclaration,
  sourceFile: SourceFile,
  _config: TypeBridgeConfig
): ExtractedDeclaration {
  const jsDoc = getJsDoc(decl);
  const ignored = jsDoc?.includes(IGNORE_TAG) ?? false;

  // Use getChildrenOfKind(PropertyDeclaration) to get a strongly-typed list
  // of instance property declarations only (no methods, no accessors).
  const properties = decl
    .getChildrenOfKind(SyntaxKind.PropertyDeclaration)
    .filter((p) => !p.isStatic())
    .map((p): TypeProperty => {
      const propJsDoc = p
        .getJsDocs()
        .map((d) => d.getDescription().trim())
        .join("\n");
      return {
        name: p.getName(),
        typeText: p.getTypeNode()?.getText() ?? p.getType().getText(),
        isOptional: p.hasQuestionToken(),
        isReadonly: p.isReadonly(),
        jsDoc: propJsDoc || undefined,
      };
    });

  const baseClass = decl.getBaseClass();
  const heritage = baseClass ? [baseClass.getName() ?? ""] : [];

  return {
    kind: "class" as DeclarationKind,
    name: decl.getName() ?? "Anonymous",
    typeParameters: typeParamsText(decl),
    typeText: decl.getText(),
    properties,
    heritage,
    sourceFile: sourceFile.getFilePath(),
    jsDoc,
    ignored,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isExported(
  decl:
    | InterfaceDeclaration
    | TypeAliasDeclaration
    | EnumDeclaration
    | ClassDeclaration
    | FunctionDeclaration
): boolean {
  return decl.isExported();
}

function getJsDoc(
  decl:
    | InterfaceDeclaration
    | TypeAliasDeclaration
    | EnumDeclaration
    | ClassDeclaration
): string | undefined {
  const docs = decl.getJsDocs();
  if (docs.length === 0) return undefined;
  return docs
    .map((d) => d.getFullText().trim())
    .join("\n");
}

function typeParamsText(
  decl:
    | InterfaceDeclaration
    | TypeAliasDeclaration
    | ClassDeclaration
): string | undefined {
  const params = decl.getTypeParameters();
  if (params.length === 0) return undefined;
  return `<${params.map((p) => p.getText()).join(", ")}>`;
}

function getHeritage(decl: InterfaceDeclaration): string[] {
  return decl
    .getBaseDeclarations()
    .map((b) => ("getName" in b ? b.getName() ?? "" : ""))
    .filter(Boolean);
}
