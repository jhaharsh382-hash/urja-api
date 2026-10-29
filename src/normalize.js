import { LEVELS } from "./hierarchy.js";

const clean = (v) => {
  const t = typeof v === "string" ? v.trim() : v;
  return t === "" || t === undefined ? null : t;
};

/** Per DT and level, the most common complete {code, name} across that DT's meters. */
export function consensusByDt(records) {
  const tallies = new Map();
  for (const r of records) for (const level of LEVELS) {
    const code = clean(r.hierarchy?.[level]?.code);
    const name = clean(r.hierarchy?.[level]?.name);
    if (!code || !name) continue;
    const key = `${r.dtCode}|${level}`;
    const m = tallies.get(key) ?? new Map();
    const id = `${code}::${name}`;
    const e = m.get(id) ?? { code, name, n: 0 };
    e.n++;
    m.set(id, e);
    tallies.set(key, m);
  }
  const out = new Map();
  for (const [key, m] of tallies) {
    out.set(key, [...m.values()].sort(
      (a, b) => b.n - a.n || a.code.localeCompare(b.code) || a.name.localeCompare(b.name)
    )[0]);
  }
  return out;
}

/**
 * Export record -> API model. The export has the same gaps as the portal's meter pages
 * (blank names/codes, '' instead of null), so missing parts are filled from, in order:
 *   1. the transformer master list (feeder code, DT name),
 *   2. the majority value across the other meters on the same DT.
 * Every fill is recorded in `warnings`; gaps with no source stay null.
 */
export function normalizeMeter(r, { transformers, consensus }) {
  const warnings = [];
  const tx = transformers.get(r.dtCode) ?? null;
  const hierarchy = {};

  for (const level of LEVELS) {
    let code = clean(r.hierarchy?.[level]?.code);
    let name = clean(r.hierarchy?.[level]?.name);

    if (level === "feeder" && !code && tx?.feederCode) {
      code = tx.feederCode;
      warnings.push("feeder.code filled from transformer master list");
    }
    if (level === "dt" && tx && name !== tx.name) {
      warnings.push(name
        ? `dt.name "${name}" differs from transformer master list; using "${tx.name}"`
        : "dt.name filled from transformer master list");
      name = tx.name;
    }
    if (!code || !name) {
      const c = consensus.get(`${r.dtCode}|${level}`);
      if (c) {
        let filled = false;
        if (!code && (!name || name === c.name)) { code = c.code; filled = true; }
        if (!name && (!code || code === c.code)) { name = c.name; filled = true; }
        if (filled) warnings.push(`${level} filled from other meters on ${r.dtCode}`);
      }
    }
    if (!code || !name) warnings.push(`${level} incomplete in portal and could not be filled`);
    hierarchy[level] = { code, name };
  }

  return {
    meterId: r.meterId,
    serialNo: r.serialNo,
    make: r.make,
    phaseType: r.phaseType,
    installStatus: r.installStatus,
    installationType: clean(r.installType),
    transformer: tx
      ? { code: tx.code, name: tx.name, feederCode: tx.feederCode, capacityKva: tx.capacityKva }
      : { code: r.dtCode, name: null, feederCode: null, capacityKva: null },
    hierarchy,
    location: r.geo ? { latitude: r.geo.lat, longitude: r.geo.lng } : null,
    warnings,
  };
}
