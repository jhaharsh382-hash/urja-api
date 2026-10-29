const BASE = "https://urja-ops.flockenergy.tech";
const EMAIL = process.env.URJA_EMAIL;
const PASSWORD = process.env.URJA_PASSWORD;

async function login() {
  const res = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: BASE,
    },
    body: new URLSearchParams({ email: EMAIL, password: PASSWORD }),
    redirect: "manual",
  });
  console.log("login:", res.status, await res.text());
  return res.headers.getSetCookie()[0].split(";")[0];
}

const cookie = await login();

async function get(path) {
  const res = await fetch(BASE + path, { headers: { Cookie: cookie } });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

// experiment 1: pagination edge cases
for (const p of [1, 21, 22, 0, -1, "abc"]) {
  const { status, body } = await get(`/portal/meters/search?q=&page=${p}`);
  console.log(
    `page=${p} ->`, status,
    body.data ? `rows=${body.data.length} total=${body.total} page=${body.page}` : body
  );
}

// experiment 2: does any parameter change the page size?
for (const k of ["pageSize", "limit", "per_page", "size"]) {
  const { body } = await get(`/portal/meters/search?q=&page=1&${k}=100`);
  console.log(k, "-> pageSize echoed:", body.pageSize, "rows:", body.data?.length);
}

// experiment 3: search behaviour
for (const q of ["J1000", "j1000", "SE33962", "L%26T", "DT-001", "genus"]) {
  const { body } = await get(`/portal/meters/search?q=${q}&page=1`);
  console.log(`q=${q} -> total=${body.total}`);
}
// integrity check: walk all pages
const all = [];
for (let p = 1; ; p++) {
  const { body } = await get(`/portal/meters/search?q=&page=${p}`);
  if (!body.data.length) break;
  all.push(...body.data);
}
const ids = new Set(all.map((m) => m.meterId));
console.log("rows fetched:", all.length, "unique meterIds:", ids.size);
console.log("statuses:", [...new Set(all.map((m) => m.installStatus))]);
console.log("makes:", [...new Set(all.map((m) => m.make))]);
console.log("phases:", [...new Set(all.map((m) => m.phaseType))]);
console.log("unique dtCodes:", new Set(all.map((m) => m.dtCode)).size);
console.log("odd serials:", all.filter((m) => !/^[A-Z]{2}\d{5}$/.test(m.serialNo)).map((m) => m.serialNo));