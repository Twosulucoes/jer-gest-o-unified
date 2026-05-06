import { describe, it, expect } from "vitest";
import { generateCredentialCode, generateQrCodeValue } from "./credentialUtils";

describe("generateCredentialCode", () => {
  it("starts with J", () => {
    expect(generateCredentialCode()).toMatch(/^J/);
  });

  it("matches the format J + 5 numeric digits", () => {
    expect(generateCredentialCode()).toMatch(/^J\d{5}$/);
  });

  it("has length 6", () => {
    expect(generateCredentialCode()).toHaveLength(6);
  });

  it("generates many distinct codes (high but not perfect uniqueness — 100k universe)", () => {
    // 50 amostras dentro de 100k tem probabilidade de colisão ~1.2%.
    // Vai falhar raramente; aceitamos um set quase cheio.
    const codes = new Set(Array.from({ length: 50 }, generateCredentialCode));
    expect(codes.size).toBeGreaterThanOrEqual(48);
  });
});

describe("generateQrCodeValue", () => {
  it("returns the credential_code itself (no prefix, no HMAC)", () => {
    const result = generateQrCodeValue("event-1", "participant-2", "J04382");
    expect(result).toBe("J04382");
  });

  it("ignores the event/participant args and returns the code as-is", () => {
    expect(generateQrCodeValue("anything", "whatever", "J99999")).toBe("J99999");
  });
});
