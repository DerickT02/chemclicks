import { execFile, spawn, type ChildProcess } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Run the real proxy and error pages through Next, with no application credentials
// or database clients. Component rendering alone cannot verify HTTP statuses.
let directory: string;
let server: ChildProcess;
let origin: string;
let logs = "";

function get(path: string, method = "GET"): Promise<{ status: number; body: string; headers: import("node:http").IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = request(`${origin}${path}`, { method }, response => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", chunk => { body += chunk; });
      response.on("end", () => resolve({ status: response.statusCode!, body, headers: response.headers }));
      response.on("error", reject);
    });
    req.setTimeout(60_000, () => req.destroy(new Error(`HTTP test timed out: ${logs}`)));
    req.on("error", reject);
    req.end();
  });
}

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "chemclicks-http-"));
  async function put(path: string, content: string) {
    await mkdir(dirname(join(directory, path)), { recursive: true });
    await writeFile(join(directory, path), content);
  }
  await symlink(join(process.cwd(), "node_modules"), join(directory, "node_modules"), "dir");
  await put("package.json", JSON.stringify({ private: true }));
  await put("tsconfig.json", JSON.stringify({ compilerOptions: { jsx: "react-jsx", paths: { "@/*": ["./src/*"] } } }));
  for (const path of [
    "src/proxy.ts", "src/app/forbidden/page.tsx", "src/app/error/page.tsx",
    "src/app/auth/auth-code-error/page.tsx", "src/app/error.tsx", "src/app/not-found.tsx",
    "src/components/error", "src/components/auth/AuthPageLayout.tsx",
  ]) {
    await mkdir(dirname(join(directory, path)), { recursive: true });
    await cp(join(process.cwd(), path), join(directory, path), { recursive: true });
  }
  await put("src/app/layout.jsx", `export default function Layout({children}) { return <html><body>{children}</body></html> }`);
  await put("src/app/page.jsx", `export default function Page() { return <h1>Healthy page</h1> }`);
  await put("src/app/crash/page.jsx", `export const dynamic = "force-dynamic"; export default function Page() { throw new Error("Test render failure") }`);
  await put("src/app/admin/page.jsx", `export default function Page() { return <h1>Protected content</h1> }`);
  await put("src/lib/supabase/admin.js", `export function createAdminClient() { return { from: (table) => ({ select: (columns) => ({ eq: (column, value) => ({ maybeSingle: async () => ({data: null, error: null}) }) }) }) } }`);
  await put("src/lib/supabase/middleware.js", `
    import { NextResponse } from "next/server";
    export async function updateSession(request) {
      const response = NextResponse.next();
      response.cookies.set("refreshed-session", "test", { httpOnly: true });
      return { response, user: { id: "test" }, supabase: { from: (table) => ({ select: (columns) => ({ eq: (column, value) => ({
        maybeSingle: async () => ({ data: null, error: request.nextUrl.searchParams.has("fail") ? { message: "private database detail" } : null })
      }) }) }) } };
    }
  `);
  const next = join(process.cwd(), "node_modules/next/dist/bin/next");
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" };
  try {
    await promisify(execFile)(process.execPath, [next, "build", directory, "--webpack"], { env, timeout: 90_000 });
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string };
    throw new Error(`HTTP fixture build failed: ${failure.stdout}\n${failure.stderr}`, { cause: error });
  }
  server = spawn(process.execPath, [next, "start", directory, "--hostname", "localhost", "--port", "0"], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Next startup timed out: ${logs}`)), 60_000);
    const onData = (chunk: Buffer) => {
      logs += chunk.toString();
      const address = logs.match(/http:\/\/localhost:\d+/);
      if (address) origin = address[0];
      if (origin && /Ready in/.test(logs)) { clearTimeout(timeout); resolve(); }
    };
    server.stdout!.on("data", onData);
    server.stderr!.on("data", onData);
    server.once("error", error => { clearTimeout(timeout); reject(error); });
    server.once("exit", code => { clearTimeout(timeout); reject(new Error(`Next exited (${code}): ${logs}`)); });
  });
}, 120_000);

afterAll(async () => {
  if (server && server.exitCode === null) {
    const exited = new Promise<void>(resolve => server.once("exit", () => resolve()));
    server.kill("SIGKILL");
    await exited;
  }
  if (directory) await rm(directory, { recursive: true, force: true });
}, 30_000);

describe("error page HTTP statuses", () => {
  it.each([
    ["/forbidden", 403, "Forbidden"],
    ["/forbidden?from=admin", 403, "Forbidden"],
    ["/auth/auth-code-error", 400, "complete sign-in"],
    ["/error", 500, "Something went wrong"],
    ["/admin", 403, "Forbidden"],
    ["/admin?fail=1", 500, "Something went wrong"],
  ] as const)("%s returns %i with the error UI, not a redirect", async (path, status, text) => {
    const response = await get(path);
    expect(response.status).toBe(status);
    expect(response.headers.location).toBeUndefined();
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.headers["set-cookie"]?.join(";")).toContain("refreshed-session=test");
    expect(response.body).toContain(text);
    expect(response.body).not.toContain("Protected content");
    expect(response.body).not.toContain("private database detail");
  }, 90_000);

  it("keeps the status for HEAD requests", async () => {
    expect((await get("/forbidden", "HEAD")).status).toBe(403);
    expect((await get("/error", "HEAD")).status).toBe(500);
  }, 90_000);

  it("returns 500 for a server render error before streaming", async () => {
    expect((await get("/crash")).status).toBe(500);
  }, 90_000);

  it("does not change healthy pages or missing-page statuses", async () => {
    expect((await get("/")).status).toBe(200);
    expect((await get("/does-not-exist")).status).toBe(404);
  }, 90_000);
});
