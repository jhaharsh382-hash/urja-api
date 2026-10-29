import { PortalClient } from "../src/portal/client.js";
import { unflatten } from "../src/portal/devalue.js";

const client = new PortalClient({
  baseUrl: "https://urja-ops.flockenergy.tech",
  email: process.env.URJA_EMAIL,
  password: process.env.URJA_PASSWORD,
});

for (const id of ["J100000", "J100004"]) {
  const raw = await client.getJson(`/meters/${id}/__data.json`);
  const pages = raw.nodes.filter((n) => n?.type === "data").map((n) => unflatten(n.data));
  const page = pages.find((p) => p?.detail && p?.hierarchy);
  console.log("=====", id);
  console.log("detail:", JSON.stringify(page.detail));
  console.log("hierarchy:", JSON.stringify(page.hierarchy));
}
