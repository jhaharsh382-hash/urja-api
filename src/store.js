import { fetchExport, fetchTransformers } from "./portal/export.js";
import { consensusByDt, normalizeMeter } from "./normalize.js";
import { buildHierarchy } from "./hierarchy.js";

export class Store {
  constructor(client, { ttlMs = 10 * 60_000 } = {}) {
    this.client = client;
    this.ttlMs = ttlMs;
    this.snapshot = null;
    this.inflight = null; // concurrent callers share one refresh
  }

  /** Current snapshot. Refreshes when older than the TTL; on failure serves the old one, marked stale. */
  async get() {
    const s = this.snapshot;
    if (s && Date.now() - s.fetchedAt < this.ttlMs) return s;
    try {
      return await this.refresh();
    } catch (err) {
      if (s) return { ...s, stale: true };
      throw err;
    }
  }

  refresh() {
    this.inflight ??= this.#load()
      .then((snap) => { this.snapshot = snap; return snap; })
      .finally(() => { this.inflight = null; });
    return this.inflight;
  }

  async #load() {
    const [records, dts] = await Promise.all([
      fetchExport(this.client),
      fetchTransformers(this.client),
    ]);
    const transformers = new Map(dts.map((d) => [d.code, d]));
    const consensus = consensusByDt(records);
    const meters = records.map((r) => normalizeMeter(r, { transformers, consensus }));
    const { tree, nodeCounts, dataQuality: hierarchyQuality } = buildHierarchy(
      meters.map((m) => ({ meterId: m.meterId, dtCode: m.transformer.code, hierarchy: m.hierarchy }))
    );
    return {
      fetchedAt: Date.now(),
      stale: false,
      meters,
      byId: new Map(meters.map((m) => [m.meterId, m])),
      transformers: dts,
      tree,
      nodeCounts,
      hierarchyQuality,
      dataQuality: meters.filter((m) => m.warnings.length).map((m) => ({ meterId: m.meterId, warnings: m.warnings })),
    };
  }
}

