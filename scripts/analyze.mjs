import { readFileSync } from "node:fs";
import { splitLabel } from "../src/portal/devalue.js";

const rows = JSON.parse(readFileSync("fixtures/hierarchy-snapshot.json", "utf8"));
const KEYS = ["Zone", "Circle", "Division", "Subdivision", "Sub Station", "Feeder", "DT"];

// 1. blank levels, and labels that carry no "(CODE)"
const blank = [], noCode = [];
for (const r of rows) for (const k of KEYS) {
  const v = r.hierarchy[k];
  if (v == null || String(v).trim() === "") blank.push([r.meterId, k]);
  else if (splitLabel(v).code === null) noCode.push([r.meterId, k, v]);
}
console.log("blank levels:", blank.length, blank.slice(0, 8));
console.log("label without code:", noCode.length, noCode.slice(0, 8));

// 2. same code, more than one name
const names = {};
for (const r of rows) for (const k of KEYS) {
  const { name, code } = splitLabel(r.hierarchy[k]);
  if (!code) continue;
  const byCode = ((names[k] ??= {})[code] ??= {});
  byCode[name] = (byCode[name] ?? 0) + 1;
}
for (const [k, m] of Object.entries(names))
  for (const [code, n] of Object.entries(m))
    if (Object.keys(n).length > 1) console.log("NAME VARIANTS", k, code, n);

// 3. same code under more than one parent (a tree should have exactly one)
const parents = {};
for (const r of rows) for (let i = 1; i < KEYS.length; i++) {
  const c = splitLabel(r.hierarchy[KEYS[i]]).code;
  const p = splitLabel(r.hierarchy[KEYS[i - 1]]).code;
  if (!c || !p) continue;
  ((parents[KEYS[i]] ??= {})[c] ??= new Set()).add(p);
}
for (const [lvl, m] of Object.entries(parents))
  for (const [c, s] of Object.entries(m))
    if (s.size > 1) console.log("MULTI-PARENT", lvl, c, "->", [...s]);

// 4. size of the tree
const distinct = (k) => new Set(rows.map((r) => splitLabel(r.hierarchy[k]).code).filter(Boolean)).size;
console.log("distinct codes:", Object.fromEntries(KEYS.map((k) => [k, distinct(k)])));
