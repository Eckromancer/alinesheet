import { describe, it, expect } from "vitest";
import { GENERIC_RESET_MESSAGE, normalizeRecoveryEmail } from "@/lib/recovery";

describe("portal recovery", () => {
  it("normalizes valid emails", () => {
    expect(normalizeRecoveryEmail("  Elizabeth.Eckland@Saks.com ")).toBe("elizabeth.eckland@saks.com");
  });
  it("rejects non-emails such as employee IDs", () => {
    expect(normalizeRecoveryEmail("123456")).toBeNull();
    expect(normalizeRecoveryEmail("a@b")).toBeNull();
    expect(normalizeRecoveryEmail("x".repeat(320) + "@a.com")).toBeNull();
  });
  it("generic message reveals nothing about account existence", () => {
    expect(GENERIC_RESET_MESSAGE).not.toMatch(/not found|no account|invalid|rate/i);
  });
});
