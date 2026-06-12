const fs = require("fs/promises");
const path = require("path");

const ESPN_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

const aliases = {
  "south africa": "sudafrica",
  "sudafrica": "sudafrica",
  "south korea": "corea del sur",
  "korea republic": "corea del sur",
  "corea del sur": "corea del sur",
  "czechia": "republica checa",
  "czech republic": "republica checa",
  "republica checa": "republica checa",
  "bosnia herzegovina": "bosnia y herzegovina",
  "bosnia and herzegovina": "bosnia y herzegovina",
  "bosnia-herzegovina": "bosnia y herzegovina",
  "qatar": "catar",
  "catar": "catar",
  "switzerland": "suiza",
  "suiza": "suiza",
  "morocco": "marruecos",
  "marruecos": "marruecos",
  "united states": "estados unidos",
  "usa": "estados unidos",
  "turkiye": "turquia",
  "turkey": "turquia",
  "germany": "alemania",
  "netherlands": "paises bajos",
  "japan": "japon",
  "tunisia": "tunez",
  "belgium": "belgica",
  "egypt": "egipto",
  "new zealand": "nueva zelanda",
  "spain": "espana",
  "cape verde islands": "cabo verde",
  "cape verde": "cabo verde",
  "saudi arabia": "arabia saudita",
  "france": "francia",
  "iraq": "irak",
  "norway": "noruega",
  "algeria": "argelia",
  "jordan": "jordania",
  "dr congo": "rd congo",
  "congo dr": "rd congo",
  "democratic republic of congo": "rd congo",
  "england": "inglaterra",
  "croatia": "croacia",
  "sweden": "suecia",
  "brazil": "brasil",
  "curacao": "curazao",
  "ivory coast": "costa de marfil",
  "cote d ivoire": "costa de marfil",
  "mexico": "mexico",
  "canada": "canada",
  "paraguay": "paraguay",
  "australia": "australia",
  "argentina": "argentina",
  "portugal": "portugal",
  "colombia": "colombia",
  "ghana": "ghana",
  "panama": "panama",
  "haiti": "haiti",
  "senegal": "senegal",
  "ecuador": "ecuador",
  "iran": "iran",
  "uzbekistan": "uzbekistan",
  "austria": "austria",
  "scotland": "escocia"
};

function canonical(name) {
  if (!name) return "";
  let text = String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return aliases[text] || text;
}

function pairKey(homeTeam, awayTeam) {
  return `${canonical(homeTeam)}|${canonical(awayTeam)}`;
}

function dateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

function relevantDates(matches) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return Array.from(
    new Set(
      matches
        .filter((match) => {
          const date = new Date(match.dateTime);
          return Number.isNaN(date.getTime()) || date <= tomorrow;
        })
        .map((match) => dateKey(match.dateTime))
        .filter(Boolean)
    )
  ).sort();
}

function buildPredictionIndex(predictions) {
  const index = new Map();
  for (const match of predictions.matches || []) {
    index.set(pairKey(match.homeTeam, match.awayTeam), match);
    index.set(pairKey(match.awayTeam, match.homeTeam), match);
  }
  return index;
}

function normalizeGroup(group) {
  if (!group) return null;
  const text = String(group).toUpperCase();
  const match = text.match(/(?:GROUP[_\s-]?)([A-L])/);
  return match ? match[1] : group;
}

function parseScore(score) {
  const value = Number(score);
  return Number.isFinite(value) ? value : null;
}

function normalizeEvent(event, predictionIndex) {
  const competition = Array.isArray(event.competitions) ? event.competitions[0] : null;
  const competitors = competition && Array.isArray(competition.competitors) ? competition.competitors : [];
  const home = competitors.find((item) => item.homeAway === "home") || competitors[0];
  const away = competitors.find((item) => item.homeAway === "away") || competitors[1];
  if (!home || !away) return null;

  const status = (competition && competition.status) || event.status || {};
  const statusType = status.type || {};
  const state = statusType.state || "";
  const completed = Boolean(statusType.completed);
  const homeName = home.team ? home.team.displayName || home.team.name || home.team.shortDisplayName : null;
  const awayName = away.team ? away.team.displayName || away.team.name || away.team.shortDisplayName : null;
  const prediction = predictionIndex.get(pairKey(homeName, awayName));

  return {
    id: Number(event.id) || event.id,
    providerId: event.id,
    predictionId: prediction ? prediction.id : null,
    utcDate: (competition && competition.date) || event.date || null,
    status: completed ? "FINISHED" : state === "in" ? "IN_PLAY" : "SCHEDULED",
    rawStatus: statusType.shortDetail || statusType.detail || statusType.description || null,
    minute: status.displayClock || null,
    stage: prediction ? prediction.stage : null,
    group: prediction ? prediction.group : normalizeGroup(event.group),
    matchday: prediction ? prediction.matchday : null,
    homeTeam: homeName,
    awayTeam: awayName,
    homeShort: home.team ? home.team.abbreviation || home.team.shortDisplayName : null,
    awayShort: away.team ? away.team.abbreviation || away.team.shortDisplayName : null,
    homeGoals: completed || state === "in" ? parseScore(home.score) : null,
    awayGoals: completed || state === "in" ? parseScore(away.score) : null,
    winner: home.winner ? "HOME_TEAM" : away.winner ? "AWAY_TEAM" : "DRAW",
    homeAdvance: Boolean(home.advance),
    awayAdvance: Boolean(away.advance),
    lastUpdated: null
  };
}

async function fetchScoreboard(date) {
  const response = await fetch(`${ESPN_SCOREBOARD}?dates=${encodeURIComponent(date)}`, {
    headers: { accept: "application/json" }
  });
  if (!response.ok) throw new Error(`ESPN ${date}: ${response.status}`);
  return response.json();
}

module.exports = async function handler(req, res) {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "data", "predictions.json"), "utf8");
    const predictions = JSON.parse(raw);
    const predictionIndex = buildPredictionIndex(predictions);
    const dates = relevantDates(predictions.matches || []);
    const settled = await Promise.allSettled(dates.map(fetchScoreboard));
    const errors = [];
    const matches = [];

    settled.forEach((result, index) => {
      if (result.status === "rejected") {
        errors.push({ resource: `scoreboard:${dates[index]}`, message: result.reason.message });
        return;
      }
      for (const event of Array.isArray(result.value.events) ? result.value.events : []) {
        const normalized = normalizeEvent(event, predictionIndex);
        if (normalized) matches.push(normalized);
      }
    });

    const deduped = Array.from(new Map(matches.map((match) => [String(match.providerId), match])).values());
    res.setHeader("cache-control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).json({
      provider: "espn",
      competition: "fifa.world",
      season: "2026",
      fetchedAt: new Date().toISOString(),
      resultSet: { count: deduped.length, first: dates[0] || null, last: dates[dates.length - 1] || null },
      matches: deduped,
      standings: [],
      errors
    });
  } catch (error) {
    res.status(500).json({ provider: "espn", error: error.message || "No se pudo consultar ESPN" });
  }
};
