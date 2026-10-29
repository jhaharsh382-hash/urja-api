import { PortalClient } from "../src/portal/client.js";
import { parseMeterPage } from "../src/parsers/meter.js";

const BASE = "https://urja-ops.flockenergy.tech";
const client = new PortalClient({
  baseUrl: BASE, email: process.env.URJA_EMAIL, password: process.env.URJA_PASSWORD,
});

for (const id of ["J100000", "J100004", "J100005"]) {
  const raw = await client.getJson(`/meters/${id}/__data.json`);
  console.log(JSON.stringify(parseMeterPage(raw), null, 1));
}

// unknown meter
try {
  const raw = await client.getJson("/meters/J999999/__data.json");
  console.log("J999999 raw:", JSON.stringify(raw).slice(0, 300));
  console.log(parseMeterPage(raw));
} catch (e) { console.log("J999999 ->", e.code, e.message); }

// does __data.json need a session? (no cookie at all)
const r = await fetch(`${BASE}/meters/J100004/__data.json`, { redirect: "manual" });
console.log("no cookie ->", r.status, (await r.text()).slice(0, 200));

// geo / energy for a three-phase meter and a bad id
for (const p of ["/portal/meters/J100005/geo", "/portal/meters/J100005/energy", "/portal/meters/J999999/geo"]) {
  try {
    const j = await client.getJson(p);
    console.log(p, "->", JSON.stringify(j).slice(0, 200));
  } catch (e) { console.log(p, "->", e.code, e.message); }
}
