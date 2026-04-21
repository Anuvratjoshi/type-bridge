import path from "path";
import fs from "fs";
import os from "os";
import { runGenerator } from "../../core/generator";
import { DEFAULT_CONFIG } from "../../config/schema";
import type { TransformedDeclaration } from "../../types";

function makeDecl(
  overrides: Partial<TransformedDeclaration>
): TransformedDeclaration {
  return {
    kind: "interface",
    name: "User",
    typeText: "export interface User { name: string; }",
    sourceFile: "/backend/src/user.ts",
    ...overrides,
  };
}

describe("Generator", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "type-bridge-gen-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates the output directory", async () => {
    const outDir = path.join(tmpDir, "generated");
    const config = { ...DEFAULT_CONFIG, outDir, prettier: false };

    await runGenerator([makeDecl({})], { config, cwd: tmpDir });

    expect(fs.existsSync(outDir)).toBe(true);
  });

  it("writes one file per source file plus index.ts", async () => {
    const outDir = path.join(tmpDir, "generated");
    const config = { ...DEFAULT_CONFIG, outDir, prettier: false };

    await runGenerator(
      [
        makeDecl({ sourceFile: "/backend/src/user.ts" }),
        makeDecl({ name: "Post", sourceFile: "/backend/src/post.ts" }),
      ],
      { config, cwd: tmpDir }
    );

    const files = fs.readdirSync(outDir);
    expect(files).toContain("user.ts");
    expect(files).toContain("post.ts");
    expect(files).toContain("index.ts");
  });

  it("index.ts re-exports all generated files", async () => {
    const outDir = path.join(tmpDir, "generated");
    const config = { ...DEFAULT_CONFIG, outDir, prettier: false };

    await runGenerator([makeDecl({})], { config, cwd: tmpDir });

    const indexContent = fs.readFileSync(path.join(outDir, "index.ts"), "utf-8");
    expect(indexContent).toContain('export * from "./user"');
  });

  it("writes the type text into the output file", async () => {
    const outDir = path.join(tmpDir, "generated");
    const config = { ...DEFAULT_CONFIG, outDir, prettier: false };

    await runGenerator(
      [makeDecl({ typeText: "export interface User { email: string; }" })],
      { config, cwd: tmpDir }
    );

    const content = fs.readFileSync(path.join(outDir, "user.ts"), "utf-8");
    expect(content).toContain("email: string");
  });

  it("cleans output directory when cleanOutput=true", async () => {
    const outDir = path.join(tmpDir, "generated");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "stale.ts"), "stale", "utf-8");

    const config = { ...DEFAULT_CONFIG, outDir, cleanOutput: true, prettier: false };
    await runGenerator([makeDecl({})], { config, cwd: tmpDir });

    const files = fs.readdirSync(outDir);
    expect(files).not.toContain("stale.ts");
  });

  it("does not clean output directory when cleanOutput=false", async () => {
    const outDir = path.join(tmpDir, "generated");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "keep.ts"), "keep", "utf-8");

    const config = { ...DEFAULT_CONFIG, outDir, cleanOutput: false, prettier: false };
    await runGenerator([makeDecl({})], { config, cwd: tmpDir });

    const files = fs.readdirSync(outDir);
    expect(files).toContain("keep.ts");
  });
});
