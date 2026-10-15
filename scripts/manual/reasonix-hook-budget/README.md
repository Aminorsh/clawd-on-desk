# Reasonix Windows hook budget (#1198)

This manual check uses the official Reasonix consumer at
`b5b7cf49e6aed3b0f65ebc72a1c1602183aa7d49`: `Load` → `Runner` →
`DefaultSpawner` → cmd → the actual Clawd-generated PowerShell command → Node.
It fires `UserPromptSubmit` and `PreToolUse` directly, without a CLI session,
model request, tool execution, or access to the user's Reasonix configuration.

## Build

Obtain the complete pinned [official source](https://github.com/esengine/DeepSeek-Reasonix/tree/b5b7cf49e6aed3b0f65ebc72a1c1602183aa7d49)
in an isolated temporary directory. Copy this directory's `main.go` into that
module as `cmd/clawd-consumer-check/main.go` (required by Go's internal imports).
From that source directory, build with an installed Go 1.26.x:

```powershell
# validationRoot is the absolute, dedicated temporary test directory.
$env:GOTOOLCHAIN = 'local'
$env:GOCACHE = Join-Path $validationRoot 'go-build-cache'
go build -mod=readonly -o (Join-Path $validationRoot 'reasonix-native-consumer.exe') ./cmd/clawd-consumer-check
```

Missing module dependencies may download normally. Preserve `go.mod`/`go.sum`
and network settings; do not install a different toolchain to hide a failure.

## Run on Windows

Set `driver` to this directory's `run-consumer.cjs`, `consumer` to the built
executable, and `fixedRepo` / `oldRepo` to isolated Clawd checkouts. The old
control uses the original hook from `c52e2df6`. Run sequentially:

```powershell
node $driver --consumer $consumer --repo $fixedRepo --mode normal --expect pass
node $driver --consumer $consumer --repo $fixedRepo --mode stream --expect pass
node $driver --consumer $consumer --repo $fixedRepo --mode stream --delay-ms 1800 --expect pass
node $driver --consumer $consumer --repo $oldRepo --mode stream --delay-ms 1800 --expect block
```

Each command checks both events and prints JSON evidence. `--event` selects one
event; `--repeat 2` repeats sequentially. The driver owns a real loopback HTTP
fixture at port 23337, refusing to reuse an occupied port (`--port` may select
another free Clawd port in 23333–23337). Settings, runtime identity, PID cache
and optional preload all use a new temporary home, removed after the run.
No installer or live Clawd service is needed.

Normal HTTP returns the Clawd identity header and a completed response.
Streaming HTTP sends a byte every 30ms without an identity header or EOF;
this keeps the socket inactivity timeout alive without monkeypatching HTTP.
The optional delay is injected **before** the hook script starts its clock.
It is controlled launch overhead, not evidence that ordinary machines always
take that long to launch.

Pass requires the official 5000ms timeout, one actual POST for the event,
silent exit 0, no timeout, and `blocked=false`. The old negative control must
instead produce both `timedOut=true` and `blocked=true`; an unrelated spawn
error does not count. After a blocked control, the driver waits for the
synthetic Node descendant to finish naturally rather than killing unrelated
Windows processes.

This validates the pinned native hook consumer, not a full installed Reasonix
session or production failure frequency. Its consequences differ by event:
`UserPromptSubmit` blocks the submission; `PreToolUse` blocks the tool call.
