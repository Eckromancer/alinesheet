import { describe, it, expect } from "vitest";
import { pickDsaSeason } from "@/lib/seasons";

describe("store associate default season", () => {
  it("uses Pre-Fall 2027 when loaded", () => {
    expect(pickDsaSeason(["Summer 2027", "Resort 2026", "Pre-Fall 2027"])).toBe("Pre-Fall 2027");
  });
  it("falls back to newest season otherwise", () => {
    expect(pickDsaSeason(["Resort 2026", "Summer 2027"])).toBe("Summer 2027");
  });
});
