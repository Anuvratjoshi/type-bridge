import chalk from "chalk";

const PREFIX = chalk.bold.cyan("[type-bridge]");

export const logger = {
  /** High-level pipeline step */
  step(msg: string): void {
    console.log(`\n${PREFIX} ${chalk.bold(msg)}`);
  },

  /** Informational detail under a step */
  info(msg: string): void {
    console.log(`  ${chalk.dim(msg)}`);
  },

  /** Success message */
  success(msg: string): void {
    console.log(`\n${PREFIX} ${chalk.green("✔")} ${chalk.green(msg)}`);
  },

  /** Warning */
  warn(msg: string): void {
    console.warn(`${PREFIX} ${chalk.yellow("⚠")}  ${chalk.yellow(msg)}`);
  },

  /** Error */
  error(msg: string): void {
    console.error(`${PREFIX} ${chalk.red("✖")} ${chalk.red(msg)}`);
  },

  /** Watch event */
  watch(msg: string): void {
    console.log(`${PREFIX} ${chalk.blue("◉")} ${chalk.blue(msg)}`);
  },
};
