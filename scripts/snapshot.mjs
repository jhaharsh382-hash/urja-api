import { writeFileSync, mkdirSync } from "node:fs";
import { PortalClient } from "../src/portal/client.js";
import { unflatten } from "../src/portal/devalue.js";

const client = new PortalClient({
  baseUrl: "https://urja-ops.flockenergy.tech",
  email: process.env.URJA_EMAIL, password: process.env.URJA_PASSWORD,
});

const list = [];
for (let p = 1; p <= 21; p++) list.push(...(await client.getJson(`/portal/meters/search?q=&page=${p}`)).data);

const rows = [];
for (const m of list) {
  const raw = await client.getJson(`/meters/${m.meterId}/__data.json`);
  const page = raw.nodes.filter((n) => n?.type === "data").map((n) => unflatten(n.data))
    .find((p) => p?.detail && p?.hierarchy);
  rows.push({ meterId: m.meterId, dtCode: m.dtCode, hierarchy: page.hierarchy });
  await new Promise((r) => setTimeout(r, 50));
}
mkdirSync("fixtures", { recursive: true });
writeFileSync("fixtures/hierarchy-snapshot.json", JSON.stringify(rows, null, 1));
console.log("saved", rows.length, "meters");
