import { PortalClient } from "../src/portal/client.js";
import { unflatten } from "../src/portal/devalue.js";
import { parseMeterPage } from "../src/parsers/meter.js";

const client = new PortalClient({
  baseUrl: "https://urja-ops.flockenergy.tech",
  email: process.env.URJA_EMAIL, password: process.env.URJA_PASSWORD,
});

const list = [];
for (let p = 1; p <= 21; p++) list.push(...(await client.getJson(`/portal/meters/search?q=&page=${p}`)).data);

const shapes = {}, failures = [], mismatches = [];
for (const m of list.filter((_, i) => i % 5 === 0)) {   // every 5th meter, ~81 requests
  try {
    const raw = await client.getJson(`/meters/${m.meterId}/__data.json`);
    const page = raw.nodes.filter((n) => n?.type === "data").map((n) => unflatten(n.data))
      .find((p) => p?.detail && p?.hierarchy);
    const shape = Object.keys(page.detail).sort().join("+");
    shapes[shape] = (shapes[shape] ?? 0) + 1;
    const d = parseMeterPage(raw);
    for (const k of ["serialNo", "make", "phaseType", "installStatus"])
      if (d[k] !== m[k]) mismatches.push([m.meterId, k, m[k], d[k]]);
    if (d.hierarchy.dt.code !== m.dtCode) mismatches.push([m.meterId, "dt", m.dtCode, d.hierarchy.dt.code]);
  } catch (e) { failures.push([m.meterId, e.message]); }
}
console.log("shapes:", shapes);
console.log("failures:", failures);
console.log("list-vs-detail mismatches:", mismatches);
