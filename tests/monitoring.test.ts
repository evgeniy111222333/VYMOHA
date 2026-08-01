import { describe, expect, it, vi } from "vitest";
import { runMonitoringCycle } from "@/src/services/monitoring/run-cycle";
import { tenderFixture } from "./fixtures";

describe("monitoring cycle", () => {
  it("updates changed tenders, sends a notification, and writes an audit event", async () => {
    const update = vi.fn(async () => undefined);
    const notify = vi.fn(async () => "sent" as const);
    const audit = vi.fn(async () => undefined);
    const result = await runMonitoringCycle({ notificationApiKey: "configured" }, {
      list: async () => [{
        id: "watch-1", userId: "user-1", tenderExternalId: "UA-2026-08-01-000463-A",
        lastModified: "2026-08-01T08:00:00Z", notifyEmail: "owner@example.com", active: true,
        createdAt: "2026-08-01T08:00:00Z",
      }],
      fetch: async () => tenderFixture({ dateModified: "2026-08-01T10:00:00Z" }),
      update, notify, audit,
    });
    expect(result).toEqual({ checked: 1, changed: 1, failed: 0 });
    expect(notify).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith("watch-1", "2026-08-01T10:00:00Z");
    expect(audit).toHaveBeenCalledOnce();
  });

  it("does nothing when the procurement version is unchanged", async () => {
    const update = vi.fn(async () => undefined);
    const notify = vi.fn(async () => "sent" as const);
    const version = "2026-08-01T10:00:00Z";
    const result = await runMonitoringCycle({}, {
      list: async () => [{ id: "w", userId: "u", tenderExternalId: "UA-2026-08-01-000463-A", lastModified: version, notifyEmail: "x@example.com", active: true, createdAt: version }],
      fetch: async () => tenderFixture({ dateModified: version }),
      update, notify, audit: async () => undefined,
    });
    expect(result.changed).toBe(0);
    expect(update).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });
});
