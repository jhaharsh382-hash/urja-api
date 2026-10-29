import { PortalClient } from "../src/portal/client.js";
import { Store } from "../src/store.js";

const client = new PortalClient({
  baseUrl: "https://urja-ops.flockenergy.tech",
  email: process.env.URJA_EMAIL, password: process.env.URJA_PASSWORD,
});
let calls = 0;
const orig = client.getJson.bind(client);
client.getJson = (...a) => { calls++; return orig(...a); };

const store = new Store(client);
await store.get();
console.log("portal calls for first load:", calls);   // I expect 4: keys, export, 2 dts pages
calls = 0;
const t = performance.now();
await store.get(); await store.get();
console.log("two cached gets:", (performance.now() - t).toFixed(2), "ms, portal calls:", calls);
