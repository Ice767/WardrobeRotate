import {describe, expect, it} from "vitest";

import {parseQuantity, volumeProblem, weightProblem} from "./quoteLimits";

describe("weightProblem", () => {
    it("asks for a weight when the field is empty, zero or not a number", () => {
        expect(weightProblem("")).toBe("Enter the weight in kilograms");
        expect(weightProblem("0")).toBe("Enter the weight in kilograms");
        expect(weightProblem("abc")).toBe("Enter the weight in kilograms");
        expect(weightProblem("-5")).toBe("Enter the weight in kilograms");
    });

    it("explains the limit instead of letting the server reject it", () => {
        expect(weightProblem("68001")).toBe("The heaviest single shipment any carrier takes is 68 000 kg. Split the load.");
    });

    it("accepts the limit itself and a comma as the decimal mark", () => {
        expect(weightProblem("68000")).toBeNull();
        expect(weightProblem(" 1250,5 ")).toBeNull();
    });
});

describe("volumeProblem", () => {
    it("asks for a volume when there is none", () => {
        expect(volumeProblem("0")).toBe("Enter the volume in cubic meters");
    });

    it("explains the limit", () => {
        expect(volumeProblem("139")).toBe("The largest single shipment any carrier takes is 138 m³. Split the load.");
        expect(volumeProblem("138")).toBeNull();
    });
});

describe("parseQuantity", () => {
    it("reads a comma as a decimal point and ignores spaces around", () => {
        expect(parseQuantity(" 20,5 ")).toBe(20.5);
    });

    it("gives NaN for text", () => {
        expect(parseQuantity("abc")).toBeNaN();
    });
});
