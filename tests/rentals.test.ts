import { describe, expect, it } from "vitest";
import { landlordBalance, nextRentIncrease, rentSchedule } from "@/features/rentals/terms";

describe("rent schedule", () => {
  it("rounds to rupees and compounds every 12 months", () => {
    const schedule = rentSchedule("2024-02-29", "50000", "10", 25);
    expect(schedule[0]).toEqual({ period: "2024-02-01", rent: "50000" });
    expect(schedule[11].rent).toBe("50000");
    expect(schedule[12].rent).toBe("55000");
    expect(schedule[24].rent).toBe("60500");
    expect(rentSchedule("2026-01-01", "50000.50", "0", 1)[0].rent).toBe("50001");
  });

  it("shows only a future anniversary within the lease", () => {
    expect(nextRentIncrease("2024-02-29", "2026-03-01", "2024-12-31")).toBe("2025-02-28");
    expect(nextRentIncrease("2024-02-29", "2026-03-01", "2025-02-28")).toBe("2026-02-28");
    expect(nextRentIncrease("2024-02-29", "2025-02-27", "2024-12-31")).toBeNull();
  });
});

describe("landlord balance", () => {
  it("subtracts commission and payouts using decimal arithmetic", () => {
    expect(landlordBalance("50000", "2500", "10000").toString()).toBe("37500");
    expect(landlordBalance("0.30", "0.10", "0.20").toString()).toBe("0");
    expect(landlordBalance(0, 0, "10000").toString()).toBe("-10000");
  });
});
