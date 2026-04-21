import prettier from "prettier";

/**
 * Format a TypeScript string using Prettier.
 * Falls back to the original content if Prettier fails or has no config.
 */
export async function formatWithPrettier(
  content: string,
  filePath: string
): Promise<string> {
  try {
    const config = (await prettier.resolveConfig(filePath)) ?? {};
    return await prettier.format(content, {
      ...config,
      parser: "typescript",
    });
  } catch {
    // Never crash because of formatting — return the unformatted content
    return content;
  }
}
