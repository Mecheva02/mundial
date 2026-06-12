const state = {
  data: null,
  live: null,
  liveError: null,
  filter: "all",
  stage: "all",
  group: "A",
  autoTimer: null
};

const els = {};

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

const STAGE_POINTS = {
  "Grupos": { sign: 5, exact: 10 },
  "Dieciseisavos": { sign: 10, exact: 15, advance: 25 },
  "Octavos": { sign: 15, exact: 20, advance: 35 },
  "Cuartos": { sign: 20, exact: 25, advance: 45 },
  "Semifinales": { sign: 25, exact: 30, finalAdvance: 55, thirdPlaceAdvance: 40 },
  "Tercer puesto": { sign: 30, exact: 35 },
  "Final": { sign: 40, exact: 50, champion: 70, runnerUp: 50 }
};

const GROUP_POINTS = {
  position: 15,
  qualified: 20
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindElements();
  bindEvents();
  els.tokenInput.value = localStorage.getItem("footballDataToken") || "";
  await loadPredictions();
  refreshLive();
}

function bindElements() {
  [
    "sourceStatus",
    "apiStatus",
    "tokenInput",
    "saveTokenButton",
    "refreshButton",
    "autoRefresh",
    "message",
    "kpiPredictions",
    "kpiFinals",
    "kpiSigns",
    "kpiExact",
    "kpiClassified",
    "stageSelect",
    "matchFilters",
    "matchesList",
    "groupTabs",
    "currentGroupLabel",
    "classificationNote",
    "predictedStandings",
    "realStandings",
    "honorsList",
    "scoreTotal",
    "scoreBreakdown",
    "scoreRows"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  els.saveTokenButton.addEventListener("click", () => {
    localStorage.setItem("footballDataToken", els.tokenInput.value.trim());
    setMessage("Token guardado en este navegador.", "ok");
  });

  els.refreshButton.addEventListener("click", refreshLive);

  els.autoRefresh.addEventListener("change", () => {
    if (state.autoTimer) {
      clearInterval(state.autoTimer);
      state.autoTimer = null;
    }
    if (els.autoRefresh.checked) {
      state.autoTimer = setInterval(refreshLive, 5 * 60 * 1000);
      refreshLive();
    }
  });

  els.stageSelect.addEventListener("change", (event) => {
    state.stage = event.target.value;
    renderMatches();
  });

  els.matchFilters.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-filter]");
    if (!button) return;
    state.filter = button.dataset.filter;
    els.matchFilters.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
    renderMatches();
  });
}

async function loadPredictions() {
  try {
    const response = await fetch("/api/predictions");
    if (!response.ok) throw new Error("No se pudo leer data/predictions.json");
    state.data = await response.json();
    els.sourceStatus.textContent = `${state.data.teams.length} equipos · ${state.data.matches.length} partidos`;
    setMessage("Datos del Excel cargados.", "ok");
    renderSetupControls();
    renderAll();
  } catch (error) {
    setMessage(error.message, "error");
  }
}

async function refreshLive() {
  const token = els.tokenInput.value.trim();
  const headers = token ? { "x-auth-token": token } : {};
  els.refreshButton.disabled = true;
  setMessage("Actualizando resultados reales...", "");

  try {
    const response = await fetch("/api/live?season=2026", { headers });
    const payload = await response.json();
    if (!response.ok) {
      state.live = null;
      state.liveError = payload;
      els.apiStatus.textContent = payload.needsToken ? "Real necesita token" : "Real con error";
      setMessage(payload.message || firstApiError(payload) || "No se pudo actualizar la API real.", "error");
      renderAll();
      return;
    }

    state.live = payload;
    state.liveError = null;
    const finals = payload.matches.filter(isFinalMatch).length;
    const provider = payload.provider === "espn" ? "ESPN" : "Football-Data";
    els.apiStatus.textContent = payload.errors && payload.errors.length ? `${finals} reales · aviso` : `${finals} reales · ${provider}`;
    const warning = payload.errors && payload.errors.length ? ` Aviso: ${firstApiError(payload)}.` : "";
    setMessage(`Real actualizado ${formatDateTime(payload.fetchedAt)}.${warning}`, payload.errors && payload.errors.length ? "" : "ok");
    renderAll();
  } catch (error) {
    state.live = null;
    state.liveError = { message: error.message };
    els.apiStatus.textContent = "Real con error";
    setMessage(error.message, "error");
    renderAll();
  } finally {
    els.refreshButton.disabled = false;
  }
}

function renderSetupControls() {
  const stages = ["all", ...Array.from(new Set(state.data.matches.map((match) => match.stage)))];
  els.stageSelect.innerHTML = stages
    .map((stage) => `<option value="${escapeHtml(stage)}">${stage === "all" ? "Todas las fases" : escapeHtml(stage)}</option>`)
    .join("");

  const groups = Array.from(new Set(state.data.teams.map((team) => team.group))).sort();
  els.groupTabs.innerHTML = groups
    .map((group) => `<button type="button" data-group="${escapeHtml(group)}">${escapeHtml(group)}</button>`)
    .join("");
  els.groupTabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-group]");
    if (!button) return;
    state.group = button.dataset.group;
    renderStandings();
  });
}

function renderAll() {
  if (!state.data) return;
  renderKpis();
  renderScoring();
  renderMatches();
  renderStandings();
  renderHonors();
}

function renderKpis() {
  const comparisons = state.data.matches.map(compareMatch);
  const finalComparisons = comparisons.filter((item) => item.realFinal && item.predicted);
  const exact = finalComparisons.filter((item) => item.exact).length;
  const sign = finalComparisons.filter((item) => item.sign).length;
  const classified = compareAllGroupClassified();

  els.kpiPredictions.textContent = String(state.data.matches.length);
  els.kpiFinals.textContent = `${finalComparisons.length}/${state.data.matches.length}`;
  els.kpiSigns.textContent = finalComparisons.length ? `${sign}/${finalComparisons.length}` : "0/0";
  els.kpiExact.textContent = finalComparisons.length ? `${exact}/${finalComparisons.length}` : "0/0";
  els.kpiClassified.textContent = classified.total ? `${classified.hits}/${classified.total}` : "0/0";
}

function renderScoring() {
  const scoring = calculateScoring();
  els.scoreTotal.textContent = String(scoring.total);
  els.scoreBreakdown.innerHTML = scoring.breakdown.length
    ? scoring.breakdown
        .map(
          (item) => `
            <div class="score-chip">
              <span>${escapeHtml(item.label)}</span>
              <strong>${item.points}</strong>
            </div>
          `
        )
        .join("")
    : `<div class="empty-state compact">Sin puntos reales todavia.</div>`;

  els.scoreRows.innerHTML = scoring.rows.length
    ? scoring.rows.map(renderScoreRow).join("")
    : `<tr><td colspan="5" class="empty-cell">Todavia no hay partidos puntuables.</td></tr>`;
}

function renderScoreRow(row) {
  return `
    <tr class="${row.points > 0 ? "is-points" : ""}">
      <td data-label="Concepto">${escapeHtml(row.concept)}</td>
      <td data-label="Tu porra">${escapeHtml(row.prediction)}</td>
      <td data-label="Real">${escapeHtml(row.real)}</td>
      <td data-label="Detalle">${escapeHtml(row.detail)}</td>
      <td data-label="Pts" class="points-cell">${escapeHtml(row.displayPoints ?? row.points)}</td>
    </tr>
  `;
}

function calculateScoring() {
  const rows = [];
  const totals = new Map();

  const addRow = (row) => {
    rows.push(row);
    totals.set(row.phase, (totals.get(row.phase) || 0) + row.points);
  };

  state.data.matches.forEach((match) => {
    const comparison = compareMatch(match);
    if (!comparison.realFinal && !comparison.realLive) return;

    const scored = scoreMatchResult(match, comparison);
    addRow({
      phase: match.stage,
      concept: `#${match.id} ${match.stage}`,
      prediction: fixtureLabel(match.homeTeam, match.awayTeam, match.homeGoals, match.awayGoals),
      real: comparison.realMatch
        ? fixtureLabel(comparison.realHomeTeam, comparison.realAwayTeam, comparison.realHomeGoals, comparison.realAwayGoals)
        : "-",
      detail: comparison.realLive ? `${scored.detail} · provisional, no suma` : scored.detail,
      points: comparison.realLive ? 0 : scored.points,
      displayPoints: comparison.realLive ? `${scored.points} prov.` : scored.points
    });
  });

  scoreGroupClassification().forEach(addRow);
  scoreKnockoutAdvancers().forEach(addRow);
  scoreFinalHonors().forEach(addRow);

  const breakdown = Array.from(totals.entries())
    .map(([label, points]) => ({ label, points }))
    .filter((item) => item.points !== 0)
    .sort((a, b) => phaseOrder(a.label) - phaseOrder(b.label));

  const total = rows.reduce((sum, row) => sum + row.points, 0);
  return { total, rows, breakdown };
}

function scoreMatchResult(match, comparison) {
  const points = STAGE_POINTS[match.stage] || { sign: 0, exact: 0 };
  if (!comparison.sameFixture) {
    return { points: 0, detail: "Cruce distinto: sin puntos de marcador" };
  }

  const multiplier = match.stage === "Grupos" && isSpainMatch(match) ? 2 : 1;
  const parts = [];
  let total = 0;

  if (comparison.sign) {
    const signPoints = (points.sign || 0) * multiplier;
    total += signPoints;
    parts.push(`1X2 +${signPoints}`);
  }

  if (comparison.exact) {
    const exactPoints = (points.exact || 0) * multiplier;
    total += exactPoints;
    parts.push(`marcador +${exactPoints}`);
  }

  if (multiplier > 1 && total > 0) {
    parts.push("España x2");
  }

  return {
    points: total,
    detail: parts.length ? parts.join(" · ") : "Sin acierto de marcador"
  };
}

function scoreGroupClassification() {
  const rows = [];
  const groups = Array.from(new Set(state.data.teams.map((team) => team.group))).sort();

  groups.forEach((group) => {
    if (!isGroupComplete(group)) return;

    const predicted = predictedStandings(group);
    const real = realStandings(group);
    if (!real.length) return;

    const predictedByTeam = new Map(predicted.map((row) => [canonical(row.team), row]));
    const realTop = real.slice(0, 2).map((row) => canonical(row.team));
    const predictedTop = new Set(predicted.slice(0, 2).map((row) => canonical(row.team)));

    real.forEach((realRow) => {
      const predictedRow = predictedByTeam.get(canonical(realRow.team));
      if (!predictedRow) return;
      const hit = predictedRow.position === realRow.position;
      rows.push({
        phase: "Clasificacion grupos",
        concept: `Grupo ${group} · posicion`,
        prediction: `${stripFlag(predictedRow.team)} ${predictedRow.position}º`,
        real: `${stripFlag(realRow.team)} ${realRow.position}º`,
        detail: hit ? `posicion exacta +${GROUP_POINTS.position}` : "posicion distinta",
        points: hit ? GROUP_POINTS.position : 0
      });
    });

    realTop.forEach((teamKey) => {
      const realTeam = real.find((row) => canonical(row.team) === teamKey);
      const hit = predictedTop.has(teamKey);
      rows.push({
        phase: "Clasificacion grupos",
        concept: `Grupo ${group} · pasa a dieciseisavos`,
        prediction: hit ? stripFlag(realTeam.team) : "No estaba en tu top 2",
        real: stripFlag(realTeam.team),
        detail: hit ? `clasificado +${GROUP_POINTS.qualified}` : "clasificado no acertado",
        points: hit ? GROUP_POINTS.qualified : 0
      });
    });
  });

  return rows;
}

function scoreKnockoutAdvancers() {
  const rows = [];
  ["Dieciseisavos", "Octavos", "Cuartos"].forEach((stage) => {
    const actualAdvancers = actualAdvancersForStage(stage);
    if (!actualAdvancers.size) return;
    const predicted = predictedAdvancersForStage(stage);
    const points = STAGE_POINTS[stage].advance;

    predicted.forEach((team) => {
      const hit = actualAdvancers.has(canonical(team));
      rows.push({
        phase: `${stage} clasificados`,
        concept: `${stage} · pasa ronda`,
        prediction: team,
        real: hit ? team : "No clasificado",
        detail: hit ? `equipo que sigue +${points}` : "no sigue",
        points: hit ? points : 0
      });
    });
  });

  const semifinalActual = actualSemifinalTargets();
  const semifinalPredicted = predictedSemifinalTargets();

  if (semifinalActual.finalists.size) {
    semifinalPredicted.finalists.forEach((team) => {
      const hit = semifinalActual.finalists.has(canonical(team));
      rows.push({
        phase: "Semifinales clasificados",
        concept: "Semifinal · finalista",
        prediction: team,
        real: hit ? team : "No finalista",
        detail: hit ? `final +${STAGE_POINTS.Semifinales.finalAdvance}` : "no llega a la final",
        points: hit ? STAGE_POINTS.Semifinales.finalAdvance : 0
      });
    });
  }

  if (semifinalActual.thirdPlace.size) {
    semifinalPredicted.thirdPlace.forEach((team) => {
      const hit = semifinalActual.thirdPlace.has(canonical(team));
      rows.push({
        phase: "Semifinales clasificados",
        concept: "Semifinal · 3º/4º puesto",
        prediction: team,
        real: hit ? team : "No va al 3º/4º",
        detail: hit ? `3º/4º +${STAGE_POINTS.Semifinales.thirdPlaceAdvance}` : "no cae a 3º/4º",
        points: hit ? STAGE_POINTS.Semifinales.thirdPlaceAdvance : 0
      });
    });
  }

  return rows;
}

function scoreFinalHonors() {
  const finalMatch = state.data.matches.find((match) => match.stage === "Final");
  const comparison = finalMatch ? compareMatch(finalMatch) : null;
  if (!comparison || !comparison.realFinal) return [];

  const actualChampion = actualWinnerName(comparison);
  const actualRunnerUp = actualLoserName(comparison);
  const rows = [];

  [
    ["campeon", state.data.honors.champion, actualChampion, STAGE_POINTS.Final.champion],
    ["subcampeon", state.data.honors.runnerUp, actualRunnerUp, STAGE_POINTS.Final.runnerUp]
  ].forEach(([label, predicted, actual, points]) => {
    const hit = canonical(predicted) === canonical(actual);
    rows.push({
      phase: "Final honores",
      concept: `Final · ${label}`,
      prediction: predicted || "-",
      real: actual || "-",
      detail: hit ? `${label} +${points}` : `${label} no acertado`,
      points: hit ? points : 0
    });
  });

  return rows;
}

function renderMatches() {
  const rows = state.data.matches
    .map((match) => ({ match, comparison: compareMatch(match) }))
    .filter(({ match, comparison }) => state.stage === "all" || match.stage === state.stage)
    .filter(({ comparison }) => filterComparison(comparison));

  if (!rows.length) {
    els.matchesList.innerHTML = `<div class="empty-state">No hay partidos para este filtro.</div>`;
    return;
  }

  els.matchesList.innerHTML = rows.map(renderMatchRow).join("");
}

function renderMatchRow({ match, comparison }) {
  const quality = comparison.quality || "pending";
  const realScore = comparison.realFinal
    ? `${comparison.realHomeGoals}-${comparison.realAwayGoals}`
    : comparison.realMatch
      ? comparison.realMatch.status
      : state.liveError && state.liveError.needsToken
        ? "Falta token"
        : "Sin dato real";
  const realText = comparison.realMatch
    ? `${escapeHtml(comparison.realHomeTeam)} vs ${escapeHtml(comparison.realAwayTeam)}`
    : state.live
      ? "No encontrado en la API"
      : state.liveError && state.liveError.message
        ? state.liveError.message
        : "Conectando API";
  const chips = [];
  if (comparison.exact) chips.push("Marcador exacto");
  if (!comparison.exact && comparison.sign) chips.push("Signo");
  if (comparison.diff && !comparison.exact) chips.push("Diferencia");
  if (comparison.realLive) chips.push("Provisional");
  if (!comparison.realFinal && !comparison.realLive) chips.push("Pendiente");
  if (comparison.realFinal && !comparison.sign) chips.push("Fallo");

  return `
    <article class="match-row" data-quality="${quality}">
      <div>
        <div class="match-meta">
          <span class="pill">#${match.id}</span>
          <span class="pill">${escapeHtml(match.stage)}</span>
          ${match.group ? `<span class="pill">Grupo ${escapeHtml(match.group)}</span>` : ""}
          <span class="pill">${escapeHtml(formatDateTime(match.dateTime))}</span>
        </div>
        <div class="teams-line">
          <span class="${teamHitClass(match, comparison, match.homeTeam)}">${escapeHtml(match.homeTeam)}</span>
          <span class="score">${formatScore(match.homeGoals, match.awayGoals)}</span>
          <span class="team-away ${teamHitClass(match, comparison, match.awayTeam)}">${escapeHtml(match.awayTeam)}</span>
        </div>
      </div>
      <div class="real-box">
        <span class="real-score">Real: ${escapeHtml(realScore)}</span>
        <span>${realText}</span>
        <span>${chips.map((chip) => `<span class="pill">${escapeHtml(chip)}</span>`).join(" ")}</span>
      </div>
    </article>
  `;
}

function renderStandings() {
  const group = state.group;
  els.currentGroupLabel.textContent = group;
  els.groupTabs.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.group === group);
  });

  const predicted = predictedStandings(group);
  const real = realStandings(group);
  const comparison = compareGroupClassified(group, predicted, real);

  els.predictedStandings.innerHTML = renderStandingTable(predicted);
  els.realStandings.innerHTML = real.length ? renderStandingTable(real) : `<div class="empty-state">Sin clasificacion real.</div>`;
  els.classificationNote.textContent = comparison.total
    ? `Top 2 acertado: ${comparison.hits}/${comparison.total}`
    : "Top 2 real pendiente.";
}

function renderStandingTable(rows) {
  if (!rows.length) return `<div class="empty-state">Sin datos.</div>`;
  return `
    <table>
      <thead>
        <tr>
          <th>Pos</th>
          <th>Equipo</th>
          <th>PJ</th>
          <th>PTS</th>
          <th>GF</th>
          <th>GC</th>
          <th>DG</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
          <tr class="${row.position <= 2 ? "is-top" : ""}">
            <td>${row.position}</td>
            <td>${escapeHtml(row.team)}</td>
            <td>${numberOrDash(row.played)}</td>
            <td>${numberOrDash(row.points)}</td>
            <td>${numberOrDash(row.goalsFor)}</td>
            <td>${numberOrDash(row.goalsAgainst)}</td>
            <td>${numberOrDash(row.goalDifference)}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderHonors() {
  const honors = state.data.honors || {};
  const items = [
    ["Campeon", honors.champion],
    ["Subcampeon", honors.runnerUp],
    ["Tercero", honors.third],
    ["Goleadores", (honors.topScorers || []).join(", ")],
    ["Mejores jugadores", (honors.bestPlayers || []).join(", ")]
  ];
  els.honorsList.innerHTML = items
    .map(([label, value]) => `<div class="honor-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "-")}</strong></div>`)
    .join("");
}

function compareMatch(match) {
  const predicted = typeof match.homeGoals === "number" && typeof match.awayGoals === "number";
  const paired = findRealMatch(match);
  if (!paired) {
    return { predicted, realMatch: null, realFinal: false, sameFixture: false, quality: "pending" };
  }

  const { liveMatch, reversed, sameFixture } = paired;
  const realFinal = isFinalMatch(liveMatch);
  const realLive = isLiveMatch(liveMatch);
  const realHomeGoals = reversed ? liveMatch.awayGoals : liveMatch.homeGoals;
  const realAwayGoals = reversed ? liveMatch.homeGoals : liveMatch.awayGoals;
  const realHomeTeam = reversed ? liveMatch.awayTeam : liveMatch.homeTeam;
  const realAwayTeam = reversed ? liveMatch.homeTeam : liveMatch.awayTeam;

  if ((!realFinal && !realLive) || !predicted) {
    return {
      predicted,
      realMatch: liveMatch,
      realFinal,
      realLive,
      realHomeTeam,
      realAwayTeam,
      realHomeGoals,
      realAwayGoals,
      sameFixture,
      quality: "pending"
    };
  }

  const exact = sameFixture && match.homeGoals === realHomeGoals && match.awayGoals === realAwayGoals;
  const sign = sameFixture && outcome(match.homeGoals, match.awayGoals) === outcome(realHomeGoals, realAwayGoals);
  const diff = sameFixture && match.homeGoals - match.awayGoals === realHomeGoals - realAwayGoals;

  return {
    predicted,
    realMatch: liveMatch,
    realFinal,
    realLive,
    realHomeTeam,
    realAwayTeam,
    realHomeGoals,
    realAwayGoals,
    sameFixture,
    exact,
    sign,
    diff,
    quality: exact ? "exact" : sign ? "sign" : realFinal ? "miss" : realLive ? "pending" : "pending"
  };
}

function findRealMatch(match) {
  if (!state.live || !Array.isArray(state.live.matches)) return null;
  const home = canonical(match.homeTeam);
  const away = canonical(match.awayTeam);

  for (const liveMatch of state.live.matches) {
    const liveHome = canonical(liveMatch.homeTeam);
    const liveAway = canonical(liveMatch.awayTeam);
    if (liveHome === home && liveAway === away) {
      return { liveMatch, reversed: false, sameFixture: true };
    }
    if (liveHome === away && liveAway === home) {
      return { liveMatch, reversed: true, sameFixture: true };
    }
  }

  if (match.stage !== "Grupos") {
    const predictedTime = new Date(match.dateTime).getTime();
    if (!Number.isNaN(predictedTime)) {
      const candidates = state.live.matches
        .map((liveMatch) => ({ liveMatch, diff: Math.abs(new Date(liveMatch.utcDate).getTime() - predictedTime) }))
        .filter((item) => Number.isFinite(item.diff) && item.diff <= 2 * 60 * 60 * 1000)
        .sort((a, b) => a.diff - b.diff);
      if (candidates.length) {
        return { liveMatch: candidates[0].liveMatch, reversed: false, sameFixture: false };
      }
    }
  }
  return null;
}

function teamHitClass(match, comparison, teamName) {
  if (match.stage === "Grupos" || !comparison.realMatch) return "";
  const team = canonical(teamName);
  const realTeams = new Set([canonical(comparison.realHomeTeam), canonical(comparison.realAwayTeam)]);
  return realTeams.has(team) ? "team-hit" : "";
}

function fixtureLabel(homeTeam, awayTeam, homeGoals, awayGoals) {
  return `${homeTeam} ${formatScore(homeGoals, awayGoals)} ${awayTeam}`;
}

function isSpainMatch(match) {
  return canonical(match.homeTeam) === "espana" || canonical(match.awayTeam) === "espana";
}

function stripFlag(value) {
  return String(value || "").replace(/^[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+/u, "").trim();
}

function phaseOrder(phase) {
  const order = [
    "Grupos",
    "Clasificacion grupos",
    "Dieciseisavos",
    "Dieciseisavos clasificados",
    "Octavos",
    "Octavos clasificados",
    "Cuartos",
    "Cuartos clasificados",
    "Semifinales",
    "Semifinales clasificados",
    "Tercer puesto",
    "Final",
    "Final honores"
  ];
  const index = order.indexOf(phase);
  return index === -1 ? 999 : index;
}

function isGroupComplete(group) {
  const matches = state.data.matches.filter((match) => match.stage === "Grupos" && match.group === group);
  return matches.length > 0 && matches.every((match) => compareMatch(match).realFinal);
}

function uniqueTeamNames(names) {
  const seen = new Set();
  const result = [];
  names.filter(Boolean).forEach((name) => {
    const key = canonical(name);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(name);
  });
  return result;
}

function predictedAdvancersForStage(stage) {
  return uniqueTeamNames(
    state.data.matches
      .filter((match) => match.stage === stage)
      .map(predictedWinnerName)
  );
}

function actualAdvancersForStage(stage) {
  const names = state.data.matches
    .filter((match) => match.stage === stage)
    .map((match) => {
      const comparison = compareMatch(match);
      return comparison.realFinal ? actualWinnerName(comparison) : null;
    });
  return new Set(uniqueTeamNames(names).map(canonical));
}

function predictedSemifinalTargets() {
  const semifinals = state.data.matches.filter((match) => match.stage === "Semifinales");
  return {
    finalists: uniqueTeamNames(semifinals.map(predictedWinnerName)),
    thirdPlace: uniqueTeamNames(semifinals.map(predictedLoserName))
  };
}

function actualSemifinalTargets() {
  const semifinals = state.data.matches.filter((match) => match.stage === "Semifinales");
  const finalists = [];
  const thirdPlace = [];
  semifinals.forEach((match) => {
    const comparison = compareMatch(match);
    if (!comparison.realFinal) return;
    finalists.push(actualWinnerName(comparison));
    thirdPlace.push(actualLoserName(comparison));
  });
  return {
    finalists: new Set(uniqueTeamNames(finalists).map(canonical)),
    thirdPlace: new Set(uniqueTeamNames(thirdPlace).map(canonical))
  };
}

function predictedWinnerName(match) {
  if (match.homeGoals > match.awayGoals) return match.homeTeam;
  if (match.homeGoals < match.awayGoals) return match.awayTeam;
  if (match.stage === "Final" && state.data.honors && state.data.honors.champion) return state.data.honors.champion;

  const home = canonical(match.homeTeam);
  const away = canonical(match.awayTeam);
  const laterMatch = state.data.matches
    .filter((candidate) => candidate.id > match.id)
    .find((candidate) => {
      const teams = [canonical(candidate.homeTeam), canonical(candidate.awayTeam)];
      return teams.includes(home) || teams.includes(away);
    });

  if (!laterMatch) return match.homeTeam;
  const laterTeams = [canonical(laterMatch.homeTeam), canonical(laterMatch.awayTeam)];
  if (laterTeams.includes(home)) return match.homeTeam;
  if (laterTeams.includes(away)) return match.awayTeam;
  return match.homeTeam;
}

function predictedLoserName(match) {
  const winner = canonical(predictedWinnerName(match));
  return canonical(match.homeTeam) === winner ? match.awayTeam : match.homeTeam;
}

function actualWinnerName(comparison) {
  if (!comparison || !comparison.realMatch) return null;
  if (comparison.realHomeGoals > comparison.realAwayGoals) return comparison.realHomeTeam;
  if (comparison.realHomeGoals < comparison.realAwayGoals) return comparison.realAwayTeam;
  if (comparison.realMatch.homeAdvance || comparison.realMatch.winner === "HOME_TEAM") return comparison.realMatch.homeTeam;
  if (comparison.realMatch.awayAdvance || comparison.realMatch.winner === "AWAY_TEAM") return comparison.realMatch.awayTeam;
  return null;
}

function actualLoserName(comparison) {
  const winner = canonical(actualWinnerName(comparison));
  if (!winner) return null;
  const teams = [comparison.realHomeTeam, comparison.realAwayTeam];
  return teams.find((team) => canonical(team) !== winner) || null;
}

function predictedStandings(group) {
  const teams = state.data.teams.filter((team) => team.group === group);
  const table = new Map(
    teams.map((team) => [
      canonical(team.name),
      {
        position: 0,
        team: `${team.flag ? `${team.flag} ` : ""}${team.name}`,
        sortName: team.name,
        played: 0,
        won: 0,
        draw: 0,
        lost: 0,
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0
      }
    ])
  );

  state.data.matches
    .filter((match) => match.stage === "Grupos" && match.group === group)
    .forEach((match) => {
      if (typeof match.homeGoals !== "number" || typeof match.awayGoals !== "number") return;
      const home = table.get(canonical(match.homeTeam));
      const away = table.get(canonical(match.awayTeam));
      if (!home || !away) return;
      applyStandingResult(home, away, match.homeGoals, match.awayGoals);
    });

  return rankRows(Array.from(table.values()));
}

function realStandings(group) {
  const apiStanding = state.live && state.live.standings
    ? state.live.standings.find((item) => item.group === group && Array.isArray(item.table) && item.table.length)
    : null;

  if (apiStanding) {
    return apiStanding.table.map((row, index) => ({
      position: row.position || index + 1,
      team: row.team || row.shortName || "-",
      played: row.played,
      won: row.won,
      draw: row.draw,
      lost: row.lost,
      points: row.points,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      goalDifference: row.goalDifference
    }));
  }

  return computedRealStandings(group);
}

function computedRealStandings(group) {
  if (!state.live || !Array.isArray(state.live.matches)) return [];
  const groupMatches = state.live.matches.filter((match) => match.group === group && isFinalMatch(match));
  if (!groupMatches.length) return [];

  const table = new Map();
  groupMatches.forEach((match) => {
    [match.homeTeam, match.awayTeam].forEach((team) => {
      const key = canonical(team);
      if (!table.has(key)) {
        table.set(key, {
          position: 0,
          team,
          sortName: team,
          played: 0,
          won: 0,
          draw: 0,
          lost: 0,
          points: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0
        });
      }
    });
    applyStandingResult(
      table.get(canonical(match.homeTeam)),
      table.get(canonical(match.awayTeam)),
      match.homeGoals,
      match.awayGoals
    );
  });

  return rankRows(Array.from(table.values()));
}

function applyStandingResult(home, away, homeGoals, awayGoals) {
  home.played += 1;
  away.played += 1;
  home.goalsFor += homeGoals;
  home.goalsAgainst += awayGoals;
  away.goalsFor += awayGoals;
  away.goalsAgainst += homeGoals;

  if (homeGoals > awayGoals) {
    home.won += 1;
    away.lost += 1;
    home.points += 3;
  } else if (homeGoals < awayGoals) {
    away.won += 1;
    home.lost += 1;
    away.points += 3;
  } else {
    home.draw += 1;
    away.draw += 1;
    home.points += 1;
    away.points += 1;
  }

  home.goalDifference = home.goalsFor - home.goalsAgainst;
  away.goalDifference = away.goalsFor - away.goalsAgainst;
}

function rankRows(rows) {
  return rows
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.sortName.localeCompare(b.sortName, "es");
    })
    .map((row, index) => ({ ...row, position: index + 1 }));
}

function compareAllGroupClassified() {
  const groups = Array.from(new Set(state.data.teams.map((team) => team.group)));
  return groups.reduce(
    (acc, group) => {
      const result = compareGroupClassified(group, predictedStandings(group), realStandings(group));
      acc.hits += result.hits;
      acc.total += result.total;
      return acc;
    },
    { hits: 0, total: 0 }
  );
}

function compareGroupClassified(group, predicted = predictedStandings(group), real = realStandings(group)) {
  if (!isGroupComplete(group)) return { hits: 0, total: 0 };
  if (!real.length) return { hits: 0, total: 0 };
  const predictedTop = new Set(predicted.slice(0, 2).map((row) => canonical(row.team)));
  const realTop = real.slice(0, 2).map((row) => canonical(row.team));
  return {
    hits: realTop.filter((team) => predictedTop.has(team)).length,
    total: Math.min(2, realTop.length)
  };
}

function filterComparison(comparison) {
  if (state.filter === "all") return true;
  if (state.filter === "exact") return comparison.exact;
  if (state.filter === "sign") return comparison.sign && !comparison.exact;
  if (state.filter === "miss") return comparison.realFinal && !comparison.sign;
  if (state.filter === "pending") return !comparison.realFinal;
  return true;
}

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

function outcome(homeGoals, awayGoals) {
  if (homeGoals > awayGoals) return "H";
  if (homeGoals < awayGoals) return "A";
  return "D";
}

function isFinalMatch(match) {
  return (
    match &&
    (match.status === "FINISHED" || match.status === "AWARDED") &&
    typeof match.homeGoals === "number" &&
    typeof match.awayGoals === "number"
  );
}

function isLiveMatch(match) {
  return (
    match &&
    match.status === "IN_PLAY" &&
    typeof match.homeGoals === "number" &&
    typeof match.awayGoals === "number"
  );
}

function formatScore(home, away) {
  return typeof home === "number" && typeof away === "number" ? `${home}-${away}` : "-";
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function numberOrDash(value) {
  return typeof value === "number" ? String(value) : "-";
}

function firstApiError(payload) {
  return payload && payload.errors && payload.errors[0] ? payload.errors[0].message : "";
}

function setMessage(text, type) {
  els.message.textContent = text || "";
  els.message.classList.toggle("is-error", type === "error");
  els.message.classList.toggle("is-ok", type === "ok");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
