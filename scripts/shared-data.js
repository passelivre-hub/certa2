// shared-data.js (CERTA - FCEE)
// Funções utilitárias compartilhadas entre o painel e o admin.

const REGIOES = [
  'Grande Florianópolis',
  'Norte',
  'Oeste',
  'Vale do Itajai',
  'Sul',
  'Serra',
];

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function toNonNegativeInt(value, fallback = 0) {
  const parsed = parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : fallback;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// CSV simples com separador ";"
function parseCsv(text) {
  const rows = [];
  const lines = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0);

  if (!lines.length) return rows;

  const header = lines[0].split(';').map((h) => h.trim());
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(';');
    const row = {};
    header.forEach((h, idx) => {
      row[h] = (cols[idx] ?? '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function toCsv(rows, header) {
  const head = header ?? Object.keys(rows[0] ?? {});
  const safe = (v) => String(v ?? '').replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/;/g, ',');
  const out = [];
  out.push(head.join(';'));
  rows.forEach((r) => {
    out.push(head.map((h) => safe(r[h])).join(';'));
  });
  return out.join('\n');
}

async function fetchText(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Falha ao carregar: ${url}`);
  return res.text();
}

async function loadInstituicoesCsv(url = 'data/instituicoes.csv') {
  const text = await fetchText(url);
  const rows = parseCsv(text);

  // Normaliza campos esperados
  return rows.map((r) => {
    const municipio = (r.Municipio ?? r.municipio ?? '').trim();
    const regiao = (r.Regiao ?? r.regiao ?? '').trim();
    const nome = (r.Nome_Instituicao ?? r['Nome da Instituição'] ?? r.Instituicao ?? '').trim();

    return {
      Municipio: municipio,
      Regiao: regiao,
      Nome_Instituicao: nome,
      Qt_Servicos: toNonNegativeInt(r.Qt_Servicos ?? r['Qt de Serviços'] ?? r.Servicos, 0),
      Qt_Recurso_TA: toNonNegativeInt(r.Qt_Recurso_TA ?? r['Qt de Recurso de TA'] ?? r.RecursosTA, 0),
      Qt_Open_Day: toNonNegativeInt(r.Qt_Open_Day ?? r['Qt de Open Day'] ?? r.OpenDay, 0),
    };
  });
}

function buildAggregates(rows) {
  const byMunicipio = new Map();
  const totalsByType = { servicos: 0, recursosTA: 0, openDay: 0 };
  const totalsByRegiao = Object.fromEntries(REGIOES.map((r) => [r, 0]));

  rows.forEach((row) => {
    const municipio = (row.Municipio ?? '').trim();
    if (!municipio) return;

    const regiao = (row.Regiao ?? '').trim();
    const key = normalizeText(municipio);

    const inst = {
      nome: (row.Nome_Instituicao ?? '').trim(),
      servicos: toNonNegativeInt(row.Qt_Servicos, 0),
      recursosTA: toNonNegativeInt(row.Qt_Recurso_TA, 0),
      openDay: toNonNegativeInt(row.Qt_Open_Day, 0),
    };

    totalsByType.servicos += inst.servicos;
    totalsByType.recursosTA += inst.recursosTA;
    totalsByType.openDay += inst.openDay;

    const totalLinha = inst.servicos + inst.recursosTA + inst.openDay;
    if (REGIOES.includes(regiao)) totalsByRegiao[regiao] += totalLinha;

    if (!byMunicipio.has(key)) {
      byMunicipio.set(key, { municipio, regiao, institutions: [] });
    }
    const bucket = byMunicipio.get(key);
    // mantem regiao se existir
    if (!bucket.regiao && regiao) bucket.regiao = regiao;
    bucket.institutions.push(inst);
  });

  // totals por município
  const muniTotals = new Map();
  for (const [k, item] of byMunicipio.entries()) {
    const t = item.institutions.reduce(
      (acc, it) => {
        acc.servicos += it.servicos;
        acc.recursosTA += it.recursosTA;
        acc.openDay += it.openDay;
        return acc;
      },
      { servicos: 0, recursosTA: 0, openDay: 0 }
    );
    muniTotals.set(k, { ...t, total: t.servicos + t.recursosTA + t.openDay });
  }

  return { byMunicipio, muniTotals, totalsByType, totalsByRegiao };
}

function downloadText(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
