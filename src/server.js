import { PortalClient } from "./portal/client.js";
import { Store } from "./store.js";
import { createApp } from "./app.js";

const { URJA_EMAIL, URJA_PASSWORD, URJA_BASE_URL = "https://urja-ops.flockenergy.tech", PORT = "3000" } = process.env;
if (!URJA_EMAIL || !URJA_PASSWORD) {
  console.error("Set URJA_EMAIL and URJA_PASSWORD (copy .env.example to .env).");
  process.exit(1);
}
const store = new Store(new PortalClient({ baseUrl: URJA_BASE_URL, email: URJA_EMAIL, password: URJA_PASSWORD }));
store.refresh().catch((e) => console.warn("initial load failed, will retry on first request:", e.message));
createApp({ store }).listen(Number(PORT), () => console.log(`API on http://localhost:${PORT}`));
