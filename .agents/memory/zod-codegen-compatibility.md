---
name: Generated Zod compatibility
description: Compatibility constraint between Orval-generated response schemas and the workspace Zod version.
---

OpenAPI integer response fields may generate `zod.int()` in the shared API validation package. That helper is not available in Zod 3, so either keep the workspace on the generator-compatible Zod major or model response counts as plain numbers when the API does not need integer validation.

**Why:** The workspace currently has a Zod 3 catalog while the installed Orval generator emits Zod 4-style helpers for OpenAPI integer schemas.

**How to apply:** After changing the OpenAPI contract, run codegen and the shared library typecheck before implementing consumers; resolve any generator/runtime mismatch at the contract or dependency boundary.