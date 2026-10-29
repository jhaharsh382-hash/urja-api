import { PortalClient } from "../src/portal/client.js";
import { Store } from "../src/store.js";

const client = new PortalClient({
  baseUrl: "https://urja-ops.flockenergy.tech",
  email: process.env.URJA_EMAIL, password: process.env.URJA_PASSWORD,
});
const store = new Store(client);

console.time("first load");
const s = await store.get();
console.timeEnd("first load");
console.log("meters:", s.meters.length, "transformers:", s.transformers.length);
console.log("nodes per level:", s.nodeCounts);
console.log("meters with warnings:", s.dataQuality.length);

const kinds = {};
for (const d of s.dataQuality) for (const w of d.warnings) {
  const k = w.replace(/"[^"]*"/g, "...").replace(/DT-\d+/, "DT");
  kinds[k] = (kinds[k] ?? 0) + 1;
}
console.log(kinds);

for (const id of ["J100044", "J100400", "J100162"]) console.log(JSON.stringify(s.byId.get(id), null, 1));

console.time("second get (cached)");
await store.get();
console.timeEnd("second get (cached)");
