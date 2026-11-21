const fs = require("node:fs");
const path = require("node:path");
const {
  OFFICIAL,
  GAMES,
  iso,
  normalizeCombination,
  makeDraw,
  parseOfficial,
  formBody,
  nextPage,
  parseFallback,
  mergeDraws,
  updateLegacy,
} = require("./updater/feeds");
const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "data");
const V2 = path.join(DATA, "v2");
const filename = (g) => (g === "3d" ? "results.json" : `results-${g}.json`);
const read = (p, fallback) =>
  fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : fallback;
function write(p, value) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p + ".tmp", JSON.stringify(value, null, 2) + "\n");
  fs.renameSync(p + ".tmp", p);
}
function addDays(date, days) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function manilaDate() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}
// Shared session, no parallel network calls: ASP.NET tokens and cookies belong to the latest response.
class OfficialClient {
  constructor() {
    this.cookies = new Map();
    this.html = null;
    this.requests = 0;
  }
  async request(url, body) {
    if (this.requests++) await new Promise((r) => setTimeout(r, 400));
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
      Accept: "text/html",
      Cookie: [...this.cookies].map(([k, v]) => k + "=" + v).join("; "),
    };
    if (body) headers["Content-Type"] = "application/x-www-form-urlencoded";
    const r = await fetch(url, {
      method: body ? "POST" : "GET",
      headers,
      body: body?.toString(),
      signal: AbortSignal.timeout(25000),
    });
    for (const cookie of r.headers.getSetCookie()) {
      const pair = cookie.split(";")[0];
      const i = pair.indexOf("=");
      this.cookies.set(pair.slice(0, i), pair.slice(i + 1));
    }
    if (!r.ok) throw Error(`HTTP ${r.status} ${url}`);
    const html = await r.text();
    if (!html.includes("GridView1") && !html.includes("ddlStartMonth"))
      throw Error("Official page blocked or changed");
    return html;
  }
  async range(start, end) {
    if (!this.html) this.html = await this.request(OFFICIAL);
    this.html = await this.request(OFFICIAL, formBody(this.html, start, end));
    this.unavailable =
      /<span[^>]*id=["'][^"']*lblError["'][^>]*>\s*Data is unavailable\.\s*<\/span>/i.test(
        this.html,
      );
    if (this.unavailable) return [];
    let draws = [],
      page = 1;
    const signatures = new Set();
    while (true) {
      const current = parseOfficial(this.html, start, end);
      const signature = current
        .map((d) => `${d.gameId}/${d.date}/${d.drawTime}/${d.combination}`)
        .join("|");
      if (signature && signatures.has(signature))
        throw Error("Official pagination repeated a page");
      signatures.add(signature);
      draws.push(...current);
      const next = nextPage(this.html, page);
      if (!next) break;
      if (page >= 100)
        throw Error("Official page budget exceeded; cursor retained");
      this.html = await this.request(
        OFFICIAL,
        formBody(this.html, start, end, next),
      );
      page = next.page;
    }
    // A stale response must not silently mark a requested day/range as successfully checked.
    if (
      !draws.length &&
      /\d{1,2}\/\d{1,2}\/\d{4}/.test(this.html) &&
      !/(no records|no results|no data|no draws)/i.test(this.html)
    )
      throw Error(
        "Official search returned no rows in requested range; possible stale response",
      );
    return mergeDraws([], draws);
  }
}
function seedLegacy(assetsDir) {
  const seeds = [];
  for (const game of GAMES) {
    const file = path.join(DATA, filename(game));
    const source = fs.existsSync(file)
      ? file
      : assetsDir
        ? path.join(assetsDir, filename(game))
        : null;
    if (!source || !fs.existsSync(source)) continue;
    const sourceUrl =
      source === file
        ? `https://github.com/keithjntlla/pcso-lotto-results/blob/main/data/${filename(game)}`
        : `https://github.com/keithjntlla/pcso-lotto-results#android-asset-seed-${game}`;
    for (const row of read(source, [])) {
      if (!iso(row.date)) continue;
      for (const drawTime of ["2PM", "5PM", "9PM"]) {
        if (!["2d", "3d"].includes(game) && drawTime !== "9PM") continue;
        const combination = normalizeCombination(
          game,
          row["draw" + drawTime.toLowerCase()] || "",
        );
        if (combination)
          seeds.push(
            makeDraw(
              game,
              row.date,
              drawTime,
              combination,
              "LegacyUnverified",
              sourceUrl,
              source === file ? "Legacy shared feed" : "Android asset snapshot",
            ),
          );
      }
    }
  }
  return seeds;
}
async function run() {
  const args = process.argv.slice(2);
  const option = (name, fallback) => {
    const i = args.indexOf("--" + name);
    return i < 0 ? fallback : args[i + 1];
  };
  const today = option("date", manilaDate());
  if (!iso(today)) throw Error("Invalid --date");
  const days = Number(option("backfill-days", "1"));
  if (!Number.isInteger(days) || days < 0 || days > 31)
    throw Error("--backfill-days must be 0..31");
  const now = new Date().toISOString();
  let state = read(path.join(DATA, "coverage.json"), {
    schemaVersion: 1,
    backfill: { nextDate: "2016-01-01", lastCheckedDate: null },
    queries: [],
  });
  let all = GAMES.flatMap(
    (g) => read(path.join(V2, `results-${g}.json`), { draws: [] }).draws,
  );
  if (args.includes("--seed"))
    all = mergeDraws(all, seedLegacy(option("assets", null)));
  const client = new OfficialClient();
  const incoming = [];
  const attempts = [];
  async function query(start, end, kind) {
    try {
      const draws = await client.range(start, end);
      incoming.push(...draws);
      const info = {
        start,
        end,
        kind,
        checkedAt: now,
        status: client.unavailable ? "unavailable" : "success",
        drawCount: draws.length,
      };
      attempts.push(info);
      console.log(JSON.stringify(info));
      return true;
    } catch (e) {
      client.html = null;
      const info = {
        start,
        end,
        kind,
        checkedAt: now,
        status: "failed",
        error: e.cause?.message || e.message,
      };
      attempts.push(info);
      console.error(JSON.stringify(info));
      return false;
    }
  }
  const recentStart = option("from", addDays(today, -6));
  const recentEnd = option("to", today);
  if (
    !iso(recentStart) ||
    !iso(recentEnd) ||
    recentStart > recentEnd ||
    recentEnd > today
  )
    throw Error("Invalid query range");
  const recentOk = await query(recentStart, recentEnd, "recent");
  for (let i = 0; i < days && state.backfill.nextDate <= today; i++) {
    const date = state.backfill.nextDate;
    if (!(await query(date, date, "backfill"))) break;
    state.backfill.lastCheckedDate = date;
    state.backfill.nextDate = addDays(date, 1);
  }
  // Optional third-party results remain provisional and never change legacy endpoints.
  if (!recentOk || !incoming.some((d) => d.date === today))
    for (const game of ["3d", "2d"]) {
      const url = `https://lottobalita.com/${game}-lotto/`;
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!r.ok) throw Error(`HTTP ${r.status}`);
        const draws = parseFallback(await r.text(), game, today, url);
        incoming.push(...draws);
        attempts.push({
          provider: url,
          date: today,
          status: "success",
          drawCount: draws.length,
        });
      } catch (e) {
        attempts.push({
          provider: url,
          date: today,
          status: "failed",
          error: e.cause?.message || e.message,
        });
        console.error(`Fallback ${game}: ${e.message}`);
      }
    }
  all = mergeDraws(all, incoming);
  state.unavailableRanges = [
    ...(state.unavailableRanges || []),
    ...attempts
      .filter((a) => a.status === "unavailable")
      .map(({ start, end, checkedAt }) => ({ start, end, checkedAt })),
  ];
  state.queries = [...attempts, ...state.queries].slice(0, 100);
  state.updatedAt = now;
  const coverage = {
    historicalStart: "2016-01-01",
    backfill: state.backfill,
    lastRun: attempts,
    counts: Object.fromEntries(
      GAMES.map((g) => [
        g,
        Object.fromEntries(
          ["LegacyUnverified", "Provisional", "OfficialConfirmed"].map((c) => [
            c,
            all.filter((d) => d.gameId === g && d.confirmation === c).length,
          ]),
        ),
      ]),
    ),
  };
  for (const game of GAMES) {
    const draws = all.filter((d) => d.gameId === game);
    write(path.join(V2, `results-${game}.json`), {
      schemaVersion: 2,
      generatedAt: now,
      coverage,
      draws,
    });
    const legacyPath = path.join(DATA, filename(game));
    write(
      legacyPath,
      updateLegacy(
        read(legacyPath, []),
        incoming.filter((d) => d.gameId === game),
      ),
    );
  }
  write(path.join(V2, "latest.json"), {
    schemaVersion: 2,
    generatedAt: now,
    coverage,
    draws: all.filter((d) => d.date >= addDays(today, -6) && d.date <= today),
  });
  write(path.join(DATA, "coverage.json"), state);
  console.log(
    `Published ${all.length} v2 draws; official incoming ${incoming.filter((d) => d.confirmation === "OfficialConfirmed").length}; network requests ${client.requests}`,
  );
  if (!attempts.some((a) => a.kind && a.status === "success"))
    process.exitCode = 1;
}
if (require.main === module)
  run().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
module.exports = { OfficialClient, seedLegacy, addDays, run };
