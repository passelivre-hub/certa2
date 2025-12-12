// main.js (CERTA - FCEE)

let map;
let geoLayer;
let tipoChart;
let regiaoChart;

const COLOR_GRAY = '#CBD5E1';
const COLOR_RED = '#DC2626';
const BORDER = '#475569';

function initCharts(aggs) {
  const tipoCtx = document.getElementById('tipoChart');
  const regCtx = document.getElementById('regiaoChart');

  const tipoLabels = ['Serviços', 'Recursos de TA', 'Open Day'];
  const tipoValues = [
    aggs.totalsByType.servicos,
    aggs.totalsByType.recursosTA,
    aggs.totalsByType.openDay,
  ];

  if (tipoChart) tipoChart.destroy();
  tipoChart = new Chart(tipoCtx, {
    type: 'bar',
    data: {
      labels: tipoLabels,
      datasets: [{
        label: 'Quantidade',
        data: tipoValues,
        backgroundColor: ['#1E6FD6', '#F08C00', '#0F3B73'],
        borderRadius: 10,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y.toLocaleString('pt-BR')}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
        },
      },
    },
  });

  const regLabels = REGIOES.slice();
  const regValues = regLabels.map((r) => aggs.totalsByRegiao[r] ?? 0);

  if (regiaoChart) regiaoChart.destroy();
  regiaoChart = new Chart(regCtx, {
    type: 'bar',
    data: {
      labels: regLabels,
      datasets: [{
        label: 'Quantidade',
        data: regValues,
        backgroundColor: '#175AA6',
        borderRadius: 10,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y.toLocaleString('pt-BR')}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
        },
      },
    },
  });
}

function buildPopupHtml(muniName, muniInfo, totals) {
  const lines = [];
  lines.push(`<div style="min-width:260px">`);
  lines.push(`<div style="font-weight:900;font-size:1.05rem;margin-bottom:0.2rem">${escapeHtml(muniName)}</div>`);
  if (muniInfo?.regiao) {
    lines.push(`<div style="color:#6B7A8A;font-weight:700;margin-bottom:0.5rem">${escapeHtml(muniInfo.regiao)}</div>`);
  }

  const total = totals?.total ?? 0;
  if (total === 0) {
    lines.push(`<div style="color:#6B7A8A">Nenhuma assessoria registrada.</div>`);
    lines.push(`</div>`);
    return lines.join('');
  }

  lines.push(`<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.6rem">`);
  lines.push(`<span style="background:rgba(30,111,214,0.12);border:1px solid rgba(30,111,214,0.18);padding:0.2rem 0.45rem;border-radius:999px;font-weight:900;color:#0B2E59">Serviços: ${totals.servicos}</span>`);
  lines.push(`<span style="background:rgba(240,140,0,0.14);border:1px solid rgba(240,140,0,0.22);padding:0.2rem 0.45rem;border-radius:999px;font-weight:900;color:#7C2D12">TA: ${totals.recursosTA}</span>`);
  lines.push(`<span style="background:rgba(220,38,38,0.10);border:1px solid rgba(220,38,38,0.22);padding:0.2rem 0.45rem;border-radius:999px;font-weight:900;color:#7F1D1D">Open Day: ${totals.openDay}</span>`);
  lines.push(`</div>`);

  const instList = (muniInfo?.institutions ?? []).filter((i) => (i.servicos + i.recursosTA + i.openDay) > 0 || (i.nome ?? '').trim().length > 0);

  if (!instList.length) {
    lines.push(`<div style="color:#6B7A8A">Sem instituições detalhadas para este município.</div>`);
    lines.push(`</div>`);
    return lines.join('');
  }

  lines.push(`<div style="font-weight:900;margin-bottom:0.35rem">Instituições</div>`);
  lines.push(`<div style="display:grid;gap:0.45rem">`);

  instList.forEach((inst) => {
    const nome = (inst.nome ?? '').trim() || 'Instituição (sem nome)';
    lines.push(`<div style="border:1px solid #D7DEE7;border-radius:12px;padding:0.45rem 0.55rem;background:#fff">`);
    lines.push(`<div style="font-weight:900;margin-bottom:0.2rem">${escapeHtml(nome)}</div>`);
    lines.push(`<div style="color:#6B7A8A;font-weight:700;font-size:0.9rem">Serviços: <strong>${inst.servicos}</strong> · TA: <strong>${inst.recursosTA}</strong> · Open Day: <strong>${inst.openDay}</strong></div>`);
    lines.push(`</div>`);
  });

  lines.push(`</div></div>`);
  return lines.join('');
}

function styleFeature(feature, aggs) {
  const name = feature?.properties?.name ?? '';
  const key = normalizeText(name);
  const totals = aggs.muniTotals.get(key);
  const has = (totals?.total ?? 0) > 0;

  return {
    color: BORDER,
    weight: 1,
    opacity: 1,
    fillColor: has ? COLOR_RED : COLOR_GRAY,
    fillOpacity: 0.65,
  };
}

function attachInteractions(layer, feature, aggs) {
  const name = feature?.properties?.name ?? '';
  const key = normalizeText(name);

  layer.on('mouseover', () => {
    layer.setStyle({ weight: 2, fillOpacity: 0.8 });
    const t = aggs.muniTotals.get(key)?.total ?? 0;
    const status = document.getElementById('map-status');
    if (status) status.textContent = `${name} · Total: ${t}`;
  });

  layer.on('mouseout', () => {
    geoLayer.resetStyle(layer);
    const status = document.getElementById('map-status');
    if (status) status.textContent = '';
  });

  layer.on('click', () => {
    const info = aggs.byMunicipio.get(key);
    const totals = aggs.muniTotals.get(key) ?? { servicos: 0, recursosTA: 0, openDay: 0, total: 0 };
    const html = buildPopupHtml(name, info, totals);
    layer.bindPopup(html, { maxWidth: 420 }).openPopup();
  });
}

async function initMap(aggs) {
  if (map) {
    map.remove();
    map = null;
  }

  map = L.map('map', { zoomControl: true }).setView([-27.35, -50.20], 7);

  // Base leve (sem poluição visual)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap',
  }).addTo(map);

  const geojsonText = await fetchText('data/sc_municipios.geojson');
  const geojson = JSON.parse(geojsonText);

  geoLayer = L.geoJSON(geojson, {
    style: (f) => styleFeature(f, aggs),
    onEachFeature: (feature, layer) => attachInteractions(layer, feature, aggs),
  }).addTo(map);

  try {
    map.fitBounds(geoLayer.getBounds(), { padding: [10, 10] });
  } catch (e) {
    // ignore
  }
}

async function bootstrap() {
  try {
    const rows = await loadInstituicoesCsv('data/instituicoes.csv');
    const aggs = buildAggregates(rows);

    initCharts(aggs);
    await initMap(aggs);
  } catch (err) {
    console.error(err);
    const status = document.getElementById('map-status');
    if (status) status.textContent = 'Erro ao carregar dados. Confirme o CSV e o GeoJSON.';
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
