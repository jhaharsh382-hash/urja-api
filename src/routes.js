import { Router } from "express";
import { ApiError } from "./errors.js";
import { distanceKm } from "./geo.js";

const bad = (msg) => new ApiError(msg, { status: 400, code: "invalid_parameter" });

function intParam(v, name, def, min, max) {
  if (v === undefined) return def;
  if (typeof v !== "string" || !/^\d+$/.test(v)) throw bad(`${name} must be an integer`);
  const n = Number(v);
  if (n < min || n > max) throw bad(`${name} must be between ${min} and ${max}`);
  return n;
}
function numParam(v, name) {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n)) throw bad(`${name} must be a number`);
  return n;
}
const eq = (a, b) => String(a ?? "").toLowerCase() === b.toLowerCase();
const meta = (s) => ({ fetchedAt: new Date(s.fetchedAt).toISOString(), stale: s.stale });

export function routes(store) {
  const r = Router();

  // GET /meters?page&pageSize&make&installStatus&phaseType&transformer&q&near=lat,lng&radiusKm
  r.get("/meters", async (req, res) => {
    const q = req.query;
    const page = intParam(q.page, "page", 1, 1, 1_000_000);
    const pageSize = intParam(q.pageSize, "pageSize", 20, 1, 100);
    for (const k of ["make", "installStatus", "phaseType", "transformer", "q", "near", "radiusKm"])
      if (q[k] !== undefined && typeof q[k] !== "string") throw bad(`${k} must be given once`);

    let near = null;
    if (q.near !== undefined) {
      const parts = q.near.split(",");
      if (parts.length !== 2) throw bad("near must be 'lat,lng'");
      const lat = numParam(parts[0], "near latitude"), lng = numParam(parts[1], "near longitude");
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) throw bad("near is out of range");
      const radiusKm = q.radiusKm === undefined ? 5 : numParam(q.radiusKm, "radiusKm");
      if (radiusKm <= 0 || radiusKm > 1000) throw bad("radiusKm must be between 0 and 1000");
      near = { lat, lng, radiusKm };
    } else if (q.radiusKm !== undefined) {
      throw bad("radiusKm needs near");
    }

    const s = await store.get();
    let rows = s.meters.filter((m) =>
      (q.make === undefined || eq(m.make, q.make)) &&
      (q.installStatus === undefined || eq(m.installStatus, q.installStatus)) &&
      (q.phaseType === undefined || eq(m.phaseType, q.phaseType)) &&
      (q.transformer === undefined || eq(m.transformer.code, q.transformer)) &&
      (q.q === undefined ||
        m.meterId.toLowerCase().includes(q.q.toLowerCase()) ||
        m.serialNo.toLowerCase().includes(q.q.toLowerCase())));

    if (near) {
      rows = rows
        .filter((m) => m.location)
        .map((m) => ({ ...m, distanceKm: distanceKm(near.lat, near.lng, m.location.latitude, m.location.longitude) }))
        .filter((m) => m.distanceKm <= near.radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);
    }

    const total = rows.length;
    res.json({
      data: rows.slice((page - 1) * pageSize, page * pageSize),
      page, pageSize, total, totalPages: Math.ceil(total / pageSize),
      meta: meta(s),
    });
  });

  r.get("/meters/:id", async (req, res) => {
    const s = await store.get();
    const m = s.byId.get(req.params.id);
    if (!m) throw new ApiError(`Meter ${req.params.id} not found`, { status: 404, code: "not_found" });
    res.json({ data: m, meta: meta(s) });
  });

  r.get("/transformers", async (_req, res) => {
    const s = await store.get();
    res.json({ data: s.transformers, total: s.transformers.length, meta: meta(s) });
  });

  r.get("/hierarchy", async (_req, res) => {
    const s = await store.get();
    res.json({ data: s.tree, nodeCounts: s.nodeCounts, meta: meta(s) });
  });

  r.get("/data-quality", async (_req, res) => {
    const s = await store.get();
    res.json({
      data: s.dataQuality, count: s.dataQuality.length,
      hierarchy: s.hierarchyQuality, // conflicts found while building the tree (majority vote per DT)
      meta: meta(s),
    });
  });

  return r;
}
