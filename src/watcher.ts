import chokidar from "chokidar";
import path from "path";
import type { TypeBridgeConfig } from "./config/schema";
import { runPipeline } from "./core/pipeline";
import { logger } from "./utils/logger";

export interface WatcherOptions {
  config: TypeBridgeConfig;
  cwd?: string;
  /** Debounce window in ms before triggering a rebuild. Default: 300 */
  debounceMs?: number;
}

/**
 * Start watching backend source files and re-run the full pipeline on change.
 * This function never resolves — it keeps watching until the process exits.
 */
export async function startWatcher(options: WatcherOptions): Promise<void> {
  const { config, cwd = process.cwd(), debounceMs = 300 } = options;

  const inputs = Array.isArray(config.input) ? config.input : [config.input];
  const watchPaths = inputs.map((i) => path.resolve(cwd, i));

  logger.watch(`Watching: ${watchPaths.join(", ")}`);
  logger.info("Press Ctrl+C to stop.\n");

  // Run once immediately
  await runPipelineSafe(options);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let pendingRun = false;

  const scheduleRun = (): void => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(async () => {
      debounceTimer = null;
      if (running) {
        // Another run is in progress — remember to run again after it finishes
        pendingRun = true;
        return;
      }
      await runPipelineSafe(options);

      if (pendingRun) {
        pendingRun = false;
        scheduleRun();
      }
    }, debounceMs);
  };

  const watcher = chokidar.watch(watchPaths, {
    ignored: [
      /node_modules/,
      /\.git/,
      new RegExp(escapeRegExp(path.resolve(cwd, config.outDir))),
    ],
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  });

  watcher
    .on("change", (filePath) => {
      logger.watch(`Changed: ${path.relative(cwd, filePath)}`);
      scheduleRun();
    })
    .on("add", (filePath) => {
      logger.watch(`Added:   ${path.relative(cwd, filePath)}`);
      scheduleRun();
    })
    .on("unlink", (filePath) => {
      logger.watch(`Removed: ${path.relative(cwd, filePath)}`);
      scheduleRun();
    })
    .on("error", (err) => {
      logger.error(`Watcher error: ${String(err)}`);
    });

  // Graceful shutdown
  const shutdown = (): void => {
    logger.info("\nStopping watcher…");
    watcher.close().catch(() => undefined);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Keep the process alive
  await new Promise<never>(() => undefined);

  // Helper to run the pipeline and track the `running` flag
  async function runPipelineSafe(opts: WatcherOptions): Promise<void> {
    running = true;
    try {
      await runPipeline({ config: opts.config, cwd: opts.cwd });
    } catch (err) {
      logger.error(`Pipeline error: ${String(err instanceof Error ? err.message : err)}`);
    } finally {
      running = false;
    }
  }
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
