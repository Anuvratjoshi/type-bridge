/**
 * TypeBridge — public API
 *
 * Import the top-level functions if you want to use TypeBridge
 * programmatically instead of through the CLI.
 */
export { loadConfig } from "./config/loader";
export { runExtractor } from "./core/extractor";
export { runTransformer } from "./core/transformer";
export { runGenerator } from "./core/generator";
export { runPipeline } from "./core/pipeline";
export * from "./types";
