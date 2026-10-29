export const LEVELS = ["zone", "circle", "division", "subdivision", "substation", "feeder", "dt"];

/**
 * meters: [{ meterId, dtCode, hierarchy: { zone: {name, code}, ... dt: {name, code} } }]
 * Returns { tree, nodeCounts, dataQuality }.
 *
 * Node identity is the full path of codes ("Z-01/C-01/D-01"), NOT the code alone:
 * the portal reuses codes under different parents (e.g. D-01 sits under C-01, C-03 and C-05).
 * Per DT, each level takes the majority value across that DT's meters. Every meter that
 * disagrees, or has a blank or code-less level, is listed in dataQuality rather than hidden.
 */
export function buildHierarchy(meters) {
  const byDt = new Map();
  for (const m of meters) {
    if (!byDt.has(m.dtCode)) byDt.set(m.dtCode, []);
    byDt.get(m.dtCode).push(m);
  }

  const tree = [];
  const index = new Map();
  const issues = [];

  for (const dtCode of [...byDt.keys()].sort()) {
    const group = byDt.get(dtCode);
    const codes = [];
    let siblings = tree;

    for (const level of LEVELS) {
      const tally = new Map();
      for (const m of group) {
        const l = m.hierarchy[level];
        if (!l?.code) continue;
        const id = `${l.code}::${l.name}`;
        const t = tally.get(id) ?? { code: l.code, name: l.name, n: 0 };
        t.n++;
        tally.set(id, t);
      }
      if (!tally.size) {
        issues.push({ dt: dtCode, level, problem: "missing for every meter" });
        continue;
      }
      const ranked = [...tally.values()].sort(
        (a, b) => b.n - a.n || a.code.localeCompare(b.code) || String(a.name).localeCompare(String(b.name))
      );
      const win = ranked[0];
      const used = `${win.name} (${win.code})`;
      if (ranked[1] && ranked[1].n === win.n) {
        issues.push({
          dt: dtCode, level, problem: "tie between candidates",
          candidates: ranked.map((r) => `${r.name} (${r.code}) x${r.n}`),
        });
      }

      for (const m of group) {
        const l = m.hierarchy[level];
        if (!l?.code) {
          issues.push({
            meterId: m.meterId, dt: dtCode, level,
            problem: l?.name ? "code missing" : "blank",
            observed: l?.name ?? null, used,
          });
        } else if (l.code !== win.code || l.name !== win.name) {
          issues.push({
            meterId: m.meterId, dt: dtCode, level,
            problem: "differs from majority",
            observed: `${l.name} (${l.code})`, used,
          });
        }
      }

      codes.push(win.code);
      const path = codes.join("/");
      let node = index.get(path);
      if (!node) {
        node = { level, code: win.code, name: win.name, path, meterCount: 0, children: [] };
        index.set(path, node);
        siblings.push(node);
      }
      node.meterCount += group.length;
      siblings = node.children;
    }
  }

  const nodeCounts = {};
  for (const n of index.values()) nodeCounts[n.level] = (nodeCounts[n.level] ?? 0) + 1;
  return { tree, nodeCounts, dataQuality: { issueCount: issues.length, issues } };
}
