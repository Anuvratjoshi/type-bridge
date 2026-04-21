import path from "path";
import fs from "fs";
import os from "os";
import { loadConfig } from "../../config/loader";
import { DEFAULT_CONFIG } from "../../config/schema";

describe("Config Loader", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "type-bridge-config-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns defaults when no config file is present", async () => {
    const config = await loadConfig(tmpDir);
    expect(config.outDir).toBe(DEFAULT_CONFIG.outDir);
    expect(config.cleanOutput).toBe(true);
  });

  it("merges JSON config with defaults", async () => {
    fs.writeFileSync(
      path.join(tmpDir, ".typebridgerc.json"),
      JSON.stringify({ outDir: "dist/types", generateSDK: true }),
      "utf-8"
    );

    const config = await loadConfig(tmpDir);
    expect(config.outDir).toBe("dist/types");
    expect(config.generateSDK).toBe(true);
    // defaults preserved
    expect(config.cleanOutput).toBe(true);
  });

  it("reads config from package.json type-bridge key", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ "type-bridge": { preserveDate: true } }),
      "utf-8"
    );

    const config = await loadConfig(tmpDir);
    expect(config.preserveDate).toBe(true);
  });

  it("throws on invalid config (missing outDir)", async () => {
    fs.writeFileSync(
      path.join(tmpDir, ".typebridgerc.json"),
      JSON.stringify({ outDir: "" }),
      "utf-8"
    );

    await expect(loadConfig(tmpDir)).rejects.toThrow("Invalid type-bridge config");
  });
});
