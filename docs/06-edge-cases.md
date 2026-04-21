# Edge Cases & Advanced Guide

TypeBridge is designed to handle the messy reality of real backend codebases.
This page documents every edge case and how TypeBridge deals with it.

---

## 1. Mongoose `Document` heritage

### The problem

Mongoose models extend `Document`, which carries dozens of backend-only
methods and properties that should never reach the frontend.

```ts
// backend — what you write
import { Document, Types } from "mongoose";

export interface IUser extends Document {
  _id:   Types.ObjectId;
  name:  string;
  email: string;
}
```

### What TypeBridge does

1. Strips the `extends Document` clause entirely
2. Converts `Types.ObjectId` → `string`
3. Removes the `_id` underscore convention if you prefer (see `excludeFields`)

```ts
// frontend — what TypeBridge generates
export interface IUser {
  _id:   string;    // ObjectId → string
  name:  string;
  email: string;
}
```

> **Why `_id` stays:** TypeBridge preserves `_id` by default because frontends
> legitimately need the document ID. Add `"_id"` to `excludeFields` if you
> want to strip it.

---

## 2. Sensitive fields

### The problem

Backend interfaces often include fields like `password` that must **never**
reach a browser.

```ts
export interface IUser {
  name:         string;
  email:        string;
  password:     string;         // ← dangerous
  passwordHash: string;         // ← dangerous
  token:        string;         // ← dangerous
}
```

### What TypeBridge does

Fields in `excludeFields` are silently stripped from every generated type:

```ts
// Generated (default excludeFields)
export interface IUser {
  name:  string;
  email: string;
  // password, passwordHash, token — stripped
}
```

### Adding custom sensitive fields

```ts
// type-bridge.config.ts
excludeFields: [
  "password",
  "passwordHash",
  "token",
  "refreshToken",
  "secret",
  "apiKey",         // ← add yours
  "stripeKey",
  "internalNotes",
]
```

---

## 3. `Date` handling

### The problem

`new Date()` objects are serialized to ISO strings in JSON responses. If the
frontend declares a property as `Date`, it will actually receive a `string` at
runtime — a type lie.

```ts
// Backend
export interface Post { publishedAt: Date; }

// GET /posts returns: { "publishedAt": "2026-04-20T10:30:00.000Z" }
// Runtime value is a string, not a Date object
```

### Default behaviour (`preserveDate: false`)

Every `Date` is converted to `string`:

```ts
// Generated
export interface Post { publishedAt: string; }
```

### Opt-in: keep `Date` (`preserveDate: true`)

Use this when your frontend uses a library like
[class-transformer](https://github.com/typestack/class-transformer) that
reconstructs `Date` instances during response parsing:

```ts
// type-bridge.config.ts
preserveDate: true
```

```ts
// Generated
export interface Post { publishedAt: Date; }
```

---

## 4. `ObjectId` conversion

`Types.ObjectId` and bare `ObjectId` are always converted to `string` because
MongoDB ObjectIds are serialized as strings in JSON:

| Backend type | Generated type |
|---|---|
| `Types.ObjectId` | `string` |
| `ObjectId` | `string` |
| `Buffer` | `string` |

---

## 5. Enums

### Default: enum → union type

```ts
// Backend
export enum Status {
  Active   = "active",
  Inactive = "inactive",
  Pending  = "pending",
}

// Generated (default)
export type Status = "active" | "inactive" | "pending";
```

Union types are preferred because they:
- Tree-shake perfectly
- Survive JSON serialization without any conversion
- Work identically in plain-JS frontends

### Opt-in: preserve enums

```ts
// type-bridge.config.ts
preserveEnums: true
```

```ts
// Generated
export enum Status {
  Active   = "active",
  Inactive = "inactive",
  Pending  = "pending",
}
```

---

## 6. Generic types

Generics are supported and preserved as-is when the type is reusable:

```ts
// Backend
export type ApiResponse<T> = {
  data:       T;
  success:    boolean;
  message:    string;
  pagination?: {
    page:       number;
    totalPages: number;
    total:      number;
  };
};
```

```ts
// Generated
export type ApiResponse<T> = {
  data:       T;
  success:    boolean;
  message:    string;
  pagination?: {
    page:       number;
    totalPages: number;
    total:      number;
  };
};
```

Frontend usage:

```ts
import type { ApiResponse, IUser } from "@/types/generated";

const response: ApiResponse<IUser[]> = await fetchUsers();
```

---

## 7. Union and intersection types

Union and intersection types are preserved exactly as written:

```ts
// Backend
export type UserOrAdmin = IUser | IAdmin;
export type AuthenticatedUser = IUser & { token: string };

// Generated (token stripped from intersection)
export type UserOrAdmin = IUser | IAdmin;
export type AuthenticatedUser = IUser & {};
```

---

## 8. Optional and readonly properties

Both `?` and `readonly` modifiers are preserved faithfully:

```ts
// Backend
export interface UpdateUserDTO {
  readonly id:   string;
  name?:         string;
  email?:        string;
}

// Generated
export interface UpdateUserDTO {
  readonly id: string;
  name?:       string;
  email?:      string;
}
```

---

## 9. Circular / recursive types

TypeScript itself handles circular type references at compile time. TypeBridge
emits them as-is without any special processing:

```ts
// Backend
export interface Category {
  name:     string;
  parent?:  Category;          // ← recursive
  children: Category[];
}

// Generated — identical (TypeScript handles this fine)
export interface Category {
  name:     string;
  parent?:  Category;
  children: Category[];
}
```

---

## 10. Classes (data shapes only)

TypeBridge extracts **data properties** from classes and emits them as
interfaces. Methods, static members, and decorators are not included.

```ts
// Backend (NestJS DTO class)
export class UserResponseDto {
  id:        string;
  name:      string;
  email:     string;
  createdAt: Date;

  // Methods are ignored
  getFullName(): string { return this.name; }
  static fromDocument(doc: any): UserResponseDto { ... }
}
```

```ts
// Generated
export interface UserResponseDto {
  id:        string;
  name:      string;
  email:     string;
  createdAt: string;    // Date → string
}
```

---

## 11. `@type-bridge-ignore` — skip individual declarations

Add this JSDoc tag to **exclude a specific declaration** from generation.
Nothing is emitted for it — no error, no warning.

```ts
/**
 * Internal caching metadata — not meant for external consumers.
 * @type-bridge-ignore
 */
export interface CacheEntry {
  key:        string;
  ttl:        number;
  serialized: Buffer;
}
```

The `CacheEntry` interface is silently skipped.

Use it for:
- Internal implementation types
- Server-only helper types
- Types that are too backend-specific to be meaningful on the frontend

---

## 12. Backend-only heritage (Express, ORM)

These extends/implements clauses are stripped automatically, regardless of
`excludeTypes` config:

| Original | Generated |
|---|---|
| `extends Document` | *(removed)* |
| `extends Model<T>` | *(removed)* |
| `extends Repository<T>` | *(removed)* |

Example:

```ts
// Backend
export interface IPost extends Document {
  title:   string;
  content: string;
}

// Generated
export interface IPost {
  title:   string;
  content: string;
}
```

---

## 13. `excludeTypes` — drop whole declarations

When an entire type/interface is backend-only, add its name to `excludeTypes`:

```ts
// type-bridge.config.ts
excludeTypes: [
  "Document",
  "Model",
  "AppLogger",      // your custom logger
  "RedisClient",
  "CronJobContext",
]
```

Declarations whose **name** matches are dropped entirely.

---

## 14. Path aliases (`@/models/User`)

If your backend uses TypeScript path aliases, point TypeBridge to the correct
`tsconfig.json` and it will resolve them through the TypeScript compiler:

```ts
// type-bridge.config.ts
tsConfigFilePath: "backend/tsconfig.json"
```

The backend `tsconfig.json` should have the aliases defined:

```json
// backend/tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@models/*": ["src/models/*"],
      "@dtos/*":   ["src/dtos/*"]
    }
  }
}
```

---

## 15. Incremental / large codebases

For repositories with hundreds of files, use `include` patterns to narrow the
scope to only files that contain API-relevant types:

```ts
// type-bridge.config.ts — only process explicitly named file groups
include: [
  "**/*.model.ts",
  "**/*.dto.ts",
  "**/*.interface.ts",
  "**/*.types.ts",
],
exclude: [
  "**/*.test.ts",
  "**/*.spec.ts",
  "**/*.d.ts",
  "**/internal/**",
  "**/migrations/**",
]
```

This keeps extraction fast even in large codebases because ts-morph only
parses the matched files.
