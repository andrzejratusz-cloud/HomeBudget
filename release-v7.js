const forecastSeries = [
  { key: 'income', label: 'Wpływy', color: '#177752', value: f => f.income },
  { key: 'costs', label: 'Wydatki', color: '#b14450', value: f => f.fixed + f.quarterly + f.annual + f.food },
  { key: 'goals', label: 'Oszczędności na cele', color: '#7544c5', value: f => f.goals },
  { key: 'free', label: 'Wolne środki', color: '#256b9d', value: f => f.free },
];
let chartPeriod = 'month';
const visibleSeries = new Set(forecastSeries.map(series => series.key));

function chartMonths(selected, period) {
  const index = monthIndex(selected);
  const length = { month: 1, quarter: 3, year: 12 }[period];
  return Array.from({ length }, (_, offset) => monthAt(index - index % length + offset));
}

function showForecastChart() {
  const panel = $('#forecast-chart');
  if (!panel) return;
  const months = chartMonths(month(), chartPeriod);
  const series = forecastSeries.filter(item => visibleSeries.has(item.key));
  const rows = months.map(key => ({ key, result: forecast(key) }));
  const max = Math.max(1, ...rows.flatMap(row => series.map(item => Math.abs(item.value(row.result)))));
  panel.innerHTML = series.length ? rows.map(({ key, result }) => `<section class="chart-month">
    <h3>${key}</h3>
    ${series.map(item => {
      const value = item.value(result);
      return `<div class="chart-row"><span>${item.label}</span><div class="chart-track" aria-hidden="true"><i class="${value < 0 ? 'chart-negative' : ''}" style="--series:${item.color};width:${Math.abs(value) / max * 100}%"></i></div><strong>${money(value)}</strong></div>`;
    }).join('')}
  </section>`).join('') : '<p>Wybierz co najmniej jedną pozycję, aby wyświetlić wykres.</p>';
}

const themeOptions = { peach: 'Fiolet i brzoskwinia', ocean: 'Ocean', forest: 'Las', night: 'Noc' };
const themeKey = 'home-budget-theme';
const backupKey = 'home-budget-last-reset-backup';
function currentTheme() {
  try {
    const key = localStorage.getItem(themeKey);
    return Object.hasOwn(themeOptions, key) ? key : 'peach';
  } catch { return 'peach'; }
}
function readResetBackup() {
  try { return JSON.parse(localStorage.getItem(backupKey)); }
  catch { return null; }
}

function allDataCsv(snapshot) {
  const rows = [['Sekcja', 'Typ', 'Nazwa', 'Kategoria', 'Data lub miesiąc', 'Kwota PLN', 'Dane rekordu JSON']];
  const add = (section, type, name, category, date, amount, record) => {
    rows.push([section, type, name, category, date, amount == null ? '' : (amount / 100).toFixed(2).replace('.', ','), JSON.stringify(record)]);
  };
  for (const t of snapshot.transactions) add('Transakcje', t.type, t.name, t.category, t.date, t.amount, t);
  for (const i of snapshot.planner?.items || []) add('Plan', i.kind, i.name, i.category, i.start, i.amount, i);
  for (const [key, amount] of Object.entries(snapshot.planner?.food || {})) add('Plan', 'Jedzenie', '', 'Jedzenie', key, amount, { month: key, amount });
  for (const [key, categories] of Object.entries(snapshot.budgets)) {
    for (const [category, amount] of Object.entries(categories)) add('Limity', 'Limit', '', category, key, amount, { month: key, category, amount });
  }
  for (const goal of snapshot.goals) {
    add('Cele', 'Cel', goal.name, '', goal.deadline, goal.target, goal);
    for (const p of goal.payments || []) add('Cele', 'Wpłata', goal.name, '', p.month, p.amount, { goal: goal.id, ...p });
  }
  for (const entry of snapshot.savings?.entries || []) add('Oszczędności', 'Wpłata', entry.name, '', '', entry.amount, entry);
  for (const allocation of snapshot.savings?.allocations || []) {
    add('Oszczędności', 'Przypisanie', snapshot.goals.find(goal => goal.id === allocation.goal)?.name, '', '', allocation.amount, allocation);
  }
  const quote = value => '"' + String(value ?? '').replace(/^[\s]*[=+@-]|^[\t\r\n]/, "'$&").replaceAll('"', '""') + '"';
  return '\ufeff' + rows.map(row => row.map(quote).join(';')).join('\r\n');
}

function downloadResetBackup(backup, format) {
  download(backup[format], `home-budget-przed-resetem-${backup.stamp}.${format}`,
    format === 'json' ? 'application/json' : 'text/csv;charset=utf-8');
}

const renderBeforeV7 = render;
render = function () {
  renderBeforeV7();
  if (view === 'dashboard') {
    $('#content').insertAdjacentHTML('afterbegin', `<section class="panel forecast-chart-panel">
      <h2>Wykres prognozy</h2>
      <div class="chart-controls"><label>Okres <select id="chart-period">
        <option value="month">Miesiąc</option><option value="quarter">Kwartał</option><option value="year">Rok</option>
      </select></label>
      ${forecastSeries.map(item => `<label><input type="checkbox" data-chart-series="${item.key}" ${visibleSeries.has(item.key) ? 'checked' : ''}> ${item.label}</label>`).join('')}</div>
      <p class="hint">Okres kalendarzowy na podstawie wybranego miesiąca. Wydatki obejmują planowane koszty i jedzenie.</p>
      <div id="forecast-chart"></div>
    </section>`);
    $('#chart-period').value = chartPeriod;
    showForecastChart();
  }
  if (view === 'transactions') {
    $('#content .section-head').insertAdjacentHTML('beforeend', '<button type="button" class="primary" data-v7="transaction">+ Transakcja</button>');
  }
  if (view === 'settings') {
    $('#content').insertAdjacentHTML('afterbegin', `<section class="panel setting"><h2>Wygląd</h2>
      <label>Motyw kolorystyczny <select id="budget-theme">
      ${Object.entries(themeOptions).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}
      </select></label></section>`);
    $('#budget-theme').value = currentTheme();
    $('#content').insertAdjacentHTML('beforeend', `<section class="panel setting reset-panel"><h2>Wyzeruj dane</h2>
      <p>Przed wyzerowaniem aplikacja zapisze na tym urządzeniu kopie JSON i CSV. Z tej sekcji pobierzesz kopie z ostatniego resetu.</p>
      <div class="actions"><button class="secondary" data-v7="reset">Wyzeruj dane</button>
      ${readResetBackup() ? '<button class="secondary" data-v7="reset-json">Pobierz kopię JSON z resetu</button><button class="secondary" data-v7="reset-csv">Pobierz kopię CSV z resetu</button>' : ''}</div></section>`);
  }
};

document.addEventListener('change', event => {
  const input = event.target;
  if (input.id === 'chart-period') { chartPeriod = input.value; showForecastChart(); }
  if (input.dataset.chartSeries) {
    if (input.checked) visibleSeries.add(input.dataset.chartSeries);
    else visibleSeries.delete(input.dataset.chartSeries);
    showForecastChart();
  }
  if (input.id === 'budget-theme' && Object.hasOwn(themeOptions, input.value)) {
    try {
      localStorage.setItem(themeKey, input.value);
      document.documentElement.dataset.theme = input.value;
    } catch { notify('Nie udało się zapisać motywu.'); }
  }
});

document.addEventListener('click', event => {
  const action = event.target.closest('button[data-v7]')?.dataset.v7;
  if (action === 'transaction') openForm('transaction');
  if (action === 'csv') download(allDataCsv(data), `home-budget-${today()}.csv`, 'text/csv;charset=utf-8');
  if (action === 'reset-json' || action === 'reset-csv') {
    const backup = readResetBackup();
    if (backup) downloadResetBackup(backup, action.slice(6));
  }
  if (action !== 'reset') return;
  if (!confirm('Wyzerować wszystkie dane budżetu na tym urządzeniu? Aplikacja najpierw zapisze kopie JSON i CSV. Zastąpi kopie z poprzedniego resetu.')) return;
  try {
    const backup = { stamp: new Date().toISOString().slice(0, 19).replaceAll(':', '-'), json: JSON.stringify(data, null, 2), csv: allDataCsv(data) };
    localStorage.setItem(backupKey, JSON.stringify(backup));
    if (save(fresh())) notify('Dane wyzerowane. Kopie JSON i CSV są gotowe do pobrania.');
  } catch { notify('Nie udało się zapisać kopii. Dane zachowano.'); }
});

document.documentElement.dataset.theme = currentTheme();
render();
