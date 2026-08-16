import { describe, expect, it } from "vitest";
import { cpvClass, cpvClassName, cpvDivision, cpvDivisionName } from "@/src/content/cpv";

describe("CPV classification helpers", () => {
  it("maps a CPV code to its division", () => {
    expect(cpvDivision("45233000-9")).toBe("45");
    expect(cpvDivisionName("45233000-9")).toBe("Будівельні роботи");
    expect(cpvDivisionName("15000000-8")).toBe("Харчові продукти та напої");
  });

  it("maps a CPV code to its class name", () => {
    expect(cpvClass("45233000-9")).toBe("45233");
    expect(cpvClassName("45233000-9")).toBe("Будівництво та ремонт доріг");
    expect(cpvClassName("09130000-1")).toBe("Дизельне паливо та бензин");
    expect(cpvClassName("45000000-7")).toBe("Будівельні роботи");
  });

  it("returns null for unknown or malformed codes", () => {
    expect(cpvDivisionName("99000000-0")).toBeNull();
    expect(cpvClassName("45123456-7")).toBeNull();
    expect(cpvDivisionName(null)).toBeNull();
    expect(cpvDivisionName(undefined)).toBeNull();
    expect(cpvClass("abc")).toBeNull();
  });
});
