const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { URL } = require("url");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_FILE = path.join(ROOT, "data", "predictions.json");
const DEFAULT_PORT = Number(process.env.PORT || 4173);
const API_BASE = "https://api.football-data.org/v4";
const ESPN_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

const aliases = {
  "south africa": "sudafrica",
  "sudafrica": "sudafrica",
  "korea republic": "corea del sur",
  "south korea": "corea del sur",
  "corea del sur": "corea del sur",
  "czechia": "republica checa",
  "czech republic": "republica checa",
  "republica checa": "republica checa",
  "bosnia herzegovina": "bosnia y herzegovina",
  "bosnia and herzegovina": "bosnia y herzegovina",
  "bosnia y herzegovina": "bosnia y herzegovina",
  "qatar": "catar",
  "catar": "catar",
  "switzerland": "suiza",
  "suiza": "suiza",
  "morocco": "marruecos",
  "marruecos": "marruecos",
  "scotland": "escocia",
  "escocia": "escocia",
  "united states": "estados unidos",
  "united states of america": "estados unidos",
  "usa": "estados unidos",
  "estados unidos": "estados unidos",
  "turkiye": "turquia",
  "turkey": "turquia",
  "turquia": "turquia",
  "germany": "alemania",
  "alemania": "alemania",
  "cote d ivoire": "costa de marfil",
  "ivory coast": "costa de marfil",
  "costa de marfil": "costa de marfil",
  "netherlands": "paises bajos",
  "paises bajos": "paises bajos",
  "japan": "japon",
  "japon": "japon",
  "tunisia": "tunez",
  "tunez": "tunez",
  "belgium": "belgica",
  "belgica": "belgica",
  "egypt": "egipto",
  "egipto": "egipto",
  "new zealand": "nueva zelanda",
  "nueva zelanda": "nueva zelanda",
  "spain": "espana",
  "espana": "espana",
  "cape verde islands": "cabo verde",
  "cape verde": "cabo verde",
  "cabo verde": "cabo verde",
  "saudi arabia": "arabia saudita",
  "arabia saudita": "arabia saudita",
  "france": "francia",
  "francia": "francia",
  "iraq": "irak",
  "irak": "irak",
  "norway": "noruega",
  "noruega": "noruega",
  "argentina": "argentina",
  "algeria": "argelia",
  "argelia": "argelia",
  "austria": "austria",
  "jordan": "jordania",
  "jordania": "jordania",
  "portugal": "portugal",
  "dr congo": "rd congo",
  "congo dr": "rd congo",
  "democratic republic of congo": "rd congo",
  "rd congo": "rd congo",
  "uzbekistan": "uzbekistan",
  "colombia": "colombia",
  "england": "inglaterra",
  "inglaterra": "inglaterra",
  "croatia": "croacia",
  "croacia": "croacia",
  "ghana": "ghana",
  "panama": "panama",
  "mexico": "mexico",
  "brasil": "brasil",
  "brazil": "brasil",
  "haiti": "haiti",
  "ecuador": "ecuador",
  "senegal": "senegal",
  "iran": "iran",
  "curacao": "curazao",
  "curazao": "curazao",
  "australia": "australia",
  "paraguay": "paraguay",
  "canada": "canada",
  "suecia": "suecia",
  "sweden": "suecia"
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

let liveCache = null;

function canonical(name) {
  if (!name) return "";
  let text = String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(fc|cf|national team|association football team)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  text = text.replace(/\s+/g, " ");
  return aliases[text] || text;
}

function pairKey(homeTeam, awayTeam) {
  return `${canonical(homeTeam)}|${canonical(awayTeam)}`;
}

function buildPredictionIndex(predictions) {
  const index = new Map();
  for (const match of predictions.matches || []) {
    index.set(pairKey(match.homeTeam, match.awayTeam), { match, reversed: false });
    index.set(pairKey(match.awayTeam, match.homeTeam), { match, reversed: true });
  }
  return index;
}

function dateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function parseScore(score) {
  const value = Number(score);
  return Number.isFinite(value) ? value : null;
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(payload);
}

function sendText(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "content-type": contentType });
  res.end(body);
}

function normalizeGroup(group) {
  if (!group) return null;
  const text = String(group).toUpperCase();
  const match = text.match(/(?:GROUP[_\s-]?)([A-L])/);
  return match ? match[1] : group;
}

function normalizeMatch(match) {
  const fullTime = match.score && match.score.fullTime ? match.score.fullTime : {};
  return {
    id: match.id,
    utcDate: match.utcDate,
    status: match.status,
    minute: match.minute,
    stage: match.stage || null,
    group: normalizeGroup(match.group),
    matchday: match.matchday || null,
    homeTeam: match.homeTeam ? match.homeTeam.name : null,
    awayTeam: match.awayTeam ? match.awayTeam.name : null,
    homeShort: match.homeTeam ? match.homeTeam.shortName : null,
    awayShort: match.awayTeam ? match.awayTeam.shortName : null,
    homeGoals: typeof fullTime.home === "number" ? fullTime.home : null,
    awayGoals: typeof fullTime.away === "number" ? fullTime.away : null,
    winner: match.score ? match.score.winner : null,
    lastUpdated: match.lastUpdated || null
  };
}

function normalizeStanding(standing) {
  return {
    stage: standing.stage || null,
    type: standing.type || null,
    group: normalizeGroup(standing.group),
    table: Array.isArray(standing.table)
      ? standing.table.map((row) => ({
          position: row.position,
          team: row.team ? row.team.name : null,
          shortName: row.team ? row.team.shortName : null,
          played: row.playedGames,
          won: row.won,
          draw: row.draw,
          lost: row.lost,
          points: row.points,
          goalsFor: row.goalsFor,
          goalsAgainst: row.goalsAgainst,
          goalDifference: row.goalDifference
        }))
      : []
  };
}

function normalizeEspnEvent(event, predictionIndex) {
  const competition = Array.isArray(event.competitions) ? event.competitions[0] : null;
  const competitors = competition && Array.isArray(competition.competitors) ? competition.competitors : [];
  const home = competitors.find((item) => item.homeAway === "home") || competitors[0];
  const away = competitors.find((item) => item.homeAway === "away") || competitors[1];
  if (!home || !away) return null;

  const status = (competition && competition.status) || event.status || {};
  const statusType = status.type || {};
  const completed = Boolean(statusType.completed);
  const state = statusType.state || "";
  const apiStatus = completed ? "FINISHED" : state === "in" ? "IN_PLAY" : "SCHEDULED";
  const homeName = home.team ? home.team.displayName || home.team.name || home.team.shortDisplayName : null;
  const awayName = away.team ? away.team.displayName || away.team.name || away.team.shortDisplayName : null;
  const prediction = predictionIndex.get(pairKey(homeName, awayName));

  return {
    id: Number(event.id) || event.id,
    providerId: event.id,
    predictionId: prediction ? prediction.match.id : null,
    utcDate: (competition && competition.date) || event.date || null,
    status: apiStatus,
    rawStatus: statusType.shortDetail || statusType.detail || statusType.description || null,
    minute: status.displayClock || null,
    stage: prediction ? prediction.match.stage : null,
    group: prediction ? prediction.match.group : null,
    matchday: prediction ? prediction.match.matchday : null,
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

async function espnGetScoreboard(date) {
  const response = await fetch(`${ESPN_SCOREBOARD}?dates=${encodeURIComponent(date)}`, {
    headers: { accept: "application/json" }
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const error = new Error(response.statusText);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

async function getEspnData(predictions) {
  const predictionIndex = buildPredictionIndex(predictions);
  const dates = Array.from(
    new Set((predictions.matches || []).map((match) => dateKey(match.dateTime)).filter(Boolean))
  ).sort();
  const results = [];
  const errors = [];

  for (const date of dates) {
    try {
      const data = await espnGetScoreboard(date);
      for (const event of data && Array.isArray(data.events) ? data.events : []) {
        const normalized = normalizeEspnEvent(event, predictionIndex);
        if (normalized) results.push(normalized);
      }
    } catch (error) {
      errors.push({
        resource: `scoreboard:${date}`,
        status: error.status || 500,
        message: error.message || "No se pudo consultar ESPN"
      });
    }
  }

  const deduped = Array.from(new Map(results.map((match) => [String(match.providerId), match])).values());
  return {
    provider: "espn",
    competition: "fifa.world",
    season: "2026",
    fetchedAt: new Date().toISOString(),
    resultSet: {
      count: deduped.length,
      first: dates[0] || null,
      last: dates[dates.length - 1] || null
    },
    matches: deduped,
    standings: [],
    errors
  };
}

async function footballDataGet(route, token) {
  const response = await fetch(`${API_BASE}${route}`, {
    headers: {
      "X-Auth-Token": token,
      "accept": "application/json"
    }
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const message = data && (data.message || data.error) ? data.message || data.error : response.statusText;
    const error = new Error(message);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

async function getLiveData(reqUrl, req) {
  const season = reqUrl.searchParams.get("season") || "2026";
  const requestedProvider = reqUrl.searchParams.get("provider") || "espn";
  const token = req.headers["x-auth-token"] || process.env.FOOTBALL_DATA_TOKEN || process.env.FOOTBALLDATA_TOKEN;
  const predictions = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));

  if (requestedProvider !== "football-data") {
    const cacheKey = `espn:fifa.world:${season}`;
    const now = Date.now();
    if (liveCache && liveCache.key === cacheKey && liveCache.expiresAt > now) {
      return { status: 200, body: { ...liveCache.value, cached: true } };
    }

    const body = await getEspnData(predictions);
    liveCache = {
      key: cacheKey,
      expiresAt: now + 90 * 1000,
      value: body
    };
    return { status: 200, body };
  }

  if (!token) {
    return {
      status: 428,
      body: {
        provider: "football-data",
        season,
        needsToken: true,
        message: "Falta token de Football-Data. Pegalo en la app o define FOOTBALL_DATA_TOKEN."
      }
    };
  }

  const cacheKey = `football-data:WC:${season}`;
  const now = Date.now();
  if (liveCache && liveCache.key === cacheKey && liveCache.expiresAt > now) {
    return { status: 200, body: { ...liveCache.value, cached: true } };
  }

  const routes = [
    ["matches", `/competitions/WC/matches?season=${encodeURIComponent(season)}`],
    ["standings", `/competitions/WC/standings?season=${encodeURIComponent(season)}`]
  ];

  const results = await Promise.allSettled(routes.map(([, route]) => footballDataGet(route, token)));
  const errors = [];
  const matchesData = results[0].status === "fulfilled" ? results[0].value : null;
  const standingsData = results[1].status === "fulfilled" ? results[1].value : null;

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      errors.push({
        resource: routes[index][0],
        status: result.reason.status || 500,
        message: result.reason.message || "No se pudo consultar la API"
      });
    }
  });

  if (!matchesData && !standingsData) {
    return {
      status: errors[0] && errors[0].status ? errors[0].status : 502,
      body: { provider: "football-data", season, errors }
    };
  }

  const body = {
    provider: "football-data",
    competition: "WC",
    season,
    fetchedAt: new Date().toISOString(),
    resultSet: matchesData ? matchesData.resultSet : null,
    matches: matchesData && Array.isArray(matchesData.matches) ? matchesData.matches.map(normalizeMatch) : [],
    standings:
      standingsData && Array.isArray(standingsData.standings)
        ? standingsData.standings.map(normalizeStanding)
        : [],
    errors
  };

  liveCache = {
    key: cacheKey,
    expiresAt: now + 90 * 1000,
    value: body
  };

  return { status: 200, body };
}

async function serveStatic(reqUrl, res) {
  const requestedPath = reqUrl.pathname === "/" ? "/index.html" : decodeURIComponent(reqUrl.pathname);
  const resolved = path.resolve(PUBLIC_DIR, `.${requestedPath}`);

  if (!resolved.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const body = await fs.readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, {
      "content-type": mimeTypes[ext] || "application/octet-stream",
      "cache-control": "no-cache"
    });
    res.end(body);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendText(res, 404, "Not found");
      return;
    }
    sendText(res, 500, "Server error");
  }
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  try {
    if (req.method === "GET" && reqUrl.pathname === "/api/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && reqUrl.pathname === "/api/predictions") {
      const raw = await fs.readFile(DATA_FILE, "utf8");
      sendJson(res, 200, JSON.parse(raw));
      return;
    }

    if (req.method === "GET" && reqUrl.pathname === "/api/live") {
      const result = await getLiveData(reqUrl, req);
      sendJson(res, result.status, result.body);
      return;
    }

    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    await serveStatic(reqUrl, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
});

function listen(port) {
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE" && port < DEFAULT_PORT + 20) {
      listen(port + 1);
      return;
    }
    throw error;
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`Mundial porra local: http://127.0.0.1:${port}`);
  });
}

listen(DEFAULT_PORT);
