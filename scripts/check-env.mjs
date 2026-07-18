import { spawnSync } from "node:child_process";

const requireFeishu = process.argv.includes("--require-feishu");

function commandExists(command, args = ["--version"]) {
  let executable = command;
  if (process.platform === "win32") {
    const where = spawnSync("where.exe", [command], {
      encoding: "utf8",
      shell: false
    });
    executable = where.status === 0 ? where.stdout.split(/\r?\n/)[0].trim() : `${command}.cmd`;
  }
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    shell: false
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim()
  };
}

const larkCli = commandExists("lark-cli", ["--version"]);
const nodeVersion = process.version;
const mode = process.env.XTALLOOP_MODE ?? "offline_demo";
const readerProfile = process.env.XTALLOOP_FEISHU_READER_PROFILE ?? "xtal-reader";
const writerProfile = process.env.XTALLOOP_FEISHU_WRITER_PROFILE ?? "xtal-writer";
const allowRealDryRun = process.env.XTALLOOP_ALLOW_REAL_DRY_RUN === "1";

const checks = [
  {
    item: "Node.js",
    ok: true,
    detail: nodeVersion
  },
  {
    item: "lark-cli",
    ok: larkCli.ok,
    detail: larkCli.ok ? larkCli.stdout || "installed" : "not found; offline demo still works"
  },
  {
    item: "offline demo",
    ok: true,
    detail: "npm test and npm run demo:e2e do not require Feishu credentials"
  },
  {
    item: "reader profile",
    ok: Boolean(readerProfile),
    detail: readerProfile
  },
  {
    item: "writer profile",
    ok: Boolean(writerProfile),
    detail: writerProfile
  },
  {
    item: "real dry-run opt-in",
    ok: allowRealDryRun || mode !== "real_feishu",
    detail: allowRealDryRun ? "enabled" : "disabled by default"
  }
];

console.log("# XtalLoop environment check");
for (const check of checks) {
  console.log(`${check.ok ? "OK" : "WARN"} ${check.item}: ${check.detail}`);
}

if (requireFeishu && !larkCli.ok) {
  console.error("lark-cli is required for real Feishu evaluation.");
  process.exit(1);
}

console.log("");
console.log("Recommended public evaluation commands:");
console.log("  npm install");
console.log("  npm test");
console.log("  npm run demo:e2e");
console.log("");
console.log("For private real Feishu smoke tests, read docs/real-feishu-setup.md.");
