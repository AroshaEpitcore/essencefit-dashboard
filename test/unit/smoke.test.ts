import { describe, it, expect } from "vitest";
import { money } from "@/components/shop/format";

describe("unit smoke", () => {
  it("runs and resolves the @ alias to src", () => {
    expect(money(1890)).toBe("Rs. 1,890");
  });
});
