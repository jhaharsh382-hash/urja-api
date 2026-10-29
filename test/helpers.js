import { readFileSync } from "node:fs";
import { consensusByDt, normalizeMeter } from "../src/normalize.js";
import { buildHierarchy } from "../src/hierarchy.js";

export const exportSnapshot = () =>
  JSON.parse(readFileSync(new URL("../fixtures/export-snapshot.json", import.meta.url), "utf8"));

/** Build the same snapshot shape Store#load produces, from raw export rows + optional DT list. */
export function buildSnapshot(records, dts = []) {
  const transformers = new Map(dts.map((d) => [d.code, d]));
  const consensus = consensusByDt(records);
  const meters = records.map((r) => normalizeMeter(r, { transformers, consensus }));
  const { tree, nodeCounts, dataQuality: hq } = buildHierarchy(
    meters.map((m) => ({ meterId: m.meterId, dtCode: m.transformer.code, hierarchy: m.hierarchy }))
  );
  return {
    fetchedAt: Date.now(), stale: false, meters,
    byId: new Map(meters.map((m) => [m.meterId, m])),
    transformers: dts, tree, nodeCounts, hierarchyQuality: hq,
    dataQuality: meters.filter((m) => m.warnings.length).map((m) => ({ meterId: m.meterId, warnings: m.warnings })),
  };
}
