import type { TypeBridgeConfig } from "../config/schema";
import type {
  ExtractedFile,
  ExtractedDeclaration,
  TransformedDeclaration,
  TypeProperty,
} from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Backend-only type patterns — always stripped regardless of user config
// ─────────────────────────────────────────────────────────────────────────────

// Reserved for future import-source filtering
// const BACKEND_ONLY_IMPORT_SOURCES = new Set([...])

// Regex patterns for backend-only type names
const BACKEND_ONLY_TYPE_PATTERNS: RegExp[] = [
  /^Document(<.*>)?$/, // Mongoose Document
  /^Model(<.*>)?$/, // Mongoose Model
  /^Schema(<.*>)?$/, // Mongoose Schema
  /^Request(<.*>)?$/, // Express Request
  /^Response(<.*>)?$/, // Express Response
  /^NextFunction$/, // Express NextFunction
  /^Repository(<.*>)?$/, // TypeORM Repository
  /^DataSource$/, // TypeORM DataSource
  /^EntityManager$/, // TypeORM EntityManager
];

// Field names that should never appear in frontend types (security)
const ALWAYS_EXCLUDED_FIELDS = new Set([
  "__v",
  "__t",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface TransformerOptions {
  config: TypeBridgeConfig;
}

/**
 * Transform raw extracted declarations into frontend-safe type declarations.
 *
 * Pipeline per declaration:
 *   1. Skip @type-bridge-ignore
 *   2. Skip declarations whose names match backend-only / user-excluded patterns
 *   3. Strip excluded fields from properties
 *   4. Resolve Date → string (unless preserveDate)
 *   5. Convert enums → union types (unless preserveEnums)
 *   6. Emit clean typeText
 */
export function runTransformer(
  extractedFiles: ExtractedFile[],
  options: TransformerOptions
): TransformedDeclaration[] {
  const { config } = options;
  const allDeclarations = extractedFiles.flatMap((f) => f.declarations);
  const transformed: TransformedDeclaration[] = [];

  for (const decl of allDeclarations) {
    const result = transformDeclaration(decl, config);
    if (result !== null) {
      transformed.push(result);
    }
  }

  return transformed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-declaration transformation
// ─────────────────────────────────────────────────────────────────────────────

function transformDeclaration(
  decl: ExtractedDeclaration,
  config: TypeBridgeConfig
): TransformedDeclaration | null {
  // 1. Explicit ignore tag
  if (decl.ignored) return null;

  // 2. Backend-only type name check
  if (isBackendOnlyType(decl.name, config)) return null;

  switch (decl.kind) {
    case "interface":
      return transformInterface(decl, config);
    case "typeAlias":
      return transformTypeAlias(decl, config);
    case "enum":
      return transformEnum(decl, config);
    case "class":
      return transformClass(decl, config);
    default:
      return null;
  }
}

// ─── Interface ───────────────────────────────────────────────────────────────

function transformInterface(
  decl: ExtractedDeclaration,
  config: TypeBridgeConfig
): TransformedDeclaration {
  const props = (decl.properties ?? [])
    .filter((p) => !isExcludedField(p.name, config))
    .map((p) => transformProperty(p, config));

  // Build heritage (extends clause) removing backend-only bases
  const cleanHeritage = (decl.heritage ?? []).filter(
    (h) => !isBackendOnlyType(h, config)
  );

  const extendsClause =
    cleanHeritage.length > 0 ? ` extends ${cleanHeritage.join(", ")}` : "";
  const typeParams = decl.typeParameters ?? "";

  const body =
    props.length > 0
      ? `{\n${props.map((p) => `  ${p}`).join("\n")}\n}`
      : "{}";

  const typeText = `export interface ${decl.name}${typeParams}${extendsClause} ${body}`;

  return {
    kind: "interface",
    name: decl.name,
    typeParameters: decl.typeParameters,
    typeText,
    jsDoc: decl.jsDoc,
    sourceFile: decl.sourceFile,
  };
}

// ─── Type alias ──────────────────────────────────────────────────────────────

function transformTypeAlias(
  decl: ExtractedDeclaration,
  config: TypeBridgeConfig
): TransformedDeclaration {
  // Apply Date / field transformations on the raw text
  let typeText = decl.typeText;
  typeText = applyDateTransform(typeText, config);
  typeText = ensureExported(typeText);

  return {
    kind: "typeAlias",
    name: decl.name,
    typeParameters: decl.typeParameters,
    typeText,
    jsDoc: decl.jsDoc,
    sourceFile: decl.sourceFile,
  };
}

// ─── Enum ────────────────────────────────────────────────────────────────────

function transformEnum(
  decl: ExtractedDeclaration,
  config: TypeBridgeConfig
): TransformedDeclaration {
  if (config.preserveEnums) {
    // Keep as enum
    return {
      kind: "enum",
      name: decl.name,
      typeText: ensureExported(decl.typeText),
      jsDoc: decl.jsDoc,
      sourceFile: decl.sourceFile,
    };
  }

  // Convert enum → union type
  const members = decl.enumMembers ?? [];
  const unionValues = members
    .map((m) => (typeof m.value === "string" ? `"${m.value}"` : String(m.value)))
    .join(" | ");

  const typeText = `export type ${decl.name} = ${unionValues || "never"};`;

  return {
    kind: "typeAlias",
    name: decl.name,
    typeText,
    jsDoc: decl.jsDoc,
    sourceFile: decl.sourceFile,
  };
}

// ─── Class → interface ───────────────────────────────────────────────────────

function transformClass(
  decl: ExtractedDeclaration,
  config: TypeBridgeConfig
): TransformedDeclaration {
  // Classes are emitted as interfaces (data shape only — no methods)
  const props = (decl.properties ?? [])
    .filter((p) => !isExcludedField(p.name, config))
    .map((p) => transformProperty(p, config));

  const body =
    props.length > 0
      ? `{\n${props.map((p) => `  ${p}`).join("\n")}\n}`
      : "{}";

  const typeText = `export interface ${decl.name} ${body}`;

  return {
    kind: "interface",
    name: decl.name,
    typeText,
    jsDoc: decl.jsDoc,
    sourceFile: decl.sourceFile,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Property transformation
// ─────────────────────────────────────────────────────────────────────────────

function transformProperty(prop: TypeProperty, config: TypeBridgeConfig): string {
  const optional = prop.isOptional ? "?" : "";
  const readonly = prop.isReadonly ? "readonly " : "";
  let typeText = prop.typeText;

  // Date → string
  typeText = applyDateTransform(typeText, config);

  // Replace ObjectId, Types.ObjectId → string
  typeText = typeText
    .replace(/\bTypes\.ObjectId\b/g, "string")
    .replace(/\bObjectId\b/g, "string")
    .replace(/\bBuffer\b/g, "string");

  return `${readonly}${prop.name}${optional}: ${typeText};`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

function isBackendOnlyType(name: string, config: TypeBridgeConfig): boolean {
  const userExcluded = config.excludeTypes ?? [];

  if (userExcluded.includes(name)) return true;

  for (const pattern of BACKEND_ONLY_TYPE_PATTERNS) {
    if (pattern.test(name)) return true;
  }

  return false;
}

function isExcludedField(fieldName: string, config: TypeBridgeConfig): boolean {
  if (ALWAYS_EXCLUDED_FIELDS.has(fieldName)) return true;
  const userExcluded = config.excludeFields ?? [];
  return userExcluded.includes(fieldName);
}

function applyDateTransform(typeText: string, config: TypeBridgeConfig): string {
  if (config.preserveDate) return typeText;
  // Replace standalone `Date` (not e.g. `UpdatedDate`) — word boundaries
  return typeText.replace(/\bDate\b/g, "string");
}

function ensureExported(text: string): string {
  if (/^export\s+/.test(text.trim())) return text;
  return `export ${text.trim()}`;
}
