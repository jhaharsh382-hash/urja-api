import { createHmac } from "node:crypto";
import { PortalError } from "../errors.js";

const bad = (msg) => new PortalError(msg, { status: 502, code: "portal_bad_payload" });

/**
 * One signed GET returns every meter. The portal ignores `page` here (page=2 returns the same
 * 403 rows), so this must never be called in a paging loop.
 * The signing secret is fetched fresh each time and is never stored or logged.
 */
export async function fetchExport(client) {
  const secret = (await client.getJson("/portal/keys")).data?.signingSecret;
  if (!secret) throw new PortalError("Portal gave no signing key", { status: 502, code: "portal_no_key" });

  const query = "page=1";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", secret)
    .update(["GET", "/portal/export", query, timestamp].join("\n"))
    .digest("hex");

  const res = await client.getJson(`/portal/export?${query}`, {
    headers: { "x-timestamp": timestamp, "x-signature": signature },
  });
  if (!Array.isArray(res?.data)) throw bad("Export has no data array");
  if (typeof res.total === "number" && res.total !== res.data.length) {
    throw bad(`Export truncated: ${res.data.length} of ${res.total} rows`);
  }
  return res.data;
}

/** Transformer master list: a normal paginated endpoint (20 per page), capped for safety. */
export async function fetchTransformers(client) {
  const out = [];
  let total = Infinity;
  for (let page = 1; out.length < total && page <= 50; page++) {
    const r = await client.getJson(`/portal/dts?page=${page}`);
    if (!r.data?.length) break;
    out.push(...r.data);
    total = r.total;
  }
  return out;
}
