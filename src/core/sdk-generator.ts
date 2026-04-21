import fs from "fs";
import path from "path";
import type { TypeBridgeConfig } from "../config/schema";
import type { ExtractedFile, RouteInfo, HttpMethod } from "../types";
import { formatWithPrettier } from "../utils/prettier";
import { logger } from "../utils/logger";

export interface SDKGeneratorOptions {
  config: TypeBridgeConfig;
  cwd?: string;
}

/**
 * Scan extracted files for Express route registrations and emit a typed
 * API client (sdk.ts) in the output directory.
 *
 * Detection pattern:
 *   app.get("/path", handler)
 *   router.post("/path", handler)
 *   app.delete("/path/:id", handler)
 */
export async function runSDKGenerator(
  extractedFiles: ExtractedFile[],
  options: SDKGeneratorOptions,
): Promise<string | undefined> {
  const { config, cwd = process.cwd() } = options;

  const routes = extractRoutes(extractedFiles);

  if (routes.length === 0) {
    logger.warn("SDK generation: no Express routes detected.");
    return undefined;
  }

  const sdkContent = buildSDKContent(routes, config);
  const outDir = path.resolve(cwd, config.outDir);
  const sdkPath = path.join(outDir, "sdk.ts");

  fs.mkdirSync(outDir, { recursive: true });

  const formatted = config.prettier
    ? await formatWithPrettier(sdkContent, sdkPath)
    : sdkContent;

  fs.writeFileSync(sdkPath, formatted, "utf-8");
  return sdkPath;
}

// ─────────────────────────────────────────────────────────────────────────────
// Route extraction — static analysis of Express registration calls
// ─────────────────────────────────────────────────────────────────────────────

// HTTP_METHODS kept for reference — used implicitly through regex detection
const _HTTP_METHODS: HttpMethod[] = ["get", "post", "put", "patch", "delete"];
void _HTTP_METHODS;

const ROUTE_REGEX =
  /(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/gi;

function extractRoutes(extractedFiles: ExtractedFile[]): RouteInfo[] {
  const routes: RouteInfo[] = [];
  const seen = new Set<string>();

  for (const file of extractedFiles) {
    // We need the raw source text — re-read the file
    let source: string;
    try {
      source = fs.readFileSync(file.filePath, "utf-8");
    } catch {
      continue;
    }

    let match: RegExpExecArray | null;
    ROUTE_REGEX.lastIndex = 0;

    while ((match = ROUTE_REGEX.exec(source)) !== null) {
      const method = match[1].toLowerCase() as HttpMethod;
      const routePath = match[2];
      const key = `${method}:${routePath}`;

      if (seen.has(key)) continue;
      seen.add(key);

      routes.push({
        method,
        path: routePath,
        handlerName: deriveHandlerName(method, routePath),
      });
    }
  }

  return routes;
}

// ─────────────────────────────────────────────────────────────────────────────
// SDK file generation
// ─────────────────────────────────────────────────────────────────────────────

function buildSDKContent(routes: RouteInfo[], config: TypeBridgeConfig): string {
  const lines: string[] = [];

  if (config.addHashHeader) {
    lines.push(
      "// ─────────────────────────────────────────────────────────────────────────────",
    );
    lines.push("// type-bridge SDK \u2014 auto-generated API client");
    lines.push(
      "// Do NOT edit manually. Re-run `type-bridge generate --sdk` to refresh.",
    );
    lines.push(
      "// ─────────────────────────────────────────────────────────────────────────────",
    );
    lines.push("");
  }

  // Base client interface
  lines.push(`export interface RequestOptions {`);
  lines.push(`  headers?: Record<string, string>;`);
  lines.push(`  signal?: AbortSignal;`);
  lines.push(`}`);
  lines.push("");

  lines.push(`export interface TypeBridgeClient {`);
  lines.push(`  baseURL: string;`);
  lines.push(`  defaultHeaders: Record<string, string>;`);
  lines.push(`}`);
  lines.push("");

  lines.push(
    `export function createClient(baseURL: string): TypeBridgeClient {`,
  );
  lines.push(`  return { baseURL, defaultHeaders: {} };`);
  lines.push(`}`);
  lines.push("");

  // Helper fetch wrapper
  lines.push(`async function request<T>(`);
  lines.push(`  client: TypeBridgeClient,`);
  lines.push(`  method: string,`);
  lines.push(`  path: string,`);
  lines.push(`  body?: unknown,`);
  lines.push(`  opts?: RequestOptions`);
  lines.push(`): Promise<T> {`);
  lines.push(`  const url = \`\${client.baseURL}\${path}\`;`);
  lines.push(`  const res = await fetch(url, {`);
  lines.push(`    method: method.toUpperCase(),`);
  lines.push(`    headers: {`);
  lines.push(`      "Content-Type": "application/json",`);
  lines.push(`      ...client.defaultHeaders,`);
  lines.push(`      ...(opts?.headers ?? {}),`);
  lines.push(`    },`);
  lines.push(
    `    body: body !== undefined ? JSON.stringify(body) : undefined,`,
  );
  lines.push(`    signal: opts?.signal,`);
  lines.push(`  });`);
  lines.push(`  if (!res.ok) {`);
  lines.push(
    `    const message = await res.text().catch(() => res.statusText);`,
  );
  lines.push(`    throw new Error(\`[\${res.status}] \${message}\`);`);
  lines.push(`  }`);
  lines.push(`  return res.json() as Promise<T>;`);
  lines.push(`}`);
  lines.push("");

  // One function per route
  for (const route of routes) {
    const fnBody = buildRouteFn(route);
    lines.push(fnBody);
    lines.push("");
  }

  return lines.join("\n");
}

function buildRouteFn(route: RouteInfo): string {
  const hasBody = ["post", "put", "patch"].includes(route.method);
  const paramNames = extractPathParams(route.path);
  const hasParams = paramNames.length > 0;

  const fnName = route.handlerName;

  // Build parameter list
  const params: string[] = ["client: TypeBridgeClient"];
  if (hasParams) {
    params.push(
      `params: { ${paramNames.map((p) => `${p}: string`).join("; ")} }`,
    );
  }
  if (hasBody) {
    const bodyType = route.bodyType ?? "unknown";
    params.push(`body: ${bodyType}`);
  }
  params.push(`opts?: RequestOptions`);

  // Build resolved path
  let resolvedPath = route.path;
  for (const p of paramNames) {
    resolvedPath = resolvedPath.replace(`:${p}`, `\${params.${p}}`);
  }
  const pathExpr =
    paramNames.length > 0 ? `\`${resolvedPath}\`` : `"${resolvedPath}"`;

  const returnType = route.responseType ?? "unknown";
  const bodyArg = hasBody ? "body, " : "";

  return [
    `export async function ${fnName}(`,
    `  ${params.join(",\n  ")}`,
    `): Promise<${returnType}> {`,
    `  return request<${returnType}>(client, "${route.method}", ${pathExpr}, ${bodyArg}opts);`,
    `}`,
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function deriveHandlerName(method: HttpMethod, routePath: string): string {
  // /user/:id → getUserById
  // /auth/login → postAuthLogin
  const segments = routePath
    .split("/")
    .filter(Boolean)
    .map((s) => {
      if (s.startsWith(":")) {
        return `By${capitalize(s.slice(1))}`;
      }
      return capitalize(s);
    });

  return `${method}${segments.join("")}`;
}

function extractPathParams(routePath: string): string[] {
  const matches = routePath.match(/:([a-zA-Z_][a-zA-Z0-9_]*)/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1));
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
