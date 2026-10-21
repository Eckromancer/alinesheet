import { describe, it, expect } from "vitest";
import { allocateUnits } from "./nuorder";

describe("allocateUnits", () => {
  it("splits units evenly across sizes", () => {
    expect([...allocateUnits(6, [4, 2, 6])]).toEqual([[2, 2], [4, 2], [6, 2]]);
  });
  it("gives remainder to smallest sizes", () => {
    expect([...allocateUnits(5, [8, 6])]).toEqual([[6, 3], [8, 2]]);
  });
  it("returns nothing with no sizes", () => {
    expect(allocateUnits(4, []).size).toBe(0);
  });
});
