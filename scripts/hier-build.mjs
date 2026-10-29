import { readFileSync, writeFileSync } from "node:fs";
import { splitLabel } from "../src/portal/devalue.js";
import { buildHierarchy, LEVELS } from "../src/hierarchy.js";

const LABEL = { zone: "Zone", circle: "Circle", division: "Division", subdivision: "Subdivision",
  substation: "Sub Station", feeder: "Feeder", dt: "DT" };

const rows = JSON.parse(readFileSync("fixtures/hierarchy-snapshot.json", "utf8"));
const meters = rows.map((r) => ({
  meterId: r.meterId, dtCode: r.dtCode,
  hierarchy: Object.fromEntries(LEVELS.map((k) => [k, splitLabel(r.hierarchy[LABEL[k]])])),
}));

const { tree, nodeCounts, dataQuality } = buildHierarchy(meters);
console.log("nodes per level (by full path):", nodeCounts);

const byProblem = {};
for (const i of dataQuality.issues) byProblem[i.problem] = (byProblem[i.problem] ?? 0) + 1;
console.log("issues:", dataQuality.issueCount, byProblem);
console.log(dataQuality.issues.filter((i) => !["code missing", "blank"].includes(i.problem)).slice(0, 10));

writeFileSync("fixtures/hierarchy-tree.json", JSON.stringify({ tree, dataQuality }, null, 1));
console.log("wrote fixtures/hierarchy-tree.json");
