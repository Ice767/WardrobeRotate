import {describe, expect, it} from "vitest";

import {parseDollars} from "./money";

describe("parseDollars", () => {
    it("turns dollars into cents", () => {
        expect(parseDollars("5.20")).toEqual({cents: 520});
        expect(parseDollars("0")).toEqual({cents: 0});
        expect(parseDollars("100000")).toEqual({cents: 10_000_000});
    });

    it("trims spaces and reads a comma as the decimal point", () => {
        expect(parseDollars(" 5,2 ")).toEqual({cents: 520});
    });

    it("does not lose a cent to floating point", () => {
        expect(parseDollars("0.29")).toEqual({cents: 29});
        expect(parseDollars("1.15")).toEqual({cents: 115});
    });

    it("rejects what is not an amount", () => {
        const notAmount = {error: "Enter an amount in dollars, like 5.20"};

        expect(parseDollars("")).toEqual(notAmount);
        expect(parseDollars("abc")).toEqual(notAmount);
        expect(parseDollars("-1")).toEqual(notAmount);
        expect(parseDollars("1e3")).toEqual(notAmount);
        expect(parseDollars("1,000.50")).toEqual(notAmount);
    });

    it("rejects more than two decimals", () => {
        expect(parseDollars("5.205")).toEqual({error: "Use at most two decimals"});
    });

    it("rejects more than the server allows", () => {
        expect(parseDollars("100001")).toEqual({error: "That is more than $100 000"});
    });
});
