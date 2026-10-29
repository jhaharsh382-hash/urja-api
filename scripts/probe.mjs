import { PortalClient } from "../src/portal/client.js";

const client = new PortalClient({
  baseUrl: "https://urja-ops.flockenergy.tech",
  email: process.env.URJA_EMAIL,
  password: process.env.URJA_PASSWORD,
});

// 1. transformers: SvelteKit exposes every page route as <path>/__data.json
for (const p of ["/transformers/__data.json", "/transformers/DT-001/__data.json"]) {
  try {
    console.log(p, "->", JSON.stringify(await client.getJson(p)).slice(0, 400));
  } catch (e) {
    console.log(p, "->", e.status, e.code, e.message);
  }
}

// 2. energy: do any query params change the result?
for (const q of ["", "?limit=5", "?from=2026-06-25", "?page=2"]) {
  try {
    const r = await client.getJson(`/portal/meters/J100000/energy${q}`);
    console.log("energy" + q, "-> rows:", r.data.length, "first:", r.data[0]?.timestamp, "last:", r.data.at(-1)?.timestamp);
  } catch (e) {
    console.log("energy" + q, "->", e.status, e.code, e.message);
  }
}
