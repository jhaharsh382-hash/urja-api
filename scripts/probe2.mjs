import { PortalClient } from "../src/portal/client.js";

const BASE = "https://urja-ops.flockenergy.tech";
const client = new PortalClient({
  baseUrl: BASE, email: process.env.URJA_EMAIL, password: process.env.URJA_PASSWORD,
});
await client.login();
const text = async (url) => (await fetch(url, { headers: { Cookie: client.cookie } })).text();

// ---- 1. find JS files from the page HTML, follow relative imports (max 60 files)
const html = await text(`${BASE}/meters`);
const queue = [...html.matchAll(/_app\/immutable\/[^"'\s)]+?\.js/g)].map((m) => `${BASE}/${m[0]}`);
const seen = new Set(), sources = {};
while (queue.length && seen.size < 60) {
  const url = queue.shift();
  if (seen.has(url)) continue;
  seen.add(url);
  const src = await text(url);
  sources[url] = src;
  for (const m of src.matchAll(/["'](\.{1,2}\/[^"']+?\.js)["']/g)) queue.push(new URL(m[1], url).href);
}
console.log("JS files scanned:", seen.size);

const grep = (re) => {
  const hits = new Set();
  for (const src of Object.values(sources)) for (const m of src.matchAll(re)) hits.add(m[0]);
  return [...hits];
};
console.log("/portal/ paths:", grep(/\/portal\/[A-Za-z0-9_\-\/${}.?=&]*/g));
console.log("other API-ish strings:", grep(/["'`]\/(?:api|export|download|transformers?)[A-Za-z0-9_\-\/${}.?=&]*["'`]/g));

// ---- 2. energy: upper bound and invalid input
for (const q of ["?to=2026-06-27", "?from=2026-06-25&to=2026-06-27", "?from=garbage"]) {
  try {
    const r = await client.getJson(`/portal/meters/J100000/energy${q}`);
    console.log("energy" + q, "-> rows:", r.data.length, "first:", r.data[0]?.timestamp, "last:", r.data.at(-1)?.timestamp);
  } catch (e) { console.log("energy" + q, "->", e.status, e.code, e.message); }
}
