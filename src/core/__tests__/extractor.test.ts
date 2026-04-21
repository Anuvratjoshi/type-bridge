import path from "path";
import fs from "fs";
import os from "os";
import { runExtractor } from "../../core/extractor";
import { DEFAULT_CONFIG } from "../../config/schema";

// Helpers
function writeTmpFile(dir: string, filename: string, content: string): string {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

describe("Extractor", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "type-bridge-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("extracts an exported interface", async () => {
    writeTmpFile(
      tmpDir,
      "user.ts",
      `export interface User { name: string; age: number; }`
    );

    const config = {
      ...DEFAULT_CONFIG,
      input: tmpDir,
      include: ["**/*.ts"],
      exclude: [],
    };

    const files = await runExtractor({ config, cwd: tmpDir });
    expect(files).toHaveLength(1);
    const decl = files[0].declarations[0];
    expect(decl.kind).toBe("interface");
    expect(decl.name).toBe("User");
    expect(decl.ignored).toBe(false);
  });

  it("ignores non-exported interfaces", async () => {
    writeTmpFile(
      tmpDir,
      "internal.ts",
      `interface Internal { secret: string; }`
    );

    const config = { ...DEFAULT_CONFIG, input: tmpDir, include: ["**/*.ts"], exclude: [] };
    const files = await runExtractor({ config, cwd: tmpDir });

    const declarations = files.flatMap((f) => f.declarations);
    expect(declarations).toHaveLength(0);
  });

  it("marks @type-bridge-ignore declarations", async () => {
    writeTmpFile(
      tmpDir,
      "ignored.ts",
      `/** @type-bridge-ignore */\nexport interface Hidden { token: string; }`
    );

    const config = { ...DEFAULT_CONFIG, input: tmpDir, include: ["**/*.ts"], exclude: [] };
    const files = await runExtractor({ config, cwd: tmpDir });

    const decl = files[0]?.declarations[0];
    expect(decl).toBeDefined();
    expect(decl!.ignored).toBe(true);
  });

  it("extracts enum members", async () => {
    writeTmpFile(
      tmpDir,
      "status.ts",
      `export enum Status { Active = "active", Inactive = "inactive" }`
    );

    const config = { ...DEFAULT_CONFIG, input: tmpDir, include: ["**/*.ts"], exclude: [] };
    const files = await runExtractor({ config, cwd: tmpDir });

    const decl = files[0]?.declarations[0];
    expect(decl?.kind).toBe("enum");
    expect(decl?.enumMembers).toHaveLength(2);
    expect(decl?.enumMembers![0].value).toBe("active");
  });

  it("extracts type aliases with generics", async () => {
    writeTmpFile(
      tmpDir,
      "api.ts",
      `export type ApiResponse<T> = { data: T; success: boolean; }`
    );

    const config = { ...DEFAULT_CONFIG, input: tmpDir, include: ["**/*.ts"], exclude: [] };
    const files = await runExtractor({ config, cwd: tmpDir });

    const decl = files[0]?.declarations[0];
    expect(decl?.kind).toBe("typeAlias");
    expect(decl?.name).toBe("ApiResponse");
    expect(decl?.typeParameters).toContain("T");
  });
});
