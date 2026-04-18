import { describe, it, expect } from "vitest";
import { generateCredentialCode, generateQrCodeValue } from "./credentialUtils";

describe("generateCredentialCode", () => {
  it("starts with JER-", () => {
    expect(generateCredentialCode()).toMatch(/^JER-/);
  });

  it("matches the format JER-{base36}-{4chars}", () => {
    expect(generateCredentialCode()).toMatch(/^JER-[A-Z0-9]+-[A-Z0-9]{4}$/);
  });

  it("generates unique codes on each call", () => {
    const codes = new Set(Array.from({ length: 50 }, generateCredentialCode));
    expect(codes.size).toBe(50);
  });

  it("contains only uppercase alphanumeric characters after JER-", () => {
    const code = generateCredentialCode();
    const withoutPrefix = code.slice(4); // remove "JER-"
    expect(withoutPrefix).toMatch(/^[A-Z0-9-]+$/);
  });
});

describe("generateQrCodeValue", () => {
  it("returns the canonical jer: format", () => {
    const result = generateQrCodeValue("event-1", "participant-2", "JER-ABC-1234");
    expect(result).toBe("jer:event-1:participant-2:JER-ABC-1234");
  });

  it("starts with jer:", () => {
    expect(generateQrCodeValue("e", "p", "c")).toMatch(/^jer:/);
  });

  it("includes all three segments separated by colons", () => {
    const result = generateQrCodeValue("evt", "part", "code");
    const parts = result.split(":");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("jer");
    expect(parts[1]).toBe("evt");
    expect(parts[2]).toBe("part");
    expect(parts[3]).toBe("code");
  });

  it("preserves special characters in ids", () => {
    const result = generateQrCodeValue("evt-123", "part-456", "JER-M1ABC-K7X9");
    expect(result).toBe("jer:evt-123:part-456:JER-M1ABC-K7X9");
  });
});
