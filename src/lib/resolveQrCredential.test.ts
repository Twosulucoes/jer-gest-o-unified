import { describe, it, expect } from "vitest";
import { extractCandidates, extractQrToken } from "./resolveQrCredential";

describe("extractCandidates", () => {
  it("returns empty for blank input", () => {
    expect(extractCandidates("")).toEqual({ values: [], cpfDigits: null });
    expect(extractCandidates("   ")).toEqual({ values: [], cpfDigits: null });
  });

  it("includes the trimmed raw value as a candidate", () => {
    const { values } = extractCandidates("  J04382  ");
    expect(values).toContain("J04382");
  });

  it("extracts code from canonical jer:event:participant:code format", () => {
    const { values } = extractCandidates("jer:ev-1:part-9:J04382");
    expect(values).toContain("J04382");
  });

  it("strips JER: and JER-ALJ: legacy prefixes (case-insensitive)", () => {
    expect(extractCandidates("JER:J04382").values).toContain("J04382");
    expect(extractCandidates("jer:J04382").values).toContain("J04382");
    expect(extractCandidates("JER-ALJ:ABCD").values).toContain("ABCD");
  });

  it("parses JSON payloads and pulls credential fields", () => {
    const { values } = extractCandidates(
      JSON.stringify({ qr: "J04382", credential_code: "ABCD" }),
    );
    expect(values).toContain("J04382");
    expect(values).toContain("ABCD");
  });

  it("survives malformed JSON without throwing", () => {
    expect(() => extractCandidates("{not-json")).not.toThrow();
  });

  it("parses URL params and last path segment", () => {
    const { values } = extractCandidates(
      "https://app.example.com/check/J04382?code=ABCD",
    );
    expect(values).toContain("ABCD");
    expect(values).toContain("J04382");
  });

  it("survives malformed URLs without throwing", () => {
    expect(() => extractCandidates("https://[bad")).not.toThrow();
  });

  it("returns cpfDigits only for 11-digit input", () => {
    expect(extractCandidates("123.456.789-00").cpfDigits).toBe("12345678900");
    expect(extractCandidates("12345678900").cpfDigits).toBe("12345678900");
    expect(extractCandidates("J04382").cpfDigits).toBeNull();
    expect(extractCandidates("12345").cpfDigits).toBeNull();
    expect(extractCandidates("123456789012").cpfDigits).toBeNull();
  });

  it("includes uppercase variant for case-insensitive matching", () => {
    const { values } = extractCandidates("abcd");
    expect(values).toContain("ABCD");
  });

  it("does not include empty strings", () => {
    const { values } = extractCandidates("J04382");
    expect(values.every((v) => v.length > 0)).toBe(true);
  });
});

describe("extractQrToken", () => {
  it("returns null for blank input", () => {
    expect(extractQrToken("")).toBeNull();
    expect(extractQrToken("  ")).toBeNull();
  });

  it("extracts token from canonical jer:event:participant:token", () => {
    expect(extractQrToken("jer:ev:part:tok-123")).toBe("tok-123");
  });

  it("strips JER: and JER-ALJ: prefixes", () => {
    expect(extractQrToken("JER:abc")).toBe("abc");
    expect(extractQrToken("jer-alj:xyz")).toBe("xyz");
  });

  it("extracts token field from JSON", () => {
    expect(extractQrToken(JSON.stringify({ token: "tok-xyz" }))).toBe("tok-xyz");
  });

  it("returns short raw values verbatim", () => {
    expect(extractQrToken("J04382")).toBe("J04382");
  });

  it("rejects values shorter than 4 chars", () => {
    expect(extractQrToken("abc")).toBeNull();
  });

  it("rejects values longer than 128 chars", () => {
    expect(extractQrToken("a".repeat(129))).toBeNull();
  });
});
