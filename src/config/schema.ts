// ─────────────────────────────────────────────────────────────────────────────
// TypeBridge Configuration schema
// ─────────────────────────────────────────────────────────────────────────────

export interface TypeBridgeConfig {
  /**
   * Root directory (or glob) to scan for TypeScript source files.
   * Defaults to "src".
   */
  input: string | string[];

  /**
   * Directory where generated type files will be written.
   * Defaults to "frontend/src/types/generated".
   */
  outDir: string;

  /**
   * Glob patterns to include (relative to `input`).
   * Defaults to ["**\/*.ts"].
   */
  include: string[];

  /**
   * Glob patterns to exclude.
   * Defaults to ["**\/*.test.ts", "**\/*.spec.ts", "**\/*.d.ts"].
   */
  exclude: string[];

  /**
   * Delete all files in `outDir` before generation.
   * Defaults to true.
   */
  cleanOutput: boolean;

  /**
   * Generate an API client SDK file in addition to types.
   * Defaults to false.
   */
  generateSDK: boolean;

  /**
   * Fields to strip from every generated type.
   * Useful for passwords, tokens, etc.
   */
  excludeFields: string[];

  /**
   * Backend-only type names / patterns to remove from output.
   */
  excludeTypes: string[];

  /**
   * When true, Date properties are kept as `Date` instead of `string`.
   * Defaults to false.
   */
  preserveDate: boolean;

  /**
   * When true, enums are emitted as enum declarations.
   * When false (default), they are converted to union types.
   */
  preserveEnums: boolean;

  /**
   * Path to a tsconfig.json the extractor should use.
   * Defaults to auto-detection.
   */
  tsConfigFilePath?: string;

  /**
   * Format generated files with Prettier.
   * Defaults to true.
   */
  prettier: boolean;

  /**
   * When true, add a hash-comment header to each generated file.
   * Allows detecting stale frontend files.
   * Defaults to true.
   */
  addHashHeader: boolean;
}

export const DEFAULT_CONFIG: TypeBridgeConfig = {
  input: "src",
  outDir: "frontend/src/types/generated",
  include: ["**/*.ts"],
  exclude: ["**/*.test.ts", "**/*.spec.ts", "**/*.d.ts"],
  cleanOutput: true,
  generateSDK: false,
  excludeFields: ["password", "passwordHash", "token", "refreshToken", "secret"],
  excludeTypes: [
    "Document",
    "Model",
    "Schema",
    "Request",
    "Response",
    "NextFunction",
    "Express",
  ],
  preserveDate: false,
  preserveEnums: false,
  prettier: true,
  addHashHeader: true,
};
