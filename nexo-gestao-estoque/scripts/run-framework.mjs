import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readExecutionProfile } from "./execution-profile.mjs";

const [command, ...args] = process.argv.slice(2);
if (!["dev", "build"].includes(command)) throw new Error("Expected dev or build.");
const managedLinux = readExecutionProfile() === "managed-linux";

// Local Windows/macOS development needs only Next.js and Supabase.
// The Cloudflare Vite plugin starts Miniflare, which can fail before the UI
// is served on machines where local worker requests are interrupted.
if (!managedLinux && command === "dev") {
  const nextCli = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
  const child = spawn(process.execPath, [nextCli, "dev", "--hostname", "127.0.0.1", "--port", "5173", ...args], {
    stdio: "inherit",
    env: process.env,
  });
  child.on("error", error => {
    console.error(error);
    process.exitCode = 1;
  });
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => child.kill(signal));
  }
  await new Promise(resolve => child.on("close", (code, signal) => {
    process.exitCode = signal ? 0 : code ?? 1;
    resolve();
  }));
  process.exit();
}

if (managedLinux && command === "build") {
  const result = spawnSync("bash", [
    fileURLToPath(new URL("./build-verified.sh", import.meta.url)), ...args,
  ], { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

// Import in this process so the preview owner retains its PID and signals.
const cli = new URL(managedLinux
  ? "../node_modules/vite/bin/vite.js"
  : "../node_modules/vinext/dist/cli.js", import.meta.url);
process.argv = [process.execPath, fileURLToPath(cli), command,
  ...(!managedLinux && command === "dev" ? ["--port", "5173"] : []), ...args];
await import(cli.href);
