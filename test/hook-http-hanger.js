// Test preloader: leaves every outbound HTTP request permanently unsettled.
// The hook's own safety deadline must be what exits the process; unlike
// hook-http-blocker.js, this emits no error and invokes no timeout callback.
const http = require("http");
const { EventEmitter } = require("events");
const fs = require("fs");

function record(entry) {
  const recordPath = process.env.CLAWD_TEST_HOOK_HANGER_RECORD;
  if (!recordPath) return;
  fs.appendFileSync(recordPath, JSON.stringify({ ...entry, at: Date.now() }) + "\n");
}

// A delayed-stdin test can start its delay after Node has actually launched,
// excluding the cmd/PowerShell startup that happens before this preloader.
record({ kind: "ready" });

function hangingRequest(method) {
  record({ kind: "request", method });
  const req = new EventEmitter();
  req.setTimeout = () => req;
  req.destroy = () => req;
  req.write = () => true;
  req.end = () => req;
  return req;
}

http.get = () => hangingRequest("GET");
http.request = () => hangingRequest("POST");
