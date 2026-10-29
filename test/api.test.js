import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { PortalError } from "../src/errors.js";
import { buildSnapshot, exportSnapshot } from "./helpers.js";

let server, base, failNext = false;
const snap = buildSnapshot(exportSnapshot().data);
const store = { async get() { if (failNext) throw new PortalError("down", { status: 502, code: "portal_unreachable" }); return snap; } };

before(async () => {
  server = createApp({ store }).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());
const get = async (p) => { const r = await fetch(base + p); return { status: r.status, body: await r.json() }; };

test("GET /health", async () => assert.deepEqual((await get("/health")).body, { status: "ok" }));

test("GET /meters paginates and reports totals", async () => {
  const { status, body } = await get("/meters?pageSize=10&page=2");
  assert.equal(status, 200);
  assert.equal(body.data.length, 10);
  assert.equal(body.total, snap.meters.length);
  assert.equal(body.totalPages, Math.ceil(snap.meters.length / 10));
});

test("GET /meters filters are case-insensitive and combine", async () => {
  const any = snap.meters[0];
  const { body } = await get(`/meters?make=${any.make.toLowerCase()}&installStatus=${any.installStatus}`);
  assert.ok(body.total >= 1);
  assert.ok(body.data.every((m) => m.make.toLowerCase() === any.make.toLowerCase() && m.installStatus === any.installStatus));
});

test("GET /meters?near= sorts by distance and respects radius", async () => {
  const m = snap.meters.find((x) => x.location);
  const { body } = await get(`/meters?near=${m.location.latitude},${m.location.longitude}&radiusKm=2`);
  assert.equal(body.data[0].meterId, m.meterId);
  assert.ok(body.data.every((x, i, a) => x.distanceKm <= 2 && (i === 0 || a[i - 1].distanceKm <= x.distanceKm)));
});

test("GET /meters rejects bad parameters with 400", async () => {
  for (const q of ["page=0", "pageSize=101", "page=abc", "near=1", "near=95,0", "radiusKm=3", "near=1,2&radiusKm=-1", "make=a&make=b"]) {
    const { status, body } = await get(`/meters?${q}`);
    assert.equal(status, 400, q);
    assert.equal(body.error.code, "invalid_parameter");
  }
});

test("GET /meters/:id returns one meter, 404 otherwise", async () => {
  const ok = await get(`/meters/${snap.meters[0].meterId}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.meterId, snap.meters[0].meterId);
  const nf = await get("/meters/NOPE");
  assert.equal(nf.status, 404);
  assert.equal(nf.body.error.code, "not_found");
});

test("GET /hierarchy and /data-quality are served", async () => {
  const h = await get("/hierarchy");
  assert.ok(h.body.data.length > 0 && h.body.nodeCounts.dt > 0);
  const q = await get("/data-quality");
  assert.equal(q.body.count, q.body.data.length);
  assert.ok("issueCount" in q.body.hierarchy);
});

test("portal failure surfaces as a JSON error, not a crash", async () => {
  failNext = true;
  const { status, body } = await get("/meters");
  failNext = false;
  assert.equal(status, 502);
  assert.equal(body.error.code, "portal_unreachable");
});

test("unknown route is a JSON 404", async () => {
  const { status, body } = await get("/nope");
  assert.equal(status, 404);
  assert.equal(body.error.code, "not_found");
});

test("openapi.json is served and every documented path exists in the app", async () => {
  const { body } = await get("/openapi.json");
  assert.match(body.openapi, /^3\./);
  for (const p of Object.keys(body.paths)) {
    const url = p.replace("{id}", snap.meters[0].meterId);
    assert.equal((await fetch(base + url)).status, 200, p);
  }
});
