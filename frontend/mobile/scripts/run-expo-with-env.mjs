import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import dotenv from "dotenv";

const [, , envFileArg, ...expoArgs] = process.argv;

if (!envFileArg) {
  console.error("Missing env file path.");
  process.exit(1);
}

const cwd = process.cwd();
const envFilePath = path.resolve(cwd, envFileArg);

if (!fs.existsSync(envFilePath)) {
  console.error(`Env file not found: ${envFilePath}`);
  process.exit(1);
}

const parsed = dotenv.parse(fs.readFileSync(envFilePath));
const env = {
  ...process.env,
  ...parsed,
};

const child =
  process.platform === "win32"
    ? spawn("cmd.exe", ["/d", "/s", "/c", "npx", "expo", ...expoArgs], {
        cwd,
        stdio: "inherit",
        env,
      })
    : spawn("npx", ["expo", ...expoArgs], {
        cwd,
        stdio: "inherit",
        env,
      });

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
