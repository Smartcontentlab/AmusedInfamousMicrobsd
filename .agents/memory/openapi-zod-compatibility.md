---
name: OpenAPI Zod compatibility
description: Integer fields generated from the API contract need special care with the workspace validator version.
---

The current OpenAPI generator emits `zod.int()` for `type: integer`, but the workspace catalog resolves `zod` to a version that does not expose that helper through the generator's import path. Model numeric API values as `type: number` unless the validation dependency is upgraded deliberately across the workspace. Orval can also emit duplicate public names when a request body schema and generated TypeScript body type share a name; keep the runtime schema export public and make generated types opt-in.

**Why:** Code generation can succeed while the chained shared-library typecheck fails on generated integer validators.

**How to apply:** After introducing or changing integer-shaped OpenAPI fields, run the normal codegen command and its library typecheck immediately. Prefer `number` for IDs, counters, and monetary cents in this workspace until its Zod catalog version and generator compatibility are updated together. After adding request bodies, check the generated barrel for collisions before completing codegen.