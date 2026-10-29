import { PortalClient } from "../src/portal/client.js";
import { unflatten, splitLabel } from "../src/portal/devalue.js";

const client = new PortalClient({
  baseUrl: process.env.URJA_BASE_URL ?? "https://urja-ops.flockenergy.tech",
  email: process.env.URJA_EMAIL,
  password: process.env.URJA_PASSWORD,
});

const page = await client.getJson("/portal/meters/search?q=&page=1");
console.log(page.total, page.data[0]);

// prove the re-login path: wreck the cookie and call again
client.cookie = "__Secure-better-auth.session_token=garbage";
const again = await client.getJson("/portal/meters/search?q=&page=2");
console.log("after forced 401 ->", again.page, again.data.length);

// detail page data (SvelteKit __data.json)
const raw = await client.getJson("/meters/J100004/__data.json");
const node = raw.nodes.find((n) => n.type === "data");
const detail = unflatten(node.data);
console.log(JSON.parse(detail.detail.classData).installed_meter);
console.log(Object.entries(detail.hierarchy).map(([k, v]) => [k, splitLabel(v)]));
