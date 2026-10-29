import { test } from "node:test";
import assert from "node:assert/strict";
import { unflatten, splitLabel } from "../src/portal/devalue.js";
import { distanceKm } from "../src/geo.js";
import { buildHierarchy } from "../src/hierarchy.js";
import { parseMeterPage } from "../src/parsers/meter.js";
import { buildSnapshot, exportSnapshot } from "./helpers.js";

test("unflatten resolves index references, shares repeated nodes and maps -1 to undefined", () => {
  // root object -> { a: flat[1], b: flat[2], c: -1 }; flat[2] is an array pointing at flat[1] twice
  const out = unflatten([{ a: 1, b: 2, c: -1 }, "x", [1, 1]]);
  assert.deepEqual(out, { a: "x", b: ["x", "x"], c: undefined });
});

test("splitLabel splits 'Name (CODE)' and tolerates blanks", () => {
  assert.deepEqual(splitLabel("Feeder 5 (F-005)"), { name: "Feeder 5", code: "F-005" });
  assert.deepEqual(splitLabel("Feeder 5"), { name: "Feeder 5", code: null });
  assert.deepEqual(splitLabel(undefined), { name: null, code: null });
});

test("distanceKm: zero for same point, ~111km per degree of latitude", () => {
  assert.equal(distanceKm(26, 75, 26, 75), 0);
  assert.ok(Math.abs(distanceKm(0, 0, 1, 0) - 111.19) < 0.1);
});

test("hierarchy node identity is the code path, so reused codes under different parents stay separate", () => {
  const mk = (id, dt, c, d) => ({
    meterId: id, dtCode: dt,
    hierarchy: {
      zone: { code: "Z-01", name: "Z" }, circle: { code: c, name: c },
      division: { code: d, name: d }, subdivision: { code: "SD", name: "SD" },
      substation: { code: "SS", name: "SS" }, feeder: { code: "F", name: "F" }, dt: { code: dt, name: dt },
    },
  });
  const { tree, nodeCounts } = buildHierarchy([mk("a", "DT-1", "C-01", "D-01"), mk("b", "DT-2", "C-03", "D-01")]);
  assert.equal(tree[0].children.length, 2);
  assert.equal(nodeCounts.division, 2); // both called D-01, but different paths
  assert.deepEqual(tree[0].children.map((c) => c.children[0].path), ["Z-01/C-01/D-01", "Z-01/C-03/D-01"]);
});

test("hierarchy majority vote reports the dissenting meter instead of hiding it", () => {
  const h = (feeder) => ({
    zone: { code: "Z", name: "Z" }, circle: { code: "C", name: "C" }, division: { code: "D", name: "D" },
    subdivision: { code: "S", name: "S" }, substation: { code: "SS", name: "SS" },
    feeder, dt: { code: "DT-1", name: "DT" },
  });
  const f1 = { code: "F-1", name: "F1" };
  const { dataQuality } = buildHierarchy([
    { meterId: "a", dtCode: "DT-1", hierarchy: h(f1) },
    { meterId: "b", dtCode: "DT-1", hierarchy: h(f1) },
    { meterId: "c", dtCode: "DT-1", hierarchy: h({ code: "F-9", name: "F9" }) },
  ]);
  const issue = dataQuality.issues.find((i) => i.meterId === "c");
  assert.equal(issue.problem, "differs from majority");
  assert.equal(issue.used, "F1 (F-1)");
});

test("parseMeterPage maps portal error nodes and unknown payloads to typed errors", () => {
  assert.throws(() => parseMeterPage({ nodes: [{ type: "error", status: 404 }] }), { code: "not_found", status: 404 });
  assert.throws(() => parseMeterPage({ nodes: [{ type: "error", status: 500 }] }), { code: "portal_page_error" });
  assert.throws(() => parseMeterPage({ nodes: [] }), { code: "portal_bad_payload" });
});

test("real export snapshot: 403 meters normalise and every meter keeps an id", () => {
  const exp = exportSnapshot();
  const snap = buildSnapshot(exp.data);
  assert.equal(snap.meters.length, exp.total);
  assert.equal(new Set(snap.meters.map((m) => m.meterId)).size, exp.total, "meter ids unique");
  for (const m of snap.meters) for (const lvl of ["zone", "dt"]) assert.ok(lvl in m.hierarchy);
});
