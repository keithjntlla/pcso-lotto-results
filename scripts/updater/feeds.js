const crypto = require("node:crypto");
const OFFICIAL = "https://www.pcso.gov.ph/searchlottoresult.aspx";
const GAMES = ["3d", "2d", "4d", "6d", "642", "645", "649", "655", "658"];
const decode = (s) =>
  s
    .replace(/&(?:#39|apos);/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;|&#160;/g, " ");
const text = (s) =>
  decode(s.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
function attrs(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([\w$:-]+)\s*=\s*["']([^"']*)["']/g)].map((m) => [
      m[1],
      decode(m[2]),
    ]),
  );
}
function iso(raw) {
  let m = raw.trim().match(/^(\d{4})-(\d\d)-(\d\d)$/);
  let value = m ? m[0] : null;
  if (!value && (m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)))
    value = `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  if (!value && /^[A-Za-z]+ \d{1,2}, \d{4}$/.test(raw.trim())) {
    const d = new Date(raw + " UTC");
    if (!isNaN(d)) value = d.toISOString().slice(0, 10);
  }
  const parsed = value ? new Date(value + "T00:00:00Z") : null;
  return parsed && !isNaN(parsed) && parsed.toISOString().slice(0, 10) === value
    ? value
    : null;
}
function normalizeCombination(game, raw) {
  const parts = raw.trim().split(/\s*[-–]\s*/);
  const count = { "2d": 2, "3d": 3, "4d": 4, "6d": 6 }[game] || 6;
  if (parts.length !== count || parts.some((p) => !/^\d{1,2}$/.test(p)))
    return null;
  const numbers = parts.map(Number);
  const max =
    game === "2d" ? 31 : game.endsWith("d") ? 9 : Number(game.slice(1));
  if (
    numbers.some(
      (n) => n < (game.endsWith("d") && game !== "2d" ? 0 : 1) || n > max,
    )
  )
    return null;
  if (!game.endsWith("d") && new Set(numbers).size !== 6) return null;
  return numbers
    .map((n) =>
      game === "2d" || !game.endsWith("d")
        ? String(n).padStart(2, "0")
        : String(n),
    )
    .join("-");
}
function makeDraw(
  gameId,
  date,
  drawTime,
  combination,
  confirmation,
  sourceUrl,
  provider,
  jackpotCentavos = null,
  winners = null,
) {
  const d = {
    gameId,
    date,
    drawTime,
    combination,
    jackpotCentavos,
    winners,
    confirmation,
    sourceUrl,
    provider,
    observedAt: new Date().toISOString(),
  };
  d.revision = crypto
    .createHash("sha256")
    .update(JSON.stringify({ ...d, observedAt: undefined }))
    .digest("hex")
    .slice(0, 24);
  return d;
}
function grid(html) {
  return (
    html.match(
      /<table\b[^>]*id=["'][^"']*GridView1["'][^>]*>([\s\S]*?)<\/table>/i,
    )?.[1] || ""
  );
}
function parseOfficial(html, start, end) {
  const table = grid(html);
  if (
    !["LOTTO GAME", "COMBINATIONS", "DRAW DATE", "JACKPOT", "WINNERS"].every(
      (h) => text(table).includes(h),
    )
  )
    throw Error("Official results grid/columns missing");
  const draws = [];
  for (const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const c = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      text(m[1]),
    );
    if (c.length !== 5) continue;
    const g = c[0].match(/([2346])D Lotto(?:\s*(2|5|9)\s*PM)?/i);
    const six = c[0].match(/6\/(42|45|49|55|58)/);
    const game = g ? g[1] + "d" : six ? "6" + six[1] : null;
    if (!game) continue;
    const date = iso(c[2]);
    if (!date || date < start || date > end) continue;
    const time =
      g && ["2", "3"].includes(g[1]) ? (g[2] ? g[2] + "PM" : null) : "9PM";
    if (!time) continue;
    const combo = normalizeCombination(game, c[1]);
    if (!combo) throw Error(`Invalid official combination ${game} ${date}`);
    let money = null;
    if (six && /^\d[\d,]*\.\d{2}$/.test(c[3])) {
      const [pesos, cents] = c[3].replaceAll(",", "").split(".");
      const n = Number(pesos) * 100 + Number(cents);
      if (Number.isSafeInteger(n)) money = n;
    }
    const winners =
      /^\d+$/.test(c[4]) && Number.isSafeInteger(Number(c[4]))
        ? Number(c[4])
        : null;
    draws.push(
      makeDraw(
        game,
        date,
        time,
        combo,
        "OfficialConfirmed",
        OFFICIAL,
        "PCSO",
        money,
        winners,
      ),
    );
  }
  return draws;
}
function formBody(html, start, end, pager) {
  const b = new URLSearchParams();
  for (const m of html.matchAll(/<input\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    if (a.name && a.type === "hidden") b.set(a.name, a.value || "");
  }
  const select = [
    ...html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi),
  ].map((m) => ({
    name: attrs(m[1]).name,
    options: [...m[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)].map(
      (o) => ({ value: attrs(o[1]).value, label: text(o[2]) }),
    ),
  }));
  for (const [side, date] of [
    ["Start", start],
    ["End", end],
  ]) {
    const [year, month, day] = date.split("-");
    const monthName = new Intl.DateTimeFormat("en-US", {
      month: "long",
      timeZone: "UTC",
    }).format(new Date(date + "T00:00:00Z"));
    for (const [suffix, value] of [
      ["Month", monthName],
      [side === "Start" ? "Date" : "Day", String(Number(day))],
      ["Year", year],
    ]) {
      const s = select.find((s) => s.name?.endsWith("ddl" + side + suffix));
      const option = s?.options.find(
        (o) => o.label === value || o.value === value,
      );
      if (!s || !option)
        throw Error(`Official form does not support ${side}${suffix} ${value}`);
      b.set(s.name, option.value);
    }
  }
  const game = select.find((s) => s.name?.endsWith("ddlSelectGame"));
  const all = game?.options.find((o) => /^All Games$/i.test(o.label));
  if (!all) throw Error("All Games option missing");
  b.set(game.name, all.value);
  if (pager) {
    b.set("__EVENTTARGET", pager.target);
    b.set("__EVENTARGUMENT", pager.argument);
  } else {
    const submit = [...html.matchAll(/<input\b[^>]*>/gi)]
      .map((m) => attrs(m[0]))
      .find((a) => a.type === "submit" && /Search Lotto/i.test(a.value));
    if (!submit) throw Error("Official search submit missing");
    b.set(submit.name, submit.value);
  }
  return b;
}
function nextPage(html, current = 1) {
  const candidates = [
    ...decode(grid(html)).matchAll(/__doPostBack\('([^']+)','Page\$(\d+)'\)/g),
  ]
    .map((m) => ({
      target: m[1],
      argument: "Page$" + m[2],
      page: Number(m[2]),
    }))
    .filter((p) => p.page > current)
    .sort((a, b) => a.page - b.page);
  return candidates[0] || null;
}
function parseFallback(html, game, date, url) {
  const draws = [];
  // A date in a title, metadata or neighbouring section cannot date a result row.
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
      (m) => text(m[1]),
    );
    if (cells.length !== 4 || iso(cells[0]) !== date) continue;
    for (let i = 1; i <= 3; i++) {
      const combo = normalizeCombination(game, cells[i]);
      if (combo)
        draws.push(
          makeDraw(
            game,
            date,
            ["2PM", "5PM", "9PM"][i - 1],
            combo,
            "Provisional",
            url,
            new URL(url).hostname,
          ),
        );
    }
  }
  return draws;
}
const key = (d) => `${d.gameId}/${d.date}/${d.drawTime}`;
function mergeDraws(existing, incoming) {
  const seen = new Map();
  for (const d of incoming) {
    const k = key(d),
      prev = seen.get(k);
    if (
      prev &&
      prev.confirmation === d.confirmation &&
      prev.combination !== d.combination
    )
      throw Error(`Conflicting source rows ${k}`);
    seen.set(k, d);
  }
  const rank = { LegacyUnverified: 0, Provisional: 1, OfficialConfirmed: 2 };
  const map = new Map(existing.map((d) => [key(d), d]));
  for (const d of incoming) {
    const old = map.get(key(d));
    if (
      !old ||
      rank[d.confirmation] > rank[old.confirmation] ||
      (d.confirmation === "OfficialConfirmed" && d.revision !== old.revision)
    )
      map.set(key(d), d);
  }
  return [...map.values()].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      a.gameId.localeCompare(b.gameId) ||
      a.drawTime.localeCompare(b.drawTime),
  );
}
function updateLegacy(existing, draws) {
  const map = new Map(existing.map((r) => [r.date, { ...r }]));
  for (const d of draws) {
    if (d.confirmation !== "OfficialConfirmed" || !d.combination) continue;
    let row = map.get(d.date) || {
      date: d.date,
      draw2pm: "--",
      draw5pm: "--",
      draw9pm: "--",
    };
    row["draw" + d.drawTime.toLowerCase()] = d.combination;
    if (
      d.gameId &&
      !d.gameId.endsWith("d") &&
      d.drawTime === "9PM" &&
      d.jackpotCentavos != null
    )
      row.jackpot = (d.jackpotCentavos / 100).toFixed(2);
    if (
      d.gameId &&
      !d.gameId.endsWith("d") &&
      d.drawTime === "9PM" &&
      d.winners != null
    )
      row.winners = d.winners;
    map.set(d.date, row);
  }
  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
}
module.exports = {
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
};
