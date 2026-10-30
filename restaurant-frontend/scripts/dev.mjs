import { spawn, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Resolve paths from THIS script's location - never from the shell's cwd.
// Works from monorepo root (`npm run dev`) or the frontend folder.
// ---------------------------------------------------------------------------
const frontendDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const backendDir = path.resolve(frontendDir, "../restaurant-backend");
const nextBin = path.join(frontendDir, "node_modules/next/dist/bin/next");
const API_URL = "http://127.0.0.1:8000";
const WEB_URL = "http://localhost:3000";

// --- pre-flight validation ---------------------------------------------------
console.log("[dev] Checking RMS environment...");
if (!existsSync(path.join(frontendDir, "package.json"))) {
  console.error(`[dev] Frontend package.json not found at: ${frontendDir}`);
  process.exit(1);
}
if (!existsSync(path.join(backendDir, "artisan"))) {
  console.error(`[dev] Backend artisan not found at: ${backendDir}`);
  process.exit(1);
}
if (!existsSync(nextBin)) {
  console.error("[dev] Next.js is not installed. Run: npm install");
  process.exit(1);
}

// --- toolchain validation ----------------------------------------------------
for (const tool of ["php", "node"]) {
  const probe = spawn(tool, ["-v"], { stdio: "ignore" });
  await new Promise((resolve) => {
    probe.once("error", () => {
      console.error(`[dev] ${tool} was not found on PATH. Install it and retry.`);
      process.exit(1);
    });
    probe.once("close", resolve);
  });
}

// ---------------------------------------------------------------------------
// Port inspection - netstat is authoritative on Windows (a socket probe bound
// to 127.0.0.1 can falsely succeed while another process holds 0.0.0.0).
// ---------------------------------------------------------------------------
function findPortOwnerPid(port) {
  try {
    if (os.platform() === "win32") {
      const out = execFileSync("netstat", ["-ano"], {
        encoding: "utf8",
        timeout: 5000,
      });
      for (const line of out.split("\n")) {
        const cols = line.trim().split(/\s+/);
        // TCP  0.0.0.0:3000  0.0.0.0:0  LISTENING  1234
        if (
          cols.length >= 5 &&
          cols[0] === "TCP" &&
          cols[1].endsWith(`:${port}`) &&
          cols[3] === "LISTENING"
        ) {
          return cols[4];
        }
      }
      return null;
    }
    const out = execFileSync(
      "lsof",
      [`-tiTCP:${port}`, "-sTCP:LISTEN"],
      { encoding: "utf8", timeout: 5000 },
    );
    return out.split("\n")[0]?.trim() || null;
  } catch {
    return null;
  }
}

/** Process image name (report only). */
function describePid(pid) {
  if (!pid) return "";
  try {
    if (os.platform() === "win32") {
      const out = execFileSync(
        "tasklist",
        ["/fi", `PID eq ${pid}`, "/fo", "csv", "/nh"],
        { encoding: "utf8", timeout: 5000 },
      );
      const first = out.split("\n")[0]?.trim() ?? "";
      if (!first || first.toUpperCase().startsWith("INFO:")) return "";
      return ` (${first.split('","')[0]?.replace(/^"/, "") ?? "unknown"})`;
    }
    const out = execFileSync("ps", ["-p", String(pid), "-o", "comm="], {
      encoding: "utf8",
      timeout: 5000,
    });
    return out.trim() ? ` (${out.trim().split("/").pop()})` : "";
  } catch {
    return "";
  }
}

/** Command line of a PID - used to PROVE ownership before any termination. */
function getProcessCommandLine(pid) {
  try {
    if (os.platform() === "win32") {
      const out = execFileSync(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`,
        ],
        { encoding: "utf8", timeout: 15000 },
      );
      return (out ?? "").trim();
    }
    const out = execFileSync("ps", ["-p", String(pid), "-o", "args="], {
      encoding: "utf8",
      timeout: 5000,
    });
    return out.trim();
  } catch {
    return "";
  }
}

/**
 * TRUE only when the command line provably references THIS RMS checkout
 * (canonical frontend/backend paths). Never guesses, never matches by
 * image name alone.
 */
function belongsToThisRms(pid) {
  if (!pid) return false;
  const cl = getProcessCommandLine(pid).toLowerCase();
  if (!cl) return false;
  return (
    cl.includes(frontendDir.toLowerCase()) ||
    cl.includes(backendDir.toLowerCase())
  );
}

function terminatePidTree(pid, reasonLabel) {
  console.log(
    `[dev] Stopping stale RMS ${reasonLabel} (PID ${pid})...`,
  );
  try {
    if (os.platform() === "win32") {
      execFileSync("taskkill", ["/pid", String(pid), "/T", "/F"], {
        stdio: "ignore",
        timeout: 10000,
      });
    } else {
      process.kill(Number(pid), "SIGKILL");
    }
  } catch {
    /* already gone */
  }
}

// node:http with agent:false (Connection: close) - fetch()'s undici
// keep-alive sockets made process.exit() assert-crash libuv on Windows.
function httpStatus(url) {
  return new Promise((resolve) => {
    try {
      const req = http.get(url, { agent: false }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      req.on("error", () => resolve(0));
      req.setTimeout(5000, () => {
        req.destroy();
        resolve(0);
      });
    } catch {
      resolve(0);
    }
  });
}

function isPortBusy(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(true));
    probe.once("listening", () => probe.close(() => resolve(false)));
    probe.listen(port, "127.0.0.1");
  });
}

/**
 * Classify one port:
 *   free     - nothing listening
 *   healthy  - verified RMS process AND service responds
 *   stale    - verified RMS process BUT service dead/unresponsive
 *   unknown  - listening, but ownership cannot be proven -> never touched
 */
async function classifyPort(port, healthUrl, expectStatus) {
  const pid = findPortOwnerPid(port);
  if (!pid && !(await isPortBusy(port))) return { state: "free" };
  if (!belongsToThisRms(pid)) return { state: "unknown", pid };
  const status = await httpStatus(healthUrl);
  const healthy = expectStatus ? status === expectStatus : status > 0 && status < 500;
  if (!healthy && pid) console.log(`[dev] Health probe ${healthUrl} -> HTTP ${status} (pid ${pid})`);
  return { state: healthy ? "healthy" : "stale", pid, status };
}

console.log(`[dev] Checking ports...`);
const laravelPort = await classifyPort(8000, `${API_URL}/up`, 200);
const nextPort = await classifyPort(3000, WEB_URL, 0);

for (const [{ port }, result] of [
  [{ port: 8000 }, laravelPort],
  [{ port: 3000 }, nextPort],
]) {
  if (result.state !== "unknown") continue;
  console.error(`Port ${port} is occupied by PID ${result.pid}${describePid(result.pid)}.`);
  console.error("Unable to verify it belongs to this RMS.");
  console.error("Stop it manually before continuing.");
  if (os.platform() === "win32") {
    console.error(`  (inspect: Get-CimInstance Win32_Process -Filter "ProcessId=${result.pid}")`);
    console.error(`  (stop   : taskkill /PID ${result.pid} /T /F)`);
  }
  process.exit(1);
}

// A previous, fully-healthy RMS session is already up -> do nothing.
if (laravelPort.state === "healthy" && nextPort.state === "healthy") {
  console.log("RMS development server is already running.");
  console.log("");
  console.log("Frontend: http://localhost:3000");
  console.log("Backend : http://127.0.0.1:8000");
  process.exit(0);
}

if (nextPort.state === "healthy") {
  console.error(`RMS frontend is already running on port 3000 (PID ${nextPort.pid}${describePid(nextPort.pid)}).`);
  console.error("Use the existing instance or stop it before starting another.");
  process.exit(1);
}

// Verified-RMS but dead/unresponsive -> clean up before starting fresh.
if (laravelPort.state === "stale") terminatePidTree(laravelPort.pid, "Laravel");
if (nextPort.state === "stale") terminatePidTree(nextPort.pid, "Next.js");

// ---------------------------------------------------------------------------
// Graceful shutdown - kills ONLY the two child trees this script created.
// ---------------------------------------------------------------------------
let api = null;
let web = null;
let stopping = false;

function killTree(child) {
  if (!child || child.pid == null || child.exitCode !== null) return;
  try {
    if (os.platform() === "win32") {
      // Targeted tree-kill of OUR pid only - never taskkill by image name.
      // execFileSync guarantees the kill completes before we continue/exit.
      execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        timeout: 5000,
      });
    } else {
      child.kill("SIGTERM");
    }
  } catch {
    /* process already gone */
  }
}

function stop() {
  if (stopping) return;
  stopping = true;
  killTree(api);
  killTree(web);
}

// Child trees are killed synchronously above, so it is safe to exit right away.
// Without this the supervisor lingers after Ctrl+C / a closed terminal, leaving
// an orphan that holds no ports and makes the next launch confusing.
function shutdown(exitCode = 0) {
  stop();
  process.exit(exitCode);
}

process.once("SIGINT", () => shutdown(0));
process.once("SIGTERM", () => shutdown(0));
// NOTE: the stdin-end watchdog is armed later, right before children spawn.
// Arming it earlier made clean early exits assert-crash libuv on Windows.

// ---------------------------------------------------------------------------
// Combined, readable, prefixed output in the SAME terminal.
// ---------------------------------------------------------------------------
const DIM = "\x1b[2m";
const RESET_C = "\x1b[0m";
const LABEL_COLOR = { Laravel: "\x1b[36m", Next: "\x1b[35m" };

function pipe(label, stream) {
  readline.createInterface({ input: stream }).on("line", (line) => {
    if (line.trim().length === 0) return;
    const color = LABEL_COLOR[label] ?? "";
    console.log(`${DIM}${color}[${label}]${RESET_C} ${line}`);
  });
}

function watchChild(child) {
  const name = child === api ? "Laravel" : "Next";

  child.on("error", (error) => {
    console.error(`[${name}] could not start: ${error.message}`);
    stop();
    process.exitCode = 1;
  });

  child.on("exit", (code) => {
    if (stopping) return; // normal Ctrl+C shutdown - already handled
    console.error(`[${name}] exited unexpectedly (exit code ${code ?? "signal"}). Stopping the other process...`);
    stop();
    process.exitCode = typeof code === "number" && code !== 0 ? code : 1;
    setTimeout(() => process.exit(process.exitCode), 750);
  });
}

// ---------------------------------------------------------------------------
// Start order: Laravel FIRST, wait until /up returns 200, THEN start Next.js.
// Reuses an externally-healthy Laravel when one is already running.
// This prevents ECONNRESET from the frontend proxy hitting a cold backend.
// ---------------------------------------------------------------------------
console.log(`${DIM}[dev] Frontend: ${frontendDir}${RESET_C}`);
console.log(`${DIM}[dev] Backend : ${backendDir}${RESET_C}`);

const reuseLaravel = laravelPort.state === "healthy";

// From here on we own child processes: arm the stdin watchdog so a closed
// terminal window also shuts the children down.
process.stdin.resume();
process.stdin.once("end", () => shutdown(0));
process.stdin.once("close", () => shutdown(0));

if (reuseLaravel) {
  console.log(`${DIM}[dev] Laravel already running and healthy (PID ${laravelPort.pid}) - reusing it.${RESET_C}`);
} else {
  console.log(`${DIM}[dev] Starting Laravel...${RESET_C}`);
  api = spawn("php", ["artisan", "serve", "--host=127.0.0.1", "--port=8000"], {
    cwd: backendDir,
    stdio: ["ignore", "pipe", "pipe"],
  });
  pipe("Laravel", api.stdout);
  pipe("Laravel", api.stderr);
  watchChild(api);
}

console.log(`${DIM}[dev] Waiting for Laravel at ${API_URL}/up ...${RESET_C}`);

const backendUp = await new Promise((resolve) => {
  const deadline = Date.now() + 30000;
  const attempt = async () => {
    const status = await httpStatus(`${API_URL}/up`);
    if (status === 200) return resolve(true);
    if (api && api.exitCode !== null) return resolve(false); // crashed early
    if (Date.now() > deadline) return resolve(false);
    setTimeout(attempt, 500);
  };
  attempt();
});

if (!backendUp || (api && api.exitCode !== null)) {
  console.error("[dev] Laravel failed to become healthy within 30s.");
  console.error("[dev] Check the [Laravel] output above for the actual error.");
  stop();
  setTimeout(() => process.exit(1), 1000);
} else {
  console.log(`${DIM}[dev] Laravel healthy.${RESET_C}`);
  if (nextPort.state === "stale") {
    // give the OS a beat to release the port after tree-kill
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log(`${DIM}[dev] Starting Next.js...${RESET_C}`);
  web = spawn(
    process.execPath,
    [nextBin, "dev", "--webpack", "--hostname", "0.0.0.0", "--port", "3000"],
    {
      cwd: frontendDir,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  pipe("Next", web.stdout);
  pipe("Next", web.stderr);
  watchChild(web);

  console.log(`${DIM}[dev] RMS development environment ready.${RESET_C}`);
  console.log(`${DIM}[dev] Frontend: ${WEB_URL}${RESET_C}`);
  console.log(`${DIM}[dev] Backend : ${API_URL}${RESET_C}`);
}
