import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("analysis diagnostics exposure", () => {
  it("does not leave a public debug-log route in the worker or application", async () => {
    const worker = await readFile(join(process.cwd(), "worker", "index.ts"), "utf8");
    const debugRoute = join(process.cwd(), "app", "api", "debug", "analysis-log", "route.ts");
    await expect(readFile(debugRoute, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    expect(worker).not.toContain("/api/debug/analysis-log");
    expect(worker).not.toContain("getAnalysisDebugLog");
  });

  it("does not retain sensitive analysis payloads in a global debug buffer", async () => {
    const enhancer = await readFile(join(process.cwd(), "src", "infrastructure", "openai", "enhancer.ts"), "utf8");
    expect(enhancer).not.toContain("__vymoha_analysis_debug_log__");
    expect(enhancer).not.toContain("getAnalysisDebugLog");
    expect(enhancer).not.toContain("promptPreview");
    expect(enhancer).not.toContain("responseError");
  });

  it("keeps diagnostics behind authenticated admin access with no-store responses", async () => {
    const route = await readFile(join(process.cwd(), "app", "api", "admin", "diagnostics", "route.ts"), "utf8");
    expect(route).toContain("requireRequestUser(request)");
    expect(route).toContain("requireAdmin(user.id)");
    expect(route).toContain('"cache-control": "private, no-store"');
    expect(route).toContain('"x-robots-tag": "noindex, nofollow, noarchive"');
  });
});
