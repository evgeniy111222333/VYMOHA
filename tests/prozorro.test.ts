import { afterEach, describe, expect, it, vi } from "vitest";
import { extractTenderReference, fetchTender } from "@/src/infrastructure/prozorro/client";

afterEach(() => vi.unstubAllGlobals());

describe("Prozorro reference parsing", () => {
  it("extracts a procurement id from a full URL", () => {
    expect(extractTenderReference("https://prozorro.gov.ua/uk/tender/UA-2026-08-01-000463-a"))
      .toBe("UA-2026-08-01-000463-A");
  });

  it("accepts normalized internal ids", () => {
    expect(extractTenderReference("ABCDEF0123456789ABCDEF0123456789"))
      .toBe("abcdef0123456789abcdef0123456789");
  });

  it("rejects arbitrary URLs and text", () => {
    expect(() => extractTenderReference("https://evil.example/tender/123")).toThrow(/UA-2026/);
  });

  it("resolves a public tender id through the official portal summary", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(Response.json({ id: "2f738339fc9b4f97895110e43ff032f2" }))
      .mockResolvedValueOnce(Response.json({ data: {
        id: "2f738339fc9b4f97895110e43ff032f2",
        tenderID: "UA-2026-07-15-007537-a",
        title: "Послуги з ремонту автомобілів",
        status: "active.qualification",
        value: { amount: 470000, currency: "UAH", valueAddedTaxIncluded: false },
        tenderPeriod: { endDate: "2026-07-28T00:00:00+03:00" },
      } }));
    vi.stubGlobal("fetch", request);

    const tender = await fetchTender("UA-2026-07-15-007537-a");

    expect(request).toHaveBeenNthCalledWith(1,
      "https://prozorro.gov.ua/api/tenders/UA-2026-07-15-007537-A/summary",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(String(request.mock.calls[1]?.[0])).toBe(
      "https://public-api.prozorro.gov.ua/api/2.5/tenders/2f738339fc9b4f97895110e43ff032f2",
    );
    expect(request.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ cache: "no-store" }));
    expect(tender.externalId).toBe("UA-2026-07-15-007537-a");
    expect(tender.amount).toBe(470000);
  });
});
