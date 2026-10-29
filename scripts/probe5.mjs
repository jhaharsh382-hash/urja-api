import { PortalClient } from "../src/portal/client.js";

const BASE = "https://urja-ops.flockenergy.tech";
const client = new PortalClient({
  baseUrl: BASE, email: process.env.URJA_EMAIL, password: process.env.URJA_PASSWORD,
});

// 1. transformer list (the UI's own GET)
for (const p of [1, 2, 99]) {
  try {
    const r = await client.getJson(`/portal/dts?page=${p}`);
    console.log(`dts page=${p} -> keys: ${Object.keys(r)} total: ${r.total} rows: ${r.data?.length}`);
    if (p === 1) console.log(JSON.stringify(r.data.slice(0, 2), null, 1));
  } catch (e) { console.log(`dts page=${p} ->`, e.status, e.code); }
}

// 2. /portal/keys: shape only, never print the secret
try {
  const k = await client.getJson("/portal/keys");
  console.log("keys -> fields:", Object.keys(k.data ?? {}), "secret length:", k.data?.signingSecret?.length);
} catch (e) { console.log("keys ->", e.status, e.code); }

// 3. read the signing code from the bundle
const text = async (url) => (await fetch(url, { headers: { Cookie: client.cookie } })).text();
const html = await text(`${BASE}/meters`);
const queue = [...html.matchAll(/_app\/immutable\/[^"'\s)]+?\.js/g)].map((m) => `${BASE}/${m[0]}`);
const seen = new Set(), sources = {};
while (queue.length && seen.size < 60) {
  const url = queue.shift();
  if (seen.has(url)) continue;
  seen.add(url);
  sources[url] = await text(url);
  for (const m of sources[url].matchAll(/["'](\.{1,2}\/[^"']+?\.js)["']/g)) queue.push(new URL(m[1], url).href);
}

const page = Object.entries(sources).find(([u]) => u.endsWith("4.2Bgc2kUI.js"));
console.log("\n=== start of 4.2Bgc2kUI.js (imports)\n", page[1].slice(0, 500));

let shown = 0;
for (const [url, src] of Object.entries(sources)) {
  for (const needle of ["crypto.subtle", "importKey", "HMAC", "SHA-256", "x-signature"]) {
    let i = src.indexOf(needle);
    if (i !== -1 && shown < 5 && !url.endsWith("4.2Bgc2kUI.js")) {
      shown++;
      console.log(`\n=== ${needle} in ${url.split("/").pop()} @${i}\n`, src.slice(Math.max(0, i - 500), i + 600));
      break;
    }
  }
}
