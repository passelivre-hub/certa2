// admin.js (CERTA - FCEE)

let rows = [];
let municipioList = [];

function buildMunicipioDatalist() {
  const existing = document.getElementById('municipios-datalist');
  if (existing) existing.remove();

  const dl = document.createElement('datalist');
  dl.id = 'municipios-datalist';
  municipioList.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m;
    dl.appendChild(opt);
  });
  document.body.appendChild(dl);
}

function renderTable() {
  const table = document.getElementById('inst-table');
  table.innerHTML = '';

  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th style="min-width:200px">Município</th>
      <th style="min-width:180px">Região</th>
      <th style="min-width:260px">Nome da Instituição</th>
      <th style="min-width:130px">Qt de Serviços</th>
      <th style="min-width:150px">Qt de Recurso de TA</th>
      <th style="min-width:130px">Qt de Open Day</th>
      <th style="min-width:90px">Ações</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  rows.forEach((r, idx) => {
    const tr = document.createElement('tr');

    const regOptions = REGIOES.map((reg) => {
      const sel = (r.Regiao ?? '') === reg ? 'selected' : '';
      return `<option value="${escapeHtml(reg)}" ${sel}>${escapeHtml(reg)}</option>`;
    }).join('');

    tr.innerHTML = `
      <td>
        <input list="municipios-datalist" value="${escapeHtml(r.Municipio ?? '')}" data-index="${idx}" data-field="Municipio" placeholder="Ex.: Florianópolis" />
      </td>
      <td>
        <select data-index="${idx}" data-field="Regiao">
          <option value="">Selecione</option>
          ${regOptions}
        </select>
      </td>
      <td>
        <input value="${escapeHtml(r.Nome_Instituicao ?? '')}" data-index="${idx}" data-field="Nome_Instituicao" placeholder="Nome da instituição" />
      </td>
      <td>
        <input type="number" min="0" value="${toNonNegativeInt(r.Qt_Servicos, 0)}" data-index="${idx}" data-field="Qt_Servicos" />
      </td>
      <td>
        <input type="number" min="0" value="${toNonNegativeInt(r.Qt_Recurso_TA, 0)}" data-index="${idx}" data-field="Qt_Recurso_TA" />
      </td>
      <td>
        <input type="number" min="0" value="${toNonNegativeInt(r.Qt_Open_Day, 0)}" data-index="${idx}" data-field="Qt_Open_Day" />
      </td>
      <td>
        <button class="secondary" data-action="delete" data-index="${idx}" title="Excluir">🗑</button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);

  // listeners
  table.querySelectorAll('input, select').forEach((el) => {
    el.addEventListener('change', (e) => {
      const index = Number(e.target.dataset.index);
      const field = e.target.dataset.field;
      if (!Number.isFinite(index) || !field) return;

      if (field === 'Qt_Servicos' || field === 'Qt_Recurso_TA' || field === 'Qt_Open_Day') {
        rows[index][field] = toNonNegativeInt(e.target.value, 0);
      } else {
        rows[index][field] = String(e.target.value ?? '').trim();
      }
    });
  });

  table.querySelectorAll('button[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = Number(btn.dataset.index);
      if (!Number.isFinite(index)) return;
      rows.splice(index, 1);
      renderTable();
    });
  });
}

function addRow() {
  rows.push({
    Municipio: '',
    Regiao: '',
    Nome_Instituicao: '',
    Qt_Servicos: 0,
    Qt_Recurso_TA: 0,
    Qt_Open_Day: 0,
  });
  renderTable();
}

function downloadCsv() {
  const header = ['Municipio', 'Regiao', 'Nome_Instituicao', 'Qt_Servicos', 'Qt_Recurso_TA', 'Qt_Open_Day'];
  const clean = rows.map((r) => ({
    Municipio: (r.Municipio ?? '').trim(),
    Regiao: (r.Regiao ?? '').trim(),
    Nome_Instituicao: (r.Nome_Instituicao ?? '').trim(),
    Qt_Servicos: toNonNegativeInt(r.Qt_Servicos, 0),
    Qt_Recurso_TA: toNonNegativeInt(r.Qt_Recurso_TA, 0),
    Qt_Open_Day: toNonNegativeInt(r.Qt_Open_Day, 0),
  }));
  downloadText('instituicoes.csv', toCsv(clean, header));
}

async function loadMunicipiosFromGeoJSON() {
  try {
    const geoText = await fetchText('data/sc_municipios.geojson');
    const geo = JSON.parse(geoText);
    const names = (geo.features ?? [])
      .map((f) => f?.properties?.name)
      .filter(Boolean)
      .map((n) => String(n).trim());
    // ordena + remove duplicados
    municipioList = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  } catch (e) {
    municipioList = [];
  }
  buildMunicipioDatalist();
}

async function loadDefaultCsv() {
  rows = await loadInstituicoesCsv('data/instituicoes.csv');
  renderTable();
}

function handleImport(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result ?? '');
    const raw = parseCsv(text);
    // Normaliza com a mesma lógica do loader
    rows = raw.map((r) => ({
      Municipio: (r.Municipio ?? r.municipio ?? '').trim(),
      Regiao: (r.Regiao ?? r.regiao ?? '').trim(),
      Nome_Instituicao: (r.Nome_Instituicao ?? r['Nome da Instituição'] ?? r.Instituicao ?? '').trim(),
      Qt_Servicos: toNonNegativeInt(r.Qt_Servicos ?? r['Qt de Serviços'] ?? r.Servicos, 0),
      Qt_Recurso_TA: toNonNegativeInt(r.Qt_Recurso_TA ?? r['Qt de Recurso de TA'] ?? r.RecursosTA, 0),
      Qt_Open_Day: toNonNegativeInt(r.Qt_Open_Day ?? r['Qt de Open Day'] ?? r.OpenDay, 0),
    }));
    renderTable();
  };
  reader.readAsText(file, 'utf-8');
}

async function bootstrapAdmin() {
  await loadMunicipiosFromGeoJSON();
  await loadDefaultCsv();

  document.getElementById('add-row-btn')?.addEventListener('click', addRow);
  document.getElementById('download-btn')?.addEventListener('click', downloadCsv);

  const importBtn = document.getElementById('import-btn');
  const importInput = document.getElementById('import-file');

  importBtn?.addEventListener('click', () => importInput?.click());
  importInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleImport(file);
    e.target.value = '';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  bootstrapAdmin().catch((e) => console.error(e));
});
