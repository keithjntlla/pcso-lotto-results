const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseOfficial,
  formBody,
  nextPage,
  parseFallback,
  mergeDraws,
  updateLegacy,
  normalizeCombination,
} = require("./feeds");
const row = (game, combo, date = "11/20/2026", jackpot = "4,500.00") =>
  `<tr><td>${game}</td><td>${combo}</td><td>${date}</td><td>${jackpot}</td><td>12</td></tr>`;
const page = (rows) =>
  `<table id="cphContainer_cpContent_GridView1"><tr><th>LOTTO GAME</th><th>COMBINATIONS</th><th>DRAW DATE</th><th>JACKPOT (PHP)</th><th>WINNERS</th></tr>${rows}</table>`;
test("official columns keep row date and game draw time, never infer digit prize as jackpot", () => {
  const rows = parseOfficial(
    page(
      row("3D Lotto 5PM", "8-8-1") +
        row(
          "Ultra Lotto 6/58",
          "51-22-34-27-01-24",
          "11/20/2026",
          "563,290,295.70",
        ),
    ),
    "2026-11-20",
    "2026-11-20",
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].drawTime, "5PM");
  assert.equal(rows[0].jackpotCentavos, null);
  assert.equal(rows[1].jackpotCentavos, 56329029570);
  assert.equal(
    parseOfficial(
      page(row("3D Lotto 2PM", "1-2-3", "11/19/2026")),
      "2026-11-20",
      "2026-11-20",
    ).length,
    0,
  );
});
test("strict game ranges, width and repeated sixball validation", () => {
  assert.equal(normalizeCombination("2d", "1-31"), "01-31");
  assert.equal(normalizeCombination("2d", "00-32"), null);
  assert.equal(normalizeCombination("642", "01-02-03-04-05-43"), null);
  assert.equal(normalizeCombination("642", "01-02-03-04-05-05"), null);
  assert.equal(normalizeCombination("3d", "10-2-3"), null);
});
test("form uses actual option values including named months and EndDay", () => {
  const html = `<form><input type="hidden" name="__VIEWSTATE" value="x&amp;y"><select name="p$ddlStartMonth"><option value="November">November</option></select><select name="p$ddlStartDate"><option value="20">20</option></select><select name="p$ddlStartYear"><option value="2026">2026</option></select><select name="p$ddlEndMonth"><option value="November">November</option></select><select name="p$ddlEndDay"><option value="21">21</option></select><select name="p$ddlEndYear"><option value="2026">2026</option></select><select name="p$ddlSelectGame"><option value="0">All Games</option></select><input type="submit" name="p$btnSearch" value="Search Lotto"></form>`;
  const b = formBody(html, "2026-11-20", "2026-11-21");
  assert.equal(b.get("p$ddlStartMonth"), "November");
  assert.equal(b.get("p$ddlEndDay"), "21");
  assert.equal(b.get("__VIEWSTATE"), "x&y");
  assert.throws(() => formBody(html, "2016-11-20", "2026-11-21"));
});
test("pager selects next numbered page after current span, not sidebar or previous page", () => {
  const h = page(
    `<tr><td colspan="5"><a href="javascript:__doPostBack(&#39;grid&#39;,&#39;Page$1&#39;)">1</a><span>2</span><a href="javascript:__doPostBack(&#39;grid&#39;,&#39;Page$3&#39;)">3</a></td></tr>`,
  );
  assert.deepEqual(nextPage(h, 2), {
    target: "grid",
    argument: "Page$3",
    page: 3,
  });
});
test("fallback only accepts explicit date inside row, rejects stale title and undated label", () => {
  const h =
    "<h1>November 20, 2026</h1><label>2PM 1-2-3</label><table><tr><td>November 19, 2026</td><td>1-2-3</td><td>4-5-6</td><td>7-8-9</td></tr></table>";
  assert.equal(
    parseFallback(h, "3d", "2026-11-20", "https://example.com").length,
    0,
  );
  assert.equal(
    parseFallback(h, "3d", "2026-11-19", "https://example.com").length,
    3,
  );
});
test("official replaces provisional, conflicts among provisional providers preserve incumbent, duplicate official disagreement fails", () => {
  const base = {
    gameId: "3d",
    date: "2026-11-20",
    drawTime: "2PM",
    combination: "1-2-3",
    confirmation: "Provisional",
    provider: "a",
  };
  assert.equal(
    mergeDraws([base], [{ ...base, provider: "b", combination: "4-5-6" }])[0]
      .combination,
    "1-2-3",
  );
  const official = {
    ...base,
    confirmation: "OfficialConfirmed",
    combination: "4-5-6",
  };
  assert.equal(mergeDraws([base], [official])[0].combination, "4-5-6");
  assert.equal(mergeDraws([official], [base])[0].combination, "4-5-6");
  assert.throws(() =>
    mergeDraws([], [official, { ...official, combination: "7-8-9" }]),
  );
});
test("legacy retains all history and accepts only official updates without empty overwrite", () => {
  const old = [
    { date: "2020-01-01", draw2pm: "1-2-3", draw5pm: "--", draw9pm: "--" },
  ];
  assert.deepEqual(
    updateLegacy(old, [
      {
        date: "2026-11-20",
        drawTime: "2PM",
        combination: "4-5-6",
        confirmation: "Provisional",
      },
    ]),
    old,
  );
  const result = updateLegacy(old, [
    {
      date: "2020-01-01",
      drawTime: "5PM",
      combination: "7-8-9",
      confirmation: "OfficialConfirmed",
    },
  ]);
  assert.equal(result[0].draw2pm, "1-2-3");
  assert.equal(result[0].draw5pm, "7-8-9");
});
const { OfficialClient } = require("../scrape");
const { iso } = require("./feeds");
function fixtureForm() {
  return (
    ["Start", "End"]
      .map((side) =>
        ["Month", side === "Start" ? "Date" : "Day", "Year"]
          .map(
            (suffix, i) =>
              `<select name="p$ddl${side}${suffix}"><option value="${["November", "20", "2026"][i]}">${["November", "20", "2026"][i]}</option></select>`,
          )
          .join(""),
      )
      .join("") +
    '<select name="p$ddlSelectGame"><option value="0">All Games</option></select><input type="submit" name="p$btnSearch" value="Search Lotto">'
  );
}
test("invalid calendar dates are rejected without crashing", () => {
  assert.equal(iso("2026-13-01"), null);
  assert.equal(iso("2026-02-30"), null);
});
test("official client submits range and follows ASP.NET numbered page without date leakage", async () => {
  class Client extends OfficialClient {
    constructor() {
      super();
      this.calls = [];
    }
    async request(url, body) {
      this.calls.push(body);
      if (!body) return fixtureForm();
      if (body.get("__EVENTARGUMENT"))
        return fixtureForm() + page(row("2D Lotto 9PM", "01-31"));
      return (
        fixtureForm() +
        page(
          row("3D Lotto 2PM", "1-2-3") +
            '<tr><td colspan="5"><a href="javascript:__doPostBack(&#39;grid&#39;,&#39;Page$2&#39;)">2</a></td></tr>',
        )
      );
    }
  }
  const c = new Client();
  const d = await c.range("2026-11-20", "2026-11-20");
  assert.equal(d.length, 2);
  assert.equal(c.calls[1].get("p$ddlStartMonth"), "November");
  assert.equal(c.calls[2].get("__EVENTARGUMENT"), "Page$2");
});
test("official stale search and repeated pagination fail without advancing coverage", async () => {
  class Stale extends OfficialClient {
    async request(url, body) {
      return fixtureForm() + page(row("3D Lotto 2PM", "1-2-3", "11/19/2026"));
    }
  }
  await assert.rejects(new Stale().range("2026-11-20", "2026-11-20"), /stale/);
  class Repeated extends OfficialClient {
    async request() {
      return (
        fixtureForm() +
        page(
          row("3D Lotto 2PM", "1-2-3") +
            '<tr><td colspan="5"><a href="javascript:__doPostBack(&#39;grid&#39;,&#39;Page$2&#39;)">2</a></td></tr>',
        )
      );
    }
  }
  await assert.rejects(
    new Repeated().range("2026-11-20", "2026-11-20"),
    /repeated/,
  );
});
test("official explicit unavailable has no fabricated rows", async () => {
  class Empty extends OfficialClient {
    async request() {
      return (
        fixtureForm() +
        '<span id="cphContainer_cpContent_lblError">Data is unavailable.</span>'
      );
    }
  }
  const c = new Empty();
  assert.deepEqual(await c.range("2026-11-20", "2026-11-20"), []);
  assert.equal(c.unavailable, true);
});
