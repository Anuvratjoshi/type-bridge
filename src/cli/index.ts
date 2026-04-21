#!/usr/bin/env node
import { Command } from "commander";
import path from "path";
import { loadConfig } from "../config/loader";
import { runPipeline } from "../core/pipeline";
import { startWatcher } from "../watcher";
import { logger } from "../utils/logger";

const pkg = require("../../package.json") as { version: string };

const program = new Command();

program
  .name("type-bridge")
  .description("Automatically sync backend TypeScript types to your frontend.")
  .version(pkg.version, "-v, --version");

// ─── generate ────────────────────────────────────────────────────────────────

program
  .command("generate")
  .alias("gen")
  .description("Extract, transform and generate frontend types.")
  .option("--cwd <path>", "Working directory", process.cwd())
  .option("--config <path>", "Path to type-bridge config file")
  .option("--outDir <path>", "Output directory (overrides config)")
  .option("--sdk", "Generate API client SDK (overrides config)")
  .option("--no-clean", "Do not clean output directory before generation")
  .option("--no-prettier", "Skip Prettier formatting")
  .action(async (opts: GenerateOptions) => {
    try {
      const cwd = path.resolve(opts.cwd ?? process.cwd());
      const config = await loadConfig(cwd);

      // Apply CLI overrides
      if (opts.outDir) config.outDir = opts.outDir;
      if (opts.sdk) config.generateSDK = true;
      if (opts.noClean) config.cleanOutput = false;
      if (opts.noPrettier) config.prettier = false;

      await runPipeline({ config, cwd });
    } catch (err) {
      logger.error(String(err instanceof Error ? err.message : err));
      process.exit(1);
    }
  });

// ─── watch ───────────────────────────────────────────────────────────────────

program
  .command("watch")
  .description("Watch backend source and automatically re-generate on changes.")
  .option("--cwd <path>", "Working directory", process.cwd())
  .option("--outDir <path>", "Output directory (overrides config)")
  .option("--sdk", "Generate API client SDK")
  .action(async (opts: WatchOptions) => {
    try {
      const cwd = path.resolve(opts.cwd ?? process.cwd());
      const config = await loadConfig(cwd);

      if (opts.outDir) config.outDir = opts.outDir;
      if (opts.sdk) config.generateSDK = true;

      await startWatcher({ config, cwd });
    } catch (err) {
      logger.error(String(err instanceof Error ? err.message : err));
      process.exit(1);
    }
  });

// ─── info ────────────────────────────────────────────────────────────────────

program
  .command("info")
  .description("Display resolved configuration and exit.")
  .option("--cwd <path>", "Working directory", process.cwd())
  .action(async (opts: { cwd?: string }) => {
    try {
      const cwd = path.resolve(opts.cwd ?? process.cwd());
      const config = await loadConfig(cwd);
      console.log(JSON.stringify(config, null, 2));
    } catch (err) {
      logger.error(String(err instanceof Error ? err.message : err));
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────

program.parseAsync(process.argv).catch((err: unknown) => {
  logger.error(String(err instanceof Error ? err.message : err));
  process.exit(1);
});

// ─── Local types ─────────────────────────────────────────────────────────────

interface GenerateOptions {
  cwd?: string;
  config?: string;
  outDir?: string;
  sdk?: boolean;
  noClean?: boolean;
  noPrettier?: boolean;
}

interface WatchOptions {
  cwd?: string;
  outDir?: string;
  sdk?: boolean;
}
