# @cascade/shared

The shared API contract: **zod schemas + inferred TypeScript types** used on both
sides of the wire — the backend validates request bodies with the schemas, the
frontend types its requests/responses with the inferred types. One definition, no
drift.

## Layout

```
src/index.ts    every schema/type, exported from the single barrel
```

There is **no build step**. `package.json` points `main`/`types`/`exports` straight at
`src/index.ts`; the backend consumes it through tsx and the frontend through Vite, both
of which compile TS on the fly. `npm run typecheck -w @cascade/shared` is the only
workspace script.

## Conventions

- Pattern per contract: a zod schema plus its inferred request type, and a plain
  `type` for the response shape:

  ```ts
  export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(4) });
  export type LoginRequest = z.infer<typeof loginSchema>;
  export type LoginResponse = { token: string; user: AuthUser };
  ```

- Keep it dependency-light: `zod` is the only runtime dependency. Nothing
  Express-specific, React-specific, or Prisma-generated belongs here.
- Import from the package name on both sides:
  `import { loginSchema, type LoginResponse } from '@cascade/shared'`.

## How to extend

Add the schema/types to `src/index.ts`, use the schema in the backend route's body
validation, and type the frontend call with the inferred/response types. Not every
endpoint has a shared contract yet — routes with inline zod schemas are fine; promote a
contract here once the frontend needs the same shape.
