import { PortalError } from "../errors.js";
import { unflatten, splitLabel } from "../portal/devalue.js";

const LEVELS = [
  ["zone", "Zone"], ["circle", "Circle"], ["division", "Division"],
  ["subdivision", "Subdivision"], ["substation", "Sub Station"],
  ["feeder", "Feeder"], ["dt", "DT"],
];

const bad = (msg) => new PortalError(msg, { status: 502, code: "portal_bad_payload" });
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, ""); // "Meter ID" / "MeterId" -> "meterid"

/** The portal sends the nameplate in one of two shapes. Return a flat {normalisedKey: value}. */
function readNameplate(detail) {
  // Shape A: { data: [ { parameterName, parameterValue }, ... ] }
  if (Array.isArray(detail?.data)) {
    return Object.fromEntries(detail.data.map((p) => [norm(p.parameterName), p.parameterValue]));
  }
  // Shape B: { classData: "<json string>" } containing { installed_meter: { MeterId, ... } }
  if (detail?.classData !== undefined) {
    let obj = detail.classData;
    try {
      if (typeof obj === "string") obj = JSON.parse(obj);
    } catch {
      throw bad("classData is not valid JSON");
    }
    const inner = obj?.installed_meter ?? obj;
    return Object.fromEntries(Object.entries(inner ?? {}).map(([k, v]) => [norm(k), v]));
  }
  throw bad(`Unknown nameplate shape (keys: ${Object.keys(detail ?? {}).join(",")})`);
}

/** Turn the portal's /meters/{id}/__data.json into a clean object. */
export function parseMeterPage(raw) {
  const errNode = (raw?.nodes ?? []).find((n) => n?.type === "error");
  if (errNode) {
    const notFound = errNode.status === 404;
    throw new PortalError(notFound ? "Meter not found" : "Portal error loading meter", {
      status: notFound ? 404 : 502,
      code: notFound ? "not_found" : "portal_page_error",
    });
  }
  const pages = (raw?.nodes ?? [])
    .filter((n) => n?.type === "data")
    .map((n) => unflatten(n.data));
  const page = pages.find((p) => p && typeof p === "object" && p.detail && p.hierarchy);
  if (!page) throw bad("Meter page data not found in __data.json");

  const np = readNameplate(page.detail);
  const hierarchy = {};
  for (const [key, label] of LEVELS) hierarchy[key] = splitLabel(page.hierarchy[label]);

  return {
    meterId: np.meterid ?? page.hierarchy["Meter ID"] ?? null,
    serialNo: np.serialno ?? null,
    make: np.make ?? null,
    phaseType: np.phasetype ?? null,
    installStatus: np.installationstatus ?? page.hierarchy["Installation Status"] ?? null,
    installationType: np.installationtype ?? page.hierarchy["Installation Type"] ?? null,
    hierarchy,
  };
}

