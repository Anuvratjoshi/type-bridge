import { cosmiconfig } from "cosmiconfig";
import path from "path";
import { TypeBridgeConfig, DEFAULT_CONFIG } from "./schema";

const MODULE_NAME = "type-bridge";

/**
 * Load, validate, and merge user config with defaults.
 *
 * Search order (cosmiconfig):
 *   type-bridge.config.ts | type-bridge.config.js | type-bridge.config.json
 *   .typebridgerc | .typebridgerc.json | .typebridgerc.yaml
 *   package.json → "type-bridge" key
 */
export async function loadConfig(
  cwd: string = process.cwd(),
): Promise<TypeBridgeConfig> {
  const explorer = cosmiconfig(MODULE_NAME, {
    searchPlaces: [
      "type-bridge.config.ts",
      "type-bridge.config.js",
      "type-bridge.config.cjs",
      "type-bridge.config.json",
      ".typebridgerc",
      ".typebridgerc.json",
      ".typebridgerc.yaml",
      ".typebridgerc.yml",
      "package.json",
    ],
    // Allow TypeScript config files via require (ts-node / tsx must be present
    // in the consuming project when using .ts config files)
    loaders: {
      ".ts": (filePath: string) => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const result = require(filePath) as { default?: unknown } | unknown;
        if (result && typeof result === "object" && "default" in result) {
          return (result as { default: unknown }).default;
        }
        return result;
      },
    },
  });

  const result = await explorer.search(cwd);

  if (!result || !result.config) {
    return { ...DEFAULT_CONFIG };
  }

  const userConfig = result.config as Partial<TypeBridgeConfig>;
  const merged = mergeConfig(DEFAULT_CONFIG, userConfig);
  validateConfig(merged, path.relative(cwd, result.filepath));
  return merged;
}

function mergeConfig(
  defaults: TypeBridgeConfig,
  user: Partial<TypeBridgeConfig>,
): TypeBridgeConfig {
  return {
    ...defaults,
    ...user,
    // Arrays: user override replaces entirely (not merged)
    include: user.include ?? defaults.include,
    exclude: user.exclude ?? defaults.exclude,
    excludeFields: user.excludeFields ?? defaults.excludeFields,
    excludeTypes: user.excludeTypes ?? defaults.excludeTypes,
  };
}

function validateConfig(config: TypeBridgeConfig, configFile: string): void {
  const errors: string[] = [];

  if (
    !config.input ||
    (Array.isArray(config.input) && config.input.length === 0)
  ) {
    errors.push("`input` must be a non-empty string or array of strings.");
  }

  if (!config.outDir || typeof config.outDir !== "string") {
    errors.push("`outDir` must be a non-empty string.");
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid type-bridge config in ${configFile}:\n` +
        errors.map((e) => `  • ${e}`).join("\n"),
    );
  }
}
