import type { TypeBridgeConfig } from "../config/schema";
import type { PipelineResult } from "../types";
import { runExtractor } from "./extractor";
import { runTransformer } from "./transformer";
import { runGenerator } from "./generator";
import { runSDKGenerator } from "./sdk-generator";
import { logger } from "../utils/logger";

export interface PipelineOptions {
  config: TypeBridgeConfig;
  cwd?: string;
}

/**
 * Full TypeBridge pipeline:
 *   Extract → Transform → Generate (→ SDK if enabled)
 */
export async function runPipeline(
  options: PipelineOptions
): Promise<PipelineResult> {
  const { config, cwd = process.cwd() } = options;
  const start = Date.now();

  logger.step("Extracting types…");
  const extractedFiles = await runExtractor({ config, cwd });

  const totalDeclarations = extractedFiles.reduce(
    (sum, f) => sum + f.declarations.length,
    0
  );
  logger.info(
    `  Found ${totalDeclarations} declaration(s) across ${extractedFiles.length} file(s).`
  );

  logger.step("Transforming…");
  const transformed = runTransformer(extractedFiles, { config });
  logger.info(`  ${transformed.length} declaration(s) after transformation.`);

  logger.step("Generating output files…");
  const generatedFiles = await runGenerator(transformed, { config, cwd });

  let sdkFile: string | undefined;
  if (config.generateSDK) {
    logger.step("Generating SDK…");
    sdkFile = await runSDKGenerator(extractedFiles, { config, cwd });
    if (sdkFile) logger.info(`  SDK written: ${sdkFile}`);
  }

  const durationMs = Date.now() - start;
  logger.success(`Done in ${durationMs}ms — ${generatedFiles.length} file(s) written.`);

  return {
    extractedFiles,
    transformedDeclarations: transformed,
    generatedFiles,
    sdkFile,
    durationMs,
  };
}
