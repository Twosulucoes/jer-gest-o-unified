import { describe, it, expect } from "vitest";
import {
  getPrimaryRankField,
  computeIndividualRanking,
  formatTimeMs,
  formatDistanceCm,
  formatRankValue,
  computeCrossHeatRanking,
} from "./individualRanking";
import type { IndividualConfig } from "@/components/admin/IndividualConfigEditor";

// ─── helpers ────────────────────────────────────────────────────────────────

function makeConfig(fields: IndividualConfig["result_fields"], extra?: Partial<IndividualConfig>): IndividualConfig {
  return { result_fields: fields, ...extra };
}

function makeEntry(id: string, label = id) {
  return { id, label };
}

function makeResult(entryId: string, overrides: Record<string, unknown> = {}) {
  return { match_entry_id: entryId, outcome: null, result_status: null, ...overrides };
}

const getLabel = (e: { label: string }) => e.label;
const getDeleg = (_: unknown) => "Delegação";

// ─── getPrimaryRankField ─────────────────────────────────────────────────────

describe("getPrimaryRankField", () => {
  it("returns null for null config", () => {
    expect(getPrimaryRankField(null)).toBeNull();
  });

  it("returns null when no result_fields enabled", () => {
    expect(getPrimaryRankField(makeConfig({}))).toBeNull();
    expect(getPrimaryRankField(makeConfig({ time: false, distance: false }))).toBeNull();
  });

  it("prioritises time over distance", () => {
    expect(getPrimaryRankField(makeConfig({ time: true, distance: true }))).toBe("time_ms");
  });

  it("prioritises distance over points", () => {
    expect(getPrimaryRankField(makeConfig({ distance: true, points: true }))).toBe("distance_cm");
  });

  it("prioritises points over score", () => {
    expect(getPrimaryRankField(makeConfig({ points: true, score: true }))).toBe("points");
  });

  it("prioritises score over position", () => {
    expect(getPrimaryRankField(makeConfig({ score: true, position: true }))).toBe("score");
  });

  it("returns position when only position is enabled", () => {
    expect(getPrimaryRankField(makeConfig({ position: true }))).toBe("position");
  });
});

// ─── formatTimeMs ─────────────────────────────────────────────────────────────

describe("formatTimeMs", () => {
  it("formats sub-minute times as secs.millis", () => {
    expect(formatTimeMs(9_870)).toBe("9.870s");
    expect(formatTimeMs(1000)).toBe("1.000s");
    expect(formatTimeMs(500)).toBe("0.500s");
  });

  it("formats minute+ times as m:ss.millis", () => {
    expect(formatTimeMs(60_000)).toBe("1:00.000");
    expect(formatTimeMs(90_500)).toBe("1:30.500");
    expect(formatTimeMs(3_661_001)).toBe("61:01.001");
  });

  it("pads seconds and milliseconds with zeroes", () => {
    expect(formatTimeMs(60_001)).toBe("1:00.001");
    expect(formatTimeMs(61_000)).toBe("1:01.000");
  });
});

// ─── formatDistanceCm ─────────────────────────────────────────────────────────

describe("formatDistanceCm", () => {
  it("shows cm for values under 100", () => {
    expect(formatDistanceCm(50)).toBe("50cm");
    expect(formatDistanceCm(99)).toBe("99cm");
  });

  it("converts to metres for values >= 100", () => {
    expect(formatDistanceCm(100)).toBe("1.00m");
    expect(formatDistanceCm(1050)).toBe("10.50m");
    expect(formatDistanceCm(752)).toBe("7.52m");
  });
});

// ─── formatRankValue ──────────────────────────────────────────────────────────

describe("formatRankValue", () => {
  it("returns — for null value", () => {
    expect(formatRankValue(null, "time_ms")).toBe("—");
    expect(formatRankValue(null, null)).toBe("—");
  });

  it("formats time_ms", () => {
    expect(formatRankValue(9870, "time_ms")).toBe("9.870s");
  });

  it("formats distance_cm", () => {
    expect(formatRankValue(100, "distance_cm")).toBe("1.00m");
  });

  it("formats points", () => {
    expect(formatRankValue(42, "points")).toBe("42 pts");
  });

  it("formats position", () => {
    expect(formatRankValue(1, "position")).toBe("1º");
  });

  it("falls back to String() for score and null field", () => {
    expect(formatRankValue(5, "score")).toBe("5");
    expect(formatRankValue(7, null)).toBe("7");
  });
});

// ─── computeIndividualRanking ─────────────────────────────────────────────────

describe("computeIndividualRanking", () => {
  describe("no config / no field", () => {
    it("returns entries with null position and rankValue", () => {
      const entries = [makeEntry("e1"), makeEntry("e2")];
      const ranked = computeIndividualRanking(entries, [], [], null, getLabel);
      expect(ranked).toHaveLength(2);
      ranked.forEach((r) => {
        expect(r.position).toBeNull();
        expect(r.rankValue).toBeNull();
      });
    });
  });

  describe("time_ms field", () => {
    const config = makeConfig({ time: true });

    it("ranks entries by time ascending (fastest first)", () => {
      const entries = [makeEntry("e1"), makeEntry("e2"), makeEntry("e3")];
      const results = [
        makeResult("e1", { time_ms: 10000 }),
        makeResult("e2", { time_ms: 8000 }),
        makeResult("e3", { time_ms: 9000 }),
      ];
      const ranked = computeIndividualRanking(entries, results, [], config, getLabel);
      expect(ranked[0].entryId).toBe("e2");
      expect(ranked[0].position).toBe(1);
      expect(ranked[1].entryId).toBe("e3");
      expect(ranked[1].position).toBe(2);
      expect(ranked[2].entryId).toBe("e1");
      expect(ranked[2].position).toBe(3);
    });

    it("places entries without a result at the end", () => {
      const entries = [makeEntry("e1"), makeEntry("e2")];
      const results = [makeResult("e1", { time_ms: 5000 })];
      const ranked = computeIndividualRanking(entries, results, [], config, getLabel);
      expect(ranked[0].entryId).toBe("e1");
      expect(ranked[1].entryId).toBe("e2");
      expect(ranked[1].position).toBeNull();
    });

    it("marks excluded entries (dsq) and puts them after ranked entries", () => {
      const entries = [makeEntry("e1"), makeEntry("e2")];
      const results = [
        makeResult("e1", { time_ms: 5000 }),
        makeResult("e2", { time_ms: 4000, outcome: "dsq" }),
      ];
      const ranked = computeIndividualRanking(entries, results, [], config, getLabel);
      expect(ranked[0].entryId).toBe("e1");
      expect(ranked[0].position).toBe(1);
      expect(ranked[1].entryId).toBe("e2");
      expect(ranked[1].excluded).toBe(true);
    });

    it("excludes dns, dnf, wo_loss, cancelled outcomes", () => {
      const excluded = ["dns", "dnf", "wo_loss", "cancelled"];
      for (const outcome of excluded) {
        const entries = [makeEntry("e1")];
        const results = [makeResult("e1", { time_ms: 5000, outcome })];
        const ranked = computeIndividualRanking(entries, results, [], config, getLabel);
        expect(ranked[0].excluded).toBe(true);
      }
    });
  });

  describe("distance_cm field", () => {
    const config = makeConfig({ distance: true });

    it("ranks entries by distance descending (longest first)", () => {
      const entries = [makeEntry("e1"), makeEntry("e2")];
      const results = [
        makeResult("e1", { distance_cm: 500 }),
        makeResult("e2", { distance_cm: 800 }),
      ];
      const ranked = computeIndividualRanking(entries, results, [], config, getLabel);
      expect(ranked[0].entryId).toBe("e2");
      expect(ranked[0].position).toBe(1);
      expect(ranked[1].entryId).toBe("e1");
      expect(ranked[1].position).toBe(2);
    });
  });

  describe("points field", () => {
    const config = makeConfig({ points: true });

    it("ranks entries by points descending (most points first)", () => {
      const entries = [makeEntry("e1"), makeEntry("e2")];
      const results = [
        makeResult("e1", { points: 10 }),
        makeResult("e2", { points: 20 }),
      ];
      const ranked = computeIndividualRanking(entries, results, [], config, getLabel);
      expect(ranked[0].entryId).toBe("e2");
      expect(ranked[0].position).toBe(1);
    });
  });

  describe("position field (manual)", () => {
    const config = makeConfig({ position: true });

    it("sorts by manual position ascending", () => {
      const entries = [makeEntry("e1"), makeEntry("e2"), makeEntry("e3")];
      const results = [
        makeResult("e1", { position: 3 }),
        makeResult("e2", { position: 1 }),
        makeResult("e3", { position: 2 }),
      ];
      const ranked = computeIndividualRanking(entries, results, [], config, getLabel);
      expect(ranked[0].entryId).toBe("e2");
      expect(ranked[1].entryId).toBe("e3");
      expect(ranked[2].entryId).toBe("e1");
    });

    it("sets source to manual_position when position is available", () => {
      const entries = [makeEntry("e1")];
      const results = [makeResult("e1", { position: 1 })];
      const ranked = computeIndividualRanking(entries, results, [], config, getLabel);
      expect(ranked[0].source).toBe("manual_position");
    });
  });

  describe("score field", () => {
    const config = makeConfig({ score: true });

    it("returns entries with rankValue null (score is not sortable)", () => {
      const entries = [makeEntry("e1")];
      const results = [makeResult("e1", { position: 1 })];
      const ranked = computeIndividualRanking(entries, results, [], config, getLabel);
      expect(ranked[0].rankValue).toBeNull();
      expect(ranked[0].rankField).toBe("score");
    });
  });

  describe("attempts", () => {
    const config = makeConfig({ time: true }, { allows_attempts: true });

    it("uses best attempt when better than result", () => {
      const entries = [makeEntry("e1")];
      const results = [makeResult("e1", { time_ms: 10000 })];
      const attempts = [
        { match_entry_id: "e1", is_valid: true, value_ms: 8000 },
      ];
      const ranked = computeIndividualRanking(entries, results, attempts, config, getLabel);
      expect(ranked[0].rankValue).toBe(8000);
      expect(ranked[0].source).toBe("attempt");
    });

    it("keeps result when it is better than attempt", () => {
      const entries = [makeEntry("e1")];
      const results = [makeResult("e1", { time_ms: 7000 })];
      const attempts = [
        { match_entry_id: "e1", is_valid: true, value_ms: 9000 },
      ];
      const ranked = computeIndividualRanking(entries, results, attempts, config, getLabel);
      expect(ranked[0].rankValue).toBe(7000);
      expect(ranked[0].source).toBe("result");
    });

    it("uses attempt value when there is no result", () => {
      const entries = [makeEntry("e1")];
      const attempts = [
        { match_entry_id: "e1", is_valid: true, value_ms: 5000 },
      ];
      const ranked = computeIndividualRanking(entries, [], attempts, config, getLabel);
      expect(ranked[0].rankValue).toBe(5000);
      expect(ranked[0].source).toBe("attempt");
    });

    it("ignores invalid attempts", () => {
      const entries = [makeEntry("e1")];
      const attempts = [
        { match_entry_id: "e1", is_valid: false, value_ms: 3000 },
      ];
      const ranked = computeIndividualRanking(entries, [], attempts, config, getLabel);
      expect(ranked[0].rankValue).toBeNull();
    });
  });
});

// ─── computeCrossHeatRanking ──────────────────────────────────────────────────

describe("computeCrossHeatRanking", () => {
  const config = makeConfig({ time: true });

  const heat1 = {
    matchId: "m1",
    heatName: "Bateria 1",
    entries: [makeEntry("e1"), makeEntry("e2")],
    results: [
      makeResult("e1", { time_ms: 10000 }),
      makeResult("e2", { time_ms: 8000 }),
    ],
    attempts: [],
  };

  const heat2 = {
    matchId: "m2",
    heatName: "Bateria 2",
    entries: [makeEntry("e3")],
    results: [makeResult("e3", { time_ms: 9000 })],
    attempts: [],
  };

  it("consolidates entries across heats", () => {
    const ranked = computeCrossHeatRanking([heat1, heat2], "time", config, getLabel, getDeleg);
    expect(ranked).toHaveLength(3);
  });

  it("ranks globally by time ascending", () => {
    const ranked = computeCrossHeatRanking([heat1, heat2], "time", config, getLabel, getDeleg);
    expect(ranked[0].entryId).toBe("e2"); // 8000
    expect(ranked[0].position).toBe(1);
    expect(ranked[1].entryId).toBe("e3"); // 9000
    expect(ranked[1].position).toBe(2);
    expect(ranked[2].entryId).toBe("e1"); // 10000
    expect(ranked[2].position).toBe(3);
  });

  it("assigns tied positions correctly", () => {
    const heat = {
      matchId: "m1",
      heatName: "B1",
      entries: [makeEntry("e1"), makeEntry("e2"), makeEntry("e3")],
      results: [
        makeResult("e1", { time_ms: 8000 }),
        makeResult("e2", { time_ms: 8000 }),
        makeResult("e3", { time_ms: 9000 }),
      ],
      attempts: [],
    };
    const ranked = computeCrossHeatRanking([heat], "time", config, getLabel, getDeleg);
    expect(ranked[0].position).toBe(1);
    expect(ranked[1].position).toBe(1); // tie
    expect(ranked[2].position).toBe(3);
  });

  it("marks entries from currentMatchId as isCurrentMatch", () => {
    const ranked = computeCrossHeatRanking([heat1, heat2], "time", config, getLabel, getDeleg, "m1");
    const m1Entries = ranked.filter((r) => r.isCurrentMatch);
    const m2Entries = ranked.filter((r) => !r.isCurrentMatch);
    expect(m1Entries).toHaveLength(2);
    expect(m2Entries).toHaveLength(1);
  });

  it("places excluded entries at the end sorted by outcome category", () => {
    const heat = {
      matchId: "m1",
      heatName: "B1",
      entries: [makeEntry("e1"), makeEntry("e2"), makeEntry("e3")],
      results: [
        makeResult("e1", { time_ms: 8000 }),
        makeResult("e2", { time_ms: 5000, outcome: "dnf" }),
        makeResult("e3", { time_ms: 6000, outcome: "dsq" }),
      ],
      attempts: [],
    };
    const ranked = computeCrossHeatRanking([heat], "time", config, getLabel, getDeleg);
    expect(ranked[0].entryId).toBe("e1"); // valid, ranked
    expect(ranked[1].excluded).toBe(true); // dsq comes before dnf
    expect(ranked[1].outcome).toBe("dsq");
    expect(ranked[2].outcome).toBe("dnf");
  });

  it("ranks mark events descending", () => {
    const distConfig = makeConfig({ distance: true });
    const heat = {
      matchId: "m1",
      heatName: "B1",
      entries: [makeEntry("e1"), makeEntry("e2")],
      results: [
        makeResult("e1", { distance_cm: 500 }),
        makeResult("e2", { distance_cm: 800 }),
      ],
      attempts: [],
    };
    const ranked = computeCrossHeatRanking([heat], "mark", distConfig, getLabel, getDeleg);
    expect(ranked[0].entryId).toBe("e2");
    expect(ranked[0].position).toBe(1);
  });
});
