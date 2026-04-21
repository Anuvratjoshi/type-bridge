// ─────────────────────────────────────────────────────────────────────────────
// Shared types used across all TypeBridge modules
// ─────────────────────────────────────────────────────────────────────────────

/** Primitive TypeScript kinds we care about */
export type PrimitiveKind =
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "undefined"
  | "any"
  | "unknown"
  | "never"
  | "void";

/** A single property inside an interface / type */
export interface TypeProperty {
  name: string;
  typeText: string;
  isOptional: boolean;
  isReadonly: boolean;
  jsDoc?: string;
}

/** An enum member */
export interface EnumMember {
  name: string;
  value: string | number;
}

/** Kind of the extracted declaration */
export type DeclarationKind =
  | "interface"
  | "typeAlias"
  | "enum"
  | "class"
  | "function";

/** Raw metadata emitted by the Extractor */
export interface ExtractedDeclaration {
  kind: DeclarationKind;
  name: string;
  /** Full generic parameter text, e.g. "<T, U extends string>" */
  typeParameters?: string;
  /** Text of the full type / interface body */
  typeText: string;
  /** Resolved properties (for interface / class) */
  properties?: TypeProperty[];
  /** Enum members (for enum) */
  enumMembers?: EnumMember[];
  /** Heritage clauses — extends / implements */
  heritage?: string[];
  /** Original file path */
  sourceFile: string;
  /** JSDoc comment attached to the declaration */
  jsDoc?: string;
  /** Whether this declaration was tagged @type-bridge-ignore */
  ignored: boolean;
}

/** Result produced by the Extractor for a single source file */
export interface ExtractedFile {
  filePath: string;
  declarations: ExtractedDeclaration[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Transformer output
// ─────────────────────────────────────────────────────────────────────────────

/** A single transformed, frontend-safe type declaration */
export interface TransformedDeclaration {
  kind: DeclarationKind;
  name: string;
  typeParameters?: string;
  /** Final type text, ready to be written to disk */
  typeText: string;
  jsDoc?: string;
  /** Source file that originally contained this type */
  sourceFile: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SDK Generator — route metadata
// ─────────────────────────────────────────────────────────────────────────────

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

export interface RouteInfo {
  method: HttpMethod;
  path: string;
  handlerName: string;
  bodyType?: string;
  responseType?: string;
  paramsType?: string;
  queryType?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline result
// ─────────────────────────────────────────────────────────────────────────────

export interface PipelineResult {
  extractedFiles: ExtractedFile[];
  transformedDeclarations: TransformedDeclaration[];
  generatedFiles: string[];
  /** Present when SDK generation is enabled */
  sdkFile?: string;
  durationMs: number;
}
