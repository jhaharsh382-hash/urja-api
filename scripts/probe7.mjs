import { createHmac } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { PortalClient } from "../src/portal/client.js";
import { unflatten, splitLabel } from "../src/portal/devalue.js";
import { LEVELS } from "../src/hierarchy.js";

const BASE = "https://urja-ops.flockenergy.tech";
const client = new PortalClient({
  baseUrl: BASE, email: process.env.URJA_EMAIL, password: process.env.URJA_PASSWORD,
});
const secret = (await client.getJson("/portal/keys")).data.signingSecret;

async function exportPage(page) {
  const query = `page=${page}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", secret)
    .update(["GET", "/portal/export", query, timestamp].join("\n")).digest("hex");
  const res = await fetch(`${BASE}/portal/export?${query}`, {
    headers: { Cookie: client.cookie, "x-timestamp": timestamp, "x-signature": signature },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
const count = (arr) => arr.reduce((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {});

const { body: exp } = await exportPage(1);
mkdirSync("fixtures", { recursive: true });
writeFileSync("fixtures/export-snapshot.json", JSON.stringify(exp, null, 1));
console.log("exported:", exp.data.length, "total:", exp.total);

// 1. shape of the export
console.log("build values:", count(exp.data.map((m) => m.build)));
console.log("key sets:", count(exp.data.map((m) => Object.keys(m).sort().join(","))));
const empties = {};
for (const m of exp.data) for (const [k, v] of Object.entries(m))
  if (v === null || v === "") empties[k] = (empties[k] ?? 0) + 1;
console.log("null/empty top-level fields:", empties);
let blankLevels = 0;
for (const m of exp.data) for (const k of LEVELS)
  if (!m.hierarchy?.[k]?.name || !m.hierarchy?.[k]?.code) blankLevels++;
console.log("hierarchy levels missing name or code:", blankLevels);

// 2. page=2 (the UI only ever asks for page=1)
const p2 = await exportPage(2);
console.log("page=2 ->", p2.status, "rows:", p2.body?.data?.length, "first:", p2.body?.data?.[0]?.meterId);

// 3. export vs the list endpoint
const list = [];
for (let p = 1; p <= 21; p++) list.push(...(await client.getJson(`/portal/meters/search?q=&page=${p}`)).data);
const byId = new Map(exp.data.map((m) => [m.meterId, m]));
const listDiffs = [];
for (const l of list) {
  const e = byId.get(l.meterId);
  if (!e) { listDiffs.push([l.meterId, "missing from export"]); continue; }
  for (const k of ["serialNo", "make", "phaseType", "installStatus", "dtCode"])
    if (e[k] !== l[k]) listDiffs.push([l.meterId, k, l[k], e[k]]);
}
console.log("export vs list endpoint, differences:", listDiffs.length, listDiffs.slice(0, 5));

// 4. export hierarchy vs the per-meter crawl
const LABEL = { zone: "Zone", circle: "Circle", division: "Division", subdivision: "Subdivision",
  substation: "Sub Station", feeder: "Feeder", dt: "DT" };
const crawl = JSON.parse(readFileSync("fixtures/hierarchy-snapshot.json", "utf8"));
const hDiffs = [];
for (const r of crawl) {
  const e = byId.get(r.meterId);
  for (const k of LEVELS) {
    const c = splitLabel(r.hierarchy[LABEL[k]]);
    const x = e?.hierarchy?.[k];
    if ((c.name ?? null) !== (x?.name ?? null) || (c.code ?? null) !== (x?.code ?? null))
      hDiffs.push([r.meterId, k, c, x]);
  }
}
console.log("export hierarchy vs crawl, differences:", hDiffs.length);
console.log(hDiffs.slice(0, 6));

// 5. export vs transformer master list
const dts = [];
for (const p of [1, 2]) dts.push(...(await client.getJson(`/portal/dts?page=${p}`)).data);
const dtByCode = new Map(dts.map((d) => [d.code, d]));
const dtDiffs = [];
for (const m of exp.data) {
  const d = dtByCode.get(m.dtCode);
  if (!d) { dtDiffs.push([m.meterId, "dt not in master list"]); continue; }
  if (m.hierarchy?.dt?.name !== d.name) dtDiffs.push([m.meterId, "dt name", m.hierarchy?.dt?.name, d.name]);
  if (m.hierarchy?.feeder?.code !== d.feederCode) dtDiffs.push([m.meterId, "feeder", m.hierarchy?.feeder?.code, d.feederCode]);
}
console.log("export vs /portal/dts, differences:", dtDiffs.length, dtDiffs.slice(0, 6));

// 6. geo: export vs /geo endpoint (every 40th meter)
const geoDiffs = [];
for (const m of exp.data.filter((_, i) => i % 40 === 0)) {
  const g = (await client.getJson(`/portal/meters/${m.meterId}/geo`)).data;
  if (Number(g.latitude) !== m.geo?.lat || Number(g.longitude) !== m.geo?.lng)
    geoDiffs.push([m.meterId, g, m.geo]);
}
console.log("geo differences (sample of ~11):", geoDiffs);

// 7. does `build` explain the two detail shapes? (every 10th meter)
const cross = {};
for (const m of exp.data.filter((_, i) => i % 10 === 0)) {
  const raw = await client.getJson(`/meters/${m.meterId}/__data.json`);
  const page = raw.nodes.filter((n) => n?.type === "data").map((n) => unflatten(n.data))
    .find((p) => p?.detail && p?.hierarchy);
  const key = `${m.build} | ${Object.keys(page.detail).sort().join("+")}`;
  cross[key] = (cross[key] ?? 0) + 1;
}
console.log("build vs detail shape:", cross);
