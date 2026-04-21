import { runTransformer } from "../../core/transformer";
import { DEFAULT_CONFIG } from "../../config/schema";
import type { ExtractedFile, ExtractedDeclaration } from "../../types";

function makeFile(declarations: Partial<ExtractedDeclaration>[]): ExtractedFile {
  return {
    filePath: "/src/user.ts",
    declarations: declarations.map((d) => ({
      kind: "interface",
      name: "TestType",
      typeText: "export interface TestType {}",
      sourceFile: "/src/user.ts",
      ignored: false,
      ...d,
    })) as ExtractedDeclaration[],
  };
}

describe("Transformer", () => {
  it("drops @type-bridge-ignore declarations", () => {
    const file = makeFile([{ name: "Hidden", ignored: true }]);
    const result = runTransformer([file], { config: DEFAULT_CONFIG });
    expect(result).toHaveLength(0);
  });

  it("drops backend-only type names from user excludeTypes", () => {
    const file = makeFile([{ name: "Document", kind: "interface" }]);
    const result = runTransformer([file], { config: DEFAULT_CONFIG });
    expect(result).toHaveLength(0);
  });

  it("strips excluded fields from interfaces", () => {
    const file = makeFile([
      {
        kind: "interface",
        name: "User",
        properties: [
          { name: "name", typeText: "string", isOptional: false, isReadonly: false },
          { name: "password", typeText: "string", isOptional: false, isReadonly: false },
        ],
      },
    ]);

    const result = runTransformer([file], { config: DEFAULT_CONFIG });
    expect(result[0].typeText).not.toContain("password");
    expect(result[0].typeText).toContain("name");
  });

  it("replaces Date with string by default", () => {
    const file = makeFile([
      {
        kind: "interface",
        name: "Post",
        properties: [
          { name: "createdAt", typeText: "Date", isOptional: false, isReadonly: false },
        ],
      },
    ]);

    const result = runTransformer([file], { config: DEFAULT_CONFIG });
    expect(result[0].typeText).toContain("string");
    expect(result[0].typeText).not.toContain(": Date");
  });

  it("preserves Date when preserveDate=true", () => {
    const file = makeFile([
      {
        kind: "interface",
        name: "Post",
        properties: [
          { name: "createdAt", typeText: "Date", isOptional: false, isReadonly: false },
        ],
      },
    ]);

    const result = runTransformer([file], {
      config: { ...DEFAULT_CONFIG, preserveDate: true },
    });
    expect(result[0].typeText).toContain("Date");
  });

  it("converts enum to union type by default", () => {
    const file = makeFile([
      {
        kind: "enum",
        name: "Status",
        typeText: `export enum Status { Active = "active" }`,
        enumMembers: [{ name: "Active", value: "active" }],
      },
    ]);

    const result = runTransformer([file], { config: DEFAULT_CONFIG });
    expect(result[0].typeText).toContain('"active"');
    expect(result[0].typeText).not.toContain("enum");
  });

  it("preserves enum when preserveEnums=true", () => {
    const file = makeFile([
      {
        kind: "enum",
        name: "Status",
        typeText: `export enum Status { Active = "active" }`,
        enumMembers: [{ name: "Active", value: "active" }],
      },
    ]);

    const result = runTransformer([file], {
      config: { ...DEFAULT_CONFIG, preserveEnums: true },
    });
    expect(result[0].typeText).toContain("enum");
  });

  it("replaces ObjectId with string", () => {
    const file = makeFile([
      {
        kind: "interface",
        name: "User",
        properties: [
          {
            name: "_id",
            typeText: "Types.ObjectId",
            isOptional: false,
            isReadonly: false,
          },
        ],
      },
    ]);

    const result = runTransformer([file], { config: DEFAULT_CONFIG });
    expect(result[0].typeText).toContain("string");
    expect(result[0].typeText).not.toContain("ObjectId");
  });

  it("removes heritage bases that are backend-only", () => {
    const file = makeFile([
      {
        kind: "interface",
        name: "User",
        heritage: ["Document"],
        properties: [
          { name: "name", typeText: "string", isOptional: false, isReadonly: false },
        ],
      },
    ]);

    const result = runTransformer([file], { config: DEFAULT_CONFIG });
    expect(result[0].typeText).not.toContain("extends Document");
  });
});
