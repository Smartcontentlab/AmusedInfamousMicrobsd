---
name: Live runtime protocols
description: Non-obvious lifecycle and capability conventions for the supported Hermes and OpenClaw runtime adapters.
---

Hermes exposes its controller surface under the documented `/v1` API: health, capabilities, run submission, run status, and run stop. Its capability response uses feature names such as `run_submission`, `run_status`, and `run_stop`, which must be normalized before the Mission Control UI consumes them.

OpenClaw is controlled through its gateway WebSocket protocol. Launch and abort use gateway RPC, while `agent.wait` is a safe bounded poll that returns `ok`, `error`, or `timeout` without stopping the underlying run. Gateway payloads are direct RPC payloads, unlike the HTTP adapter's `{ data, latencyMs }` wrapper.

**Why:** Provider responses look superficially similar but differ in transport, field names, and lifecycle semantics; treating them as one generic REST shape caused incorrect paths and status handling.

**How to apply:** Keep provider-specific protocol details inside `runtime-adapters.ts`, normalize statuses/capabilities before persisting them, and never expose raw provider payloads or credentials through API responses.