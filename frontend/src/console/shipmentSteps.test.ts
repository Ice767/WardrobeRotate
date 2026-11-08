import {describe, expect, it} from "vitest";

import {nextStatus, progressPercent} from "./shipmentSteps";

describe("nextStatus", () => {
    it("walks the carrier through the lifecycle", () => {
        expect(nextStatus("CONFIRMED")).toBe("PICKED_UP");
        expect(nextStatus("PICKED_UP")).toBe("IN_TRANSIT");
        expect(nextStatus("IN_TRANSIT")).toBe("DELIVERED");
    });

    it("stops at the final states", () => {
        expect(nextStatus("DELIVERED")).toBeNull();
        expect(nextStatus("CANCELLED")).toBeNull();
    });
});

describe("progressPercent", () => {
    it("fills the track step by step", () => {
        expect(progressPercent("CONFIRMED")).toBe(0);
        expect(progressPercent("PICKED_UP")).toBe(33);
        expect(progressPercent("IN_TRANSIT")).toBe(67);
        expect(progressPercent("DELIVERED")).toBe(100);
    });

    it("shows a cancelled shipment as never started", () => {
        expect(progressPercent("CANCELLED")).toBe(0);
    });
});
