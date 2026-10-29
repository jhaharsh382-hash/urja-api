import { createHmac } from "node:crypto";
import { PortalClient } from "../src/portal/client.js";

const BASE = "https://urja-ops.flockenergy.tech";
const client = new PortalClient({
  baseUrl: BASE, email: process.env.URJA_EMAIL, password: process.env.URJA_PASSWORD,
});
await client.login();
const text = async (url) => (await fetch(url, { headers: { Cookie: client.cookie } })).text();

// 1. rest of the signing function, from the bundle
const html = await text(`${BASE}/meters`);
const queue = [...html.matchAll(/_app\/immutable\/[^"'\s)]+?\.js/g)].map((m) => `${BASE}/${m[0]}`);
const seen = new Set(); let src = "";
while (queue.length && seen.size < 60) {
  const url = queue.shift();
  if (seen.has(url)) continue;
  seen.add(url);
  const s = await text(url);
  if (url.endsWith("4.2Bgc2kUI.js")) src = s;
  for (const m of s.matchAll(/["'](\.{1,2}\/[^"']+?\.js)["']/g)) queue.push(new URL(m[1], url).href);
}
const at = src.indexOf("async function C(");
console.log("=== signing function ===\n", src.slice(at, at + 800));

// 2. export, as the UI does it
const secret = (await client.getJson("/portal/keys")).data.signingSecret;
const sign = (method, path, query, enc) => {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", secret).update([method, path, query, timestamp].join("\n")).digest(enc);
  return { timestamp, signature };
};
for (const enc of ["hex", "base64"]) {
  const { timestamp, signature } = sign("GET", "/portal/export", "page=1", enc);
  const res = await fetch(`${BASE}/portal/export?page=1`, {
    headers: { Cookie: client.cookie, "x-timestamp": timestamp, "x-signature": signature },
  });
  const body = await res.text();
  console.log(`\nexport (${enc}) -> ${res.status}`);
  if (!res.ok) { console.log(body.slice(0, 200)); continue; }
  const j = JSON.parse(body);
  console.log("top-level keys:", Object.keys(j), "total:", j.total, "page:", j.page, "pageSize:", j.pageSize);
  console.log("rows:", j.data?.length, "bytes:", body.length);
  console.log("first record:", JSON.stringify(j.data?.[0], null, 1));
  break;
}

// 3. DT-007 in the transformer master list
for (const p of [1, 2]) {
  const r = await client.getJson(`/portal/dts?page=${p}`);
  for (const d of r.data) if (d.code === "DT-007") console.log("\nDT-007 in /portal/dts:", d);
}
