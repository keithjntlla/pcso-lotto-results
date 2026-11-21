const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { GAMES, OFFICIAL, iso, normalizeCombination } = require("./feeds");
function validate(dataDir = path.join(__dirname, "../../data")) {
  let total = 0;
  const official = [];
  for (const game of GAMES) {
    const archive = JSON.parse(
      fs.readFileSync(path.join(dataDir, "v2", `results-${game}.json`), "utf8"),
    );
    assert.equal(archive.schemaVersion, 2);
    assert.ok(!isNaN(Date.parse(archive.generatedAt)));
    assert.ok(archive.coverage);
    const keys = new Set();
    for (const d of archive.draws) {
      assert.equal(d.gameId, game);
      assert.equal(iso(d.date), d.date);
      assert.ok(["2PM", "5PM", "9PM"].includes(d.drawTime));
      if (!["2d", "3d"].includes(game)) assert.equal(d.drawTime, "9PM");
      assert.equal(normalizeCombination(game, d.combination), d.combination);
      assert.ok(
        ["LegacyUnverified", "Provisional", "OfficialConfirmed"].includes(
          d.confirmation,
        ),
      );
      assert.ok(
        d.jackpotCentavos === null ||
          (Number.isSafeInteger(d.jackpotCentavos) && d.jackpotCentavos >= 0),
      );
      assert.ok(
        d.winners === null ||
          (Number.isSafeInteger(d.winners) && d.winners >= 0),
      );
      assert.ok(typeof d.sourceUrl === "string" && d.sourceUrl.length);
      assert.ok(d.provider);
      assert.ok(!isNaN(Date.parse(d.observedAt)));
      assert.ok(d.revision);
      const key = d.date + "/" + d.drawTime;
      assert.ok(!keys.has(key), key);
      keys.add(key);
      if (d.confirmation === "OfficialConfirmed") {
        assert.equal(d.sourceUrl, OFFICIAL);
        if (game.endsWith("d")) assert.equal(d.jackpotCentavos, null);
        official.push(d);
      }
    }
    const legacy = JSON.parse(
      fs.readFileSync(
        path.join(
          dataDir,
          game === "3d" ? "results.json" : `results-${game}.json`,
        ),
        "utf8",
      ),
    );
    const dates = new Set();
    for (const row of legacy) {
      assert.equal(iso(row.date), row.date);
      assert.ok(!dates.has(row.date));
      dates.add(row.date);
    }
    for (const d of official.filter((d) => d.gameId === game)) {
      assert.equal(
        legacy.find((row) => row.date === d.date)?.[
          "draw" + d.drawTime.toLowerCase()
        ],
        d.combination,
      );
    }
    total += archive.draws.length;
  }
  const latest = JSON.parse(
    fs.readFileSync(path.join(dataDir, "v2", "latest.json"), "utf8"),
  );
  assert.equal(latest.schemaVersion, 2);
  const today = new Date(Date.parse(latest.generatedAt) + 8 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);
  const first = new Date(Date.parse(today) - 6 * 86400000)
    .toISOString()
    .slice(0, 10);
  for (const d of latest.draws) assert.ok(d.date >= first && d.date <= today);
  console.log(
    `Validated ${total} archive draws, ${official.length} official, ${latest.draws.length} latest, nine legacy feeds`,
  );
  return total;
}
if (require.main === module) validate();
module.exports = { validate };
