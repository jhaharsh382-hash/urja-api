import { PortalClient } from "../src/portal/client.js";

const BASE = "https://urja-ops.flockenergy.tech";
const client = new PortalClient({
  baseUrl: BASE, email: process.env.URJA_EMAIL, password: process.env.URJA_PASSWORD,
});
await client.login();
const text = async (url) => (await fetch(url, { headers: { Cookie: client.cookie } })).text();

const html = await text(`${BASE}/meters`);
const queue = [...html.matchAll(/_app\/immutable\/[^"'\s)]+?\.js/g)].map((m) => `${BASE}/${m[0]}`);
const seen = new Set(), sources = {};
while (queue.length && seen.size < 60) {
  const url = queue.shift();
  if (seen.has(url)) continue;
  seen.add(url);
  sources[url] = await text(url);
  for (const m of sources[url].matchAll(/["'](\.{1,2}\/[^"']+?\.js)["']/g)) queue.push(new URL(m[1], url).href);
}

for (const needle of ["/portal/dts", "/portal/keys", "/portal/export"]) {
  for (const [url, src] of Object.entries(sources)) {
    let i = -1;
    while ((i = src.indexOf(needle, i + 1)) !== -1) {
      console.log(`\n=== ${needle} in ${url.split("/").pop()} @${i}`);
      console.log(src.slice(Math.max(0, i - 200), i + 300));
    }
  }
}
