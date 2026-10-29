// Minimal decoder for SvelteKit's flattened (devalue) format.
// Handles objects, arrays and primitives, which is all this portal sends.
// Not handled: tagged values like Date/Map/Set. Use the `devalue` package if those appear.
export function unflatten(flat) {
  const memo = new Map();
  const get = (i) => {
    if (i === -1) return undefined;
    if (memo.has(i)) return memo.get(i);
    const v = flat[i];
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) {
      const out = [];
      memo.set(i, out);
      for (const j of v) out.push(get(j));
      return out;
    }
    const out = {};
    memo.set(i, out);
    for (const [k, j] of Object.entries(v)) out[k] = get(j);
    return out;
  };
  return get(0);
}

// "Feeder 5 (F-005)" -> { name: "Feeder 5", code: "F-005" }
export function splitLabel(s) {
  const m = /^(.*)\s+\(([^)]+)\)\s*$/.exec(s ?? "");
  return m ? { name: m[1], code: m[2] } : { name: s ?? null, code: null };
}
