import { PortalClient } from "../src/portal/client.js";
import { parseMeterPage } from "../src/parsers/meter.js";

const client = new PortalClient({
  baseUrl: "https://urja-ops.flockenergy.tech",
  email: process.env.URJA_EMAIL, password: process.env.URJA_PASSWORD,
});

const list = [];
for (let p = 1; p <= 21; p++) list.push(...(await client.getJson(`/portal/meters/search?q=&page=${p}`)).data);

const byDt = {};
for (const m of list) {
  const d = parseMeterPage(await client.getJson(`/meters/${m.meterId}/__data.json`));
  const h = d.hierarchy;
  const path = ["zone","circle","division","subdivision","substation","feeder","dt"]
    .map((k) => `${h[k].code}|${h[k].name}`).join(" > ");
  (byDt[m.dtCode] ??= {})[path] = ((byDt[m.dtCode] ??= {})[path] ?? 0) + 1;
}
let conflicts = 0;
for (const [dt, paths] of Object.entries(byDt)) {
  if (Object.keys(paths).length > 1) { conflicts++; console.log("CONFLICT", dt, paths); }
}
console.log("DTs:", Object.keys(byDt).length, "with conflicting paths:", conflicts);
console.log(Object.entries(byDt).slice(0, 3));
