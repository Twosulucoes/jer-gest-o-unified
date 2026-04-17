import { describe, it, expect } from "vitest";
import {
  RESULT_STATUS,
  RESULT_STATUS_LABEL,
  RESULT_STATUS_VARIANT,
  isLaunched,
  isValidated,
  isPublished,
} from "./resultStatus";

describe("RESULT_STATUS constants", () => {
  it("has the correct string values", () => {
    expect(RESULT_STATUS.LAUNCHED).toBe("resultado_lancado");
    expect(RESULT_STATUS.VALIDATED).toBe("resultado_validado");
    expect(RESULT_STATUS.PUBLISHED).toBe("publicado");
  });
});

describe("RESULT_STATUS_LABEL", () => {
  it("maps each status to its Portuguese label", () => {
    expect(RESULT_STATUS_LABEL["resultado_lancado"]).toBe("Lançado");
    expect(RESULT_STATUS_LABEL["resultado_validado"]).toBe("Validado");
    expect(RESULT_STATUS_LABEL["publicado"]).toBe("Publicado");
  });
});

describe("RESULT_STATUS_VARIANT", () => {
  it("maps launched to outline", () => {
    expect(RESULT_STATUS_VARIANT["resultado_lancado"]).toBe("outline");
  });

  it("maps validated to default", () => {
    expect(RESULT_STATUS_VARIANT["resultado_validado"]).toBe("default");
  });

  it("maps published to secondary", () => {
    expect(RESULT_STATUS_VARIANT["publicado"]).toBe("secondary");
  });
});

describe("isLaunched", () => {
  it("returns true for launched status", () => {
    expect(isLaunched("resultado_lancado")).toBe(true);
  });

  it("returns false for other statuses", () => {
    expect(isLaunched("resultado_validado")).toBe(false);
    expect(isLaunched("publicado")).toBe(false);
    expect(isLaunched("")).toBe(false);
  });
});

describe("isValidated", () => {
  it("returns true for validated status", () => {
    expect(isValidated("resultado_validado")).toBe(true);
  });

  it("returns false for other statuses", () => {
    expect(isValidated("resultado_lancado")).toBe(false);
    expect(isValidated("publicado")).toBe(false);
  });
});

describe("isPublished", () => {
  it("returns true for published status", () => {
    expect(isPublished("publicado")).toBe(true);
  });

  it("returns false for other statuses", () => {
    expect(isPublished("resultado_lancado")).toBe(false);
    expect(isPublished("resultado_validado")).toBe(false);
  });
});
