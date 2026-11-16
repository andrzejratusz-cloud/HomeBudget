const forecastSeries = [
  { key: 'income', label: 'Wpływy', color: '#177752', value: f => f.income },
  { key: 'costs', label: 'Wydatki', color: '#b14450', fill: '#b1445033', value: f => f.expenses },
  { key: 'goals', label: 'Oszczędności (potwierdzone)', color: '#7544c5', value: f => f.paid, base: f => f.income, fill: '#7544c533' },
  { key: 'free', label: 'Wolne środki', color: '#256b9d', value: f => f.free },
];
let chartPeriod = 'year';
let expenseCategory = '';
const visibleSeries = new Set(forecastSeries.map(series => series.key));

function chartBuckets(selected, period) {
  const index = monthIndex(selected);
  if (period === 'quarter') {
    const start = index - index % 3;
    return Array.from({ length: 4 }, (_, offset) => {
      const first = start + 3 * offset;
      return { label: 'Q' + (Math.floor(first % 12 / 3) + 1) + ' ' + monthAt(first).slice(0, 4),
        months: [0, 1, 2].map(step => monthAt(first + step)) };
    });
  }
  return Array.from({ length: period === 'year' ? 12 : 1 }, (_, offset) => {
    const key = monthAt(index + offset);
    return { label: key, months: [key] };
  });
}

function drawBudgetChart(panel, buckets, series) {
  if (!panel) return;
  if (!series.length) {
    panel.textContent = 'Wybierz serię, aby wyświetlić wykres.';
    return;
  }
  const rows = buckets.map(bucket => ({
    label: bucket.label,
    values: series.map(item => bucket.months.reduce((sum, key) => sum + item.value(key), 0))
  }));
  const bases = buckets.map(bucket => series.map(item => item.base
    ? bucket.months.reduce((sum, key) => sum + item.base(key), 0) : 0));
  const positions = rows.map((row, rowIndex) => row.values.map((value, index) => value + bases[rowIndex][index]));
  const values = [...positions.flat(), ...bases.flat()];
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const step = 200000; // Grosze: 2 000 zł.
  const low = Math.floor(min / step) * step;
  const high = Math.max(step, Math.ceil(max / step) * step);
  const y = value => (high - value) / (high - low) * 100;
  const spacing = 76;
  const plotWidth = rows.length === 1 ? 120 : Math.max(228, spacing * (rows.length - 1));
  const tickCount = (high - low) / step;
  const plotHeight = Math.max(190, tickCount * 21);
  const x = index => rows.length === 1 ? plotWidth / 2 : index * plotWidth / (rows.length - 1);
  const ticks = Array.from({length: tickCount + 1}, (_, index) => low + step * index);
  const grid = ticks.map(value => `<div class="line-chart-grid ${value === 0 ? 'line-chart-zero' : ''}" style="top:${y(value)}%">
    <span>${money(value)}</span>
  </div>`).join('');
  const fills = series.map((item, index) => {
    if (!item.fill) return '';
    const points = rows.length === 1 ? [{ row: 0, x: 28 }, { row: 0, x: 72 }]
      : rows.map((_, row) => ({ row, x: x(row) / plotWidth * 100 }));
    const edge = (point, values) => `${point.x}% ${y(values[point.row][index])}%`;
    const polygon = [...points.map(point => edge(point, positions)),
      ...points.slice().reverse().map(point => edge(point, bases))].join(',');
    return `<div class="line-chart-fill" aria-hidden="true" style="background:${item.fill};clip-path:polygon(${polygon})"></div>`;
  }).join('');
  const lines = series.map((item, index) => rows.slice(1).map((row, offset) => {
    const dx = x(offset + 1) - x(offset);
    const dy = (y(positions[offset + 1][index]) - y(positions[offset][index])) / 100 * plotHeight;
    return `<i aria-hidden="true" class="line-chart-segment" style="--line-color:${item.color};left:${x(offset)}px;top:${y(positions[offset][index])}%;width:${Math.hypot(dx, dy)}px;transform:rotate(${Math.atan2(dy, dx)}rad)"></i>`;
  }).join('')).join('');
  const points = rows.map((row, index) => {
    // A single button per distinct value keeps overlapping series readable and reachable.
    return [...new Set(positions[index])].map(value => {
      const matches = series.filter((_, seriesIndex) => positions[index][seriesIndex] === value);
      const label = row.label + ' · ' + matches.map(item => item.label + ' · ' + money(row.values[series.indexOf(item)]) + (item.base ? ' (razem z wpływami: ' + money(value) + ')' : '')).join(', ');
      return `<button type="button" class="line-chart-point" data-chart-point="${esc(label)}" aria-label="${esc(label)}" title="${esc(label)}" style="--line-color:${matches[0].color};left:${x(index)}px;top:${y(value)}%"></button>`;
    }).join('');
  }).join('');
  const labels = rows.map((row, index) => `<span class="line-chart-label" style="left:${x(index)}px">${esc(row.label)}</span>`).join('');
  panel.innerHTML = `<div class="line-chart-scroll"><div class="line-chart-layout" style="--plot-width:${plotWidth}px">
    <div class="line-chart-plot" style="height:${plotHeight}px">${fills}${grid}${lines}${points}${labels}</div>
  </div></div>
  <p class="line-chart-selection" aria-live="polite">Wybierz punkt, aby odczytać kwotę.</p>
  <details><summary>Kwoty na wykresie</summary><div class="forecast-table"><table>
    <thead><tr><th>Okres</th>${series.map(item => `<th>${item.label}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(row => `<tr><th scope="row">${row.label}</th>${row.values.map(value => `<td>${money(value)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div></details>`;
}

function showForecastChart() {
  drawBudgetChart($('#forecast-chart'), chartBuckets(chartPeriod === 'year' ? today().slice(0, 7) : month(), chartPeriod), forecastSeries
    .filter(item => visibleSeries.has(item.key))
    .map(item => ({ ...item, value: key => item.value(forecast(key)), base: item.base && (key => item.base(forecast(key))) })));
}

function expenseCategories() {
  return [...new Set(['Jedzenie', 'Wpłaty na cele', ...plan().items
    .filter(item => item.kind !== 'income').map(item => item.category?.trim() || 'Bez kategorii')])]
    .sort((a, b) => a.localeCompare(b, 'pl'));
}

function expenseForMonth(key, category) {
  if (!category) return forecast(key).expenses;
  let total = plan().items.filter(item => item.kind !== 'income' && applicable(item, key) &&
    (item.category?.trim() || 'Bez kategorii') === category).reduce((sum, item) => sum + item.amount, 0);
  if (category === 'Jedzenie') total += plan().food[key] || 0;
  if (category === 'Wpłaty na cele') total += forecast(key).paid;
  return total;
}

function showExpenseChart() {
  drawBudgetChart($('#expense-chart'), chartBuckets(today().slice(0, 7), 'year'), [{
    label: 'Wydatki', color: '#b14450', fill: '#b1445033', value: key => expenseForMonth(key, expenseCategory)
  }]);
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
        <option value="month">Miesiąc</option><option value="quarter">4 kwartały</option><option value="year">Najbliższe 12 miesięcy</option>
      </select></label>
      ${forecastSeries.map(item => `<label><input type="checkbox" data-chart-series="${item.key}" ${visibleSeries.has(item.key) ? 'checked' : ''}> <span class="series-swatch" aria-hidden="true" style="--swatch:${item.color}"></span> ${item.label}</label>`).join('')}</div>
      <p class="hint">Widok 12 miesięcy zaczyna się od bieżącego miesiąca. Widok kwartalny pokazuje cztery kwartały od wybranego miesiąca. Pas nad wpływami pokazuje potwierdzone oszczędności. Wolne środki to wpływy minus wydatki, w tym potwierdzone wpłaty na cele.</p>
      <div id="forecast-chart"></div>
    </section>`);
    $('#chart-period').value = chartPeriod;
    showForecastChart();
  }
  if (view === 'costs') {
    const categories = expenseCategories();
    if (!categories.includes(expenseCategory)) expenseCategory = '';
    $('#content').insertAdjacentHTML('afterbegin', `<section class="panel forecast-chart-panel">
      <h2>Wydatki przez najbliższe 12 miesięcy</h2>
      <label>Kategoria <select id="expense-category"><option value="">Wszystkie kategorie</option>
      ${categories.map(category => `<option value="${esc(category)}">${esc(category)}</option>`).join('')}
      </select></label><div id="expense-chart"></div>
    </section>`);
    $('#expense-category').value = expenseCategory;
    showExpenseChart();
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
    renderBackupFolder();
    $('#content').insertAdjacentHTML('beforeend', `<section class="panel setting reset-panel"><h2>Wyzeruj dane</h2>
      <p>Przed wyzerowaniem aplikacja zapisze na tym urządzeniu kopie JSON i CSV. Z tej sekcji pobierzesz kopie z ostatniego resetu.</p>
      <div class="actions"><button class="secondary" data-v7="reset">Wyzeruj dane</button>
      ${readResetBackup() ? '<button class="secondary" data-v7="reset-json">Pobierz kopię JSON z resetu</button><button class="secondary" data-v7="reset-csv">Pobierz kopię CSV z resetu</button>' : ''}</div></section>`);
  }
};

document.addEventListener('change', event => {
  const input = event.target;
  if (input.id === 'expense-category') { expenseCategory = input.value; showExpenseChart(); }
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
  const point = event.target.closest('button[data-chart-point]');
  if (point) point.closest('.panel').querySelector('.line-chart-selection').textContent = point.dataset.chartPoint;
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
