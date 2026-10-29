import { PortalClient } from "../src/portal/client.js";
import { parseMeterPage } from "../src/parsers/meter.js";

const client = new PortalClient({
  baseUrl: "https://urja-ops.flockenergy.tech",
  email: process.env.URJA_EMAIL, password: process.env.URJA_PASSWORD,
});

// 1. expired session on __data.json should trigger a re-login and still succeed
client.cookie = "__Secure-better-auth.session_token=garbage";
const raw = await client.getJson("/meters/J100004/__data.json");
console.log("after garbage cookie ->", parseMeterPage(raw).meterId);

// 2. unknown meter should be a clean 404
try {
  parseMeterPage(await client.getJson("/meters/J999999/__data.json"));
} catch (e) { console.log("J999999 ->", e.status, e.code); }
