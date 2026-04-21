# SDK Generator

The TypeBridge SDK Generator is an **optional** module that scans your backend
source for Express route registrations and emits a fully-typed `sdk.ts` API
client file — so your frontend can call backend endpoints with type safety,
without writing any boilerplate fetch code.

---

## Enable it

```ts
// type-bridge.config.ts
import type { TypeBridgeConfig } from "type-bridge";

export default {
  input:       "backend/src",
  outDir:      "frontend/src/types/generated",
  generateSDK: true,            // ← opt in
} satisfies TypeBridgeConfig;
```

Or on a one-off basis with a CLI flag:

```bash
npx type-bridge generate --sdk
```

---

## How detection works

TypeBridge uses a **static regex scan** over your source files. It detects any
line matching:

```
(app|router).(get|post|put|patch|delete)("path", handler)
```

Examples that are detected:

```ts
app.get("/users",          getAllUsers);
app.post("/users",         createUser);
router.put("/users/:id",   updateUser);
router.patch("/users/:id", patchUser);
app.delete("/users/:id",   deleteUser);
app.get("/auth/me",        getCurrentUser);
app.post("/auth/login",    loginUser);
```

> **Limitation:** Dynamic route registrations (loops, factory functions, or
> plugin-based routers) are not detected. Define at least some routes
> statically to get SDK coverage.

---

## Generated `sdk.ts` — full example

Given this backend router:

```ts
// backend/src/routes/user.routes.ts
import { Router } from "express";
import { getAllUsers, getUserById, createUser, updateUser, deleteUser } from "../controllers/user.controller";

const router = Router();

router.get("/users",          getAllUsers);
router.get("/users/:id",      getUserById);
router.post("/users",         createUser);
router.put("/users/:id",      updateUser);
router.delete("/users/:id",   deleteUser);

export default router;
```

TypeBridge generates:

```ts
// frontend/src/types/generated/sdk.ts  (auto-generated — do not edit)
// ──────────────────────────────────────────────────────────────────────────
// TypeBridge SDK — auto-generated API client
// Do NOT edit manually. Re-run `type-bridge generate --sdk` to refresh.
// ──────────────────────────────────────────────────────────────────────────

export interface RequestOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface TypeBridgeClient {
  baseURL: string;
  defaultHeaders: Record<string, string>;
}

export function createClient(baseURL: string): TypeBridgeClient {
  return { baseURL, defaultHeaders: {} };
}

// GET /users
export async function getUsers(
  client: TypeBridgeClient,
  opts?: RequestOptions
): Promise<unknown> {
  return request<unknown>(client, "get", "/users", undefined, opts);
}

// GET /users/:id
export async function getUsersByById(
  client: TypeBridgeClient,
  params: { id: string },
  opts?: RequestOptions
): Promise<unknown> {
  return request<unknown>(client, "get", `/users/${params.id}`, undefined, opts);
}

// POST /users
export async function postUsers(
  client: TypeBridgeClient,
  body: unknown,
  opts?: RequestOptions
): Promise<unknown> {
  return request<unknown>(client, "post", "/users", body, opts);
}

// PUT /users/:id
export async function putUsersByById(
  client: TypeBridgeClient,
  params: { id: string },
  body: unknown,
  opts?: RequestOptions
): Promise<unknown> {
  return request<unknown>(client, "put", `/users/${params.id}`, body, opts);
}

// DELETE /users/:id
export async function deleteUsersByById(
  client: TypeBridgeClient,
  params: { id: string },
  opts?: RequestOptions
): Promise<unknown> {
  return request<unknown>(client, "delete", `/users/${params.id}`, undefined, opts);
}
```

---

## Using the generated SDK

### 1. Create a client instance

```ts
// frontend/src/lib/api.ts
import { createClient } from "@/types/generated/sdk";

export const api = createClient("https://api.myapp.com");
```

### 2. Add auth headers (e.g. Bearer token)

```ts
// frontend/src/lib/api.ts
import { createClient } from "@/types/generated/sdk";

export const api = createClient("https://api.myapp.com");

// Set auth header after login
export function setAuthToken(token: string) {
  api.defaultHeaders["Authorization"] = `Bearer ${token}`;
}
```

### 3. Call endpoints

```ts
// frontend/src/hooks/useUsers.ts
import { getUsers, postUsers, deleteUsersByById } from "@/types/generated/sdk";
import { api } from "@/lib/api";
import type { IUser, CreateUserDTO } from "@/types/generated";

// Fetch all users
const users = await getUsers(api);

// Create a user
const newUser = await postUsers(api, {
  name:  "Alice",
  email: "alice@example.com",
} satisfies CreateUserDTO);

// Delete a user
await deleteUsersByById(api, { id: "507f1f77bcf86cd799439011" });
```

### 4. Abort a request (e.g. on component unmount)

```ts
const controller = new AbortController();

const users = await getUsers(api, { signal: controller.signal });

// In a cleanup function:
controller.abort();
```

### 5. Pass custom headers per-request

```ts
const result = await postUsers(
  api,
  { name: "Bob", email: "bob@example.com" },
  { headers: { "X-Request-ID": crypto.randomUUID() } }
);
```

---

## Error handling

The generated SDK throws an `Error` when the server returns a non-2xx status:

```ts
try {
  const user = await getUsersByById(api, { id: "nonexistent" });
} catch (err) {
  if (err instanceof Error) {
    console.error(err.message);  // "[404] User not found"
  }
}
```

The error message format is `[<status>] <body text>`.

---

## React example — with SWR

```tsx
// frontend/src/hooks/useUser.ts
import useSWR from "swr";
import { getUsersByById } from "@/types/generated/sdk";
import { api } from "@/lib/api";

export function useUser(id: string) {
  return useSWR(["user", id], ([, userId]) =>
    getUsersByById(api, { id: userId })
  );
}
```

```tsx
// frontend/src/components/UserProfile.tsx
import { useUser } from "@/hooks/useUser";

export function UserProfile({ id }: { id: string }) {
  const { data: user, error, isLoading } = useUser(id);

  if (isLoading) return <p>Loading…</p>;
  if (error)     return <p>Error: {error.message}</p>;
  if (!user)     return null;

  return <h1>{user.name}</h1>;
}
```

---

## React Query example

```tsx
// frontend/src/queries/users.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUsers, postUsers, deleteUsersByById } from "@/types/generated/sdk";
import { api } from "@/lib/api";

export function useUsersQuery() {
  return useQuery({
    queryKey: ["users"],
    queryFn:  () => getUsers(api),
  });
}

export function useCreateUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; email: string }) => postUsers(api, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useDeleteUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteUsersByById(api, { id }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}
```

---

## Current limitations

| Limitation | Workaround |
|---|---|
| Body / response types are `unknown` | Cast at the call site: `await postUsers(api, data) as UserResponse` |
| Dynamic route registrations not detected | Register at least one static route per group |
| NestJS `@Controller` / `@Get` decorators not detected | Use TypeBridge's programmatic API with a custom extractor |
| No request validation | Pair with a Zod schema library on the frontend |

> Route annotation support (jsdoc-style body/response hints) is on the
> [roadmap](./01-introduction.md#next-steps).
