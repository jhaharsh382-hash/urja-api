import { PortalClient } from "../src/portal/client.js";

const client = new PortalClient({
  baseUrl: "https://urja-ops.flockenergy.tech",
  email: process.env.URJA_EMAIL,
  password: process.env.URJA_PASSWORD,
});

const raw = await client.getJson("/meters/J100004/__data.json");
console.log(JSON.stringify(raw).slice(0, 600));
