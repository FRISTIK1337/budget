'use strict';

const STORAGE_KEY = 'velora-finance-v2';
const THEME_KEY = 'velora-theme-v1';
const CURRENCY_SYMBOLS = { PLN: 'zł', EUR: '€', USD: '$', RUB: '₽', UAH: '₴', GBP: '£', CZK: 'Kč' };
const PALETTE = ['#c79d71', '#a98ba7', '#83a69a', '#d18f91', '#8198b7', '#b4a16f', '#9a8b82', '#b68d71'];

const DEFAULT_CATEGORIES = [
  { id: 'food', name: 'Еда', icon: '🥑', color: '#c79d71', type: 'expense', isDefault: true },
  { id: 'transport', name: 'Транспорт', icon: '🚕', color: '#8198b7', type: 'expense', isDefault: true },
  { id: 'sport', name: 'Спорт', icon: '🏋️', color: '#83a69a', type: 'expense', isDefault: true },
  { id: 'home', name: 'Дом и счета', icon: '🏠', color: '#a98ba7', type: 'expense', isDefault: true },
  { id: 'shopping', name: 'Покупки', icon: '🛍️', color: '#d18f91', type: 'expense', isDefault: true },
  { id: 'health', name: 'Здоровье', icon: '💊', color: '#b4a16f', type: 'expense', isDefault: true },
  { id: 'leisure', name: 'Досуг', icon: '🎟️', color: '#9a8b82', type: 'expense', isDefault: true },
  { id: 'subscriptions', name: 'Подписки', icon: '📱', color: '#b68d71', type: 'expense', isDefault: true },
  { id: 'other-expense', name: 'Другое', icon: '✳', color: '#a69aa0', type: 'expense', isDefault: true },
  { id: 'salary', name: 'Зарплата', icon: '💼', color: '#83a69a', type: 'income', isDefault: true },
  { id: 'freelance', name: 'Фриланс', icon: '💻', color: '#8198b7', type: 'income', isDefault: true },
  { id: 'investments', name: 'Инвестиции', icon: '📈', color: '#c79d71', type: 'income', isDefault: true },
  { id: 'other-income', name: 'Другой доход', icon: '✦', color: '#a98ba7', type: 'income', isDefault: true }
];

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function parseLocalDate(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}
function shiftDate(value, days) {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + days);
  return localDate(date);
}
function daysInMonth(year, monthIndex) { return new Date(year, monthIndex + 1, 0).getDate(); }
function addRecurrenceDate(value, frequency, anchorDay) {
  const date = parseLocalDate(value);
  if (frequency === 'weekly') {
    date.setDate(date.getDate() + 7);
    return localDate(date);
  }
  if (frequency === 'yearly') {
    const targetYear = date.getFullYear() + 1;
    const month = date.getMonth();
    date.setFullYear(targetYear, month, Math.min(anchorDay || date.getDate(), daysInMonth(targetYear, month)));
    return localDate(date);
  }
  const targetYear = date.getMonth() === 11 ? date.getFullYear() + 1 : date.getFullYear();
  const targetMonth = (date.getMonth() + 1) % 12;
  return localDate(new Date(targetYear, targetMonth, Math.min(anchorDay || date.getDate(), daysInMonth(targetYear, targetMonth)), 12));
}
function makeId(prefix = 'item') {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') return `${prefix}_${window.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function safeColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value)) ? value : '#a69aa0';
}
function seedState() {
  const categories = DEFAULT_CATEGORIES.map(category => ({ ...category }));
  return { version: 2, currency: 'RUB', categories, transactions: [], recurring: [] };
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.transactions) || !Array.isArray(parsed.categories) || !Array.isArray(parsed.recurring)) return seedState();
    return {
      version: 1,
      currency: 'RUB',
      categories: parsed.categories.map(c => ({
        id: String(c.id || makeId('cat')), name: String(c.name || 'Без названия').slice(0, 30),
        icon: String(c.icon || '✦').slice(0, 4), color: safeColor(c.color),
        type: c.type === 'income' ? 'income' : 'expense', isDefault: Boolean(c.isDefault)
      })),
      transactions: parsed.transactions.map(t => ({
        id: String(t.id || makeId('tx')), type: t.type === 'income' ? 'income' : 'expense',
        amount: Math.max(0, Number(t.amount) || 0), categoryId: String(t.categoryId || 'other-expense'),
        date: /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : localDate(), time: /^\d{2}:\d{2}$/.test(t.time || '') ? t.time : '12:00', note: String(t.note || '').slice(0, 90), items: Array.isArray(t.items) ? t.items.map(i => ({ name: String(i.name || '').slice(0,60), amount: Math.max(0, Number(i.amount)||0) })).filter(i => i.name && i.amount > 0) : []
      })),
      recurring: parsed.recurring.map(r => ({
        id: String(r.id || makeId('rec')), name: String(r.name || 'Платеж').slice(0, 60), amount: Math.max(0, Number(r.amount) || 0),
        categoryId: String(r.categoryId || 'home'), frequency: ['weekly', 'monthly', 'yearly'].includes(r.frequency) ? r.frequency : 'monthly',
        nextDate: /^\d{4}-\d{2}-\d{2}$/.test(r.nextDate) ? r.nextDate : localDate(),
        dayOfMonth: Math.min(31, Math.max(1, Number(r.dayOfMonth) || 1)), active: r.active !== false
      }))
    };
  } catch (error) {
    console.warn('Не удалось прочитать сохраненные данные:', error);
    return seedState();
  }
}

let state = loadState();
let currentView = 'overview';
let currentPeriod = 'month';
let selectedMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12);
let currentTransactionType = 'expense';
let toastTimer = null;

const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));
const today = localDate();

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Не удалось сохранить данные:', error);
    showToast('Не удалось сохранить данные. Проверьте свободное место браузера.');
  }
}
function formatMoney(amount, options = {}) {
  const value = Number(amount) || 0;
  const formatted = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Math.abs(value));
  const symbol = CURRENCY_SYMBOLS[state.currency] || state.currency;
  const sign = options.sign && value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${formatted} ${symbol}`;
}
function formatDate(value, options = {}) {
  if (!value) return '—';
  const date = parseLocalDate(value);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: options.short ? 'short' : 'long', ...(options.year ? { year: 'numeric' } : {}) }).format(date);
}
function formatCompact(amount) {
  const value = Math.abs(Number(amount) || 0);
  if (value >= 1000000) return `${(value / 1000000).toFixed(1).replace('.', ',')}м`;
  if (value >= 10000) return `${(value / 1000).toFixed(0)}к`;
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace('.', ',')}к`;
  return String(Math.round(value));
}
function getCategory(id) { return state.categories.find(category => category.id === id) || state.categories.find(category => category.id === 'other-expense') || { name: 'Без категории', icon: '✦', color: '#a69aa0' }; }
function getPeriodRange(period = currentPeriod) {
  const date = parseLocalDate(today);
  let start = new Date(date), end = new Date(date);
  if (period === 'week') {
    const day = (date.getDay() + 6) % 7;
    start.setDate(date.getDate() - day);
    end = new Date(start); end.setDate(start.getDate() + 6);
  } else if (period === 'month') {
    start = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1, 12);
    end = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0, 12);
  } else if (period === 'year') {
    start = new Date(date.getFullYear(), 0, 1, 12);
    end = new Date(date.getFullYear(), 11, 31, 12);
  }
  return { start: localDate(start), end: localDate(end) };
}
function getPeriodTransactions(period = currentPeriod) {
  const range = getPeriodRange(period);
  return state.transactions.filter(transaction => transaction.date >= range.start && transaction.date <= range.end);
}
function summarize(transactions) {
  const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  return { income, expense, balance: income - expense, savings: income > 0 ? Math.max(0, (income - expense) / income * 100) : 0 };
}
function periodLabel(period = currentPeriod) {
  if (period === 'day') return 'За сегодня';
  if (period === 'week') return 'За эту неделю';
  if (period === 'year') return 'За этот год';
  return `За ${new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(selectedMonth)}`;
}
function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}
function setView(view) {
  if (!['overview', 'transactions', 'recurring', 'categories', 'settings'].includes(view)) return;
  currentView = view;
  $$('.view').forEach(section => section.classList.toggle('active', section.id === `view-${view}`));
  $$('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  const labels = { overview: 'ОБЗОР', transactions: 'ОПЕРАЦИИ', recurring: 'РЕГУЛЯРНЫЕ ПЛАТЕЖИ', categories: 'КАТЕГОРИИ', settings: 'НАСТРОЙКИ' };
  $('#topbarPageName').textContent = labels[view];
  if (view === 'overview') drawCashflowChart();
  if (view === 'transactions') renderTransactionsPage();
}
function setPeriod(period) {
  if (!['day', 'week', 'month', 'year'].includes(period)) return;
  currentPeriod = period;
  $$('[data-period]').forEach(button => button.classList.toggle('active', button.dataset.period === period));
  renderOverview();
  if (currentView === 'transactions') renderTransactionsPage();
}

function renderOverview() {
  const monthLabel = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(selectedMonth);
  if ($('#selectedMonthLabel')) $('#selectedMonthLabel').textContent = monthLabel.charAt(0).toLocaleUpperCase('ru') + monthLabel.slice(1);
  if ($('#selectedMonthHint')) $('#selectedMonthHint').textContent = selectedMonth.getFullYear() === new Date().getFullYear() && selectedMonth.getMonth() === new Date().getMonth() ? 'Текущий месяц · данные обновляются автоматически' : 'Архив операций за выбранный месяц';
  const monthButtons = $$('.month-arrow[data-month-shift]');
  monthButtons.forEach(button => button.disabled = false);
  const periodTransactions = getPeriodTransactions();
  const totals = summarize(periodTransactions);
  const allTimeTotals = summarize(state.transactions);
  $('#balanceValue').textContent = formatMoney(allTimeTotals.balance);
  $('#incomeValue').textContent = formatMoney(totals.income);
  $('#expenseValue').textContent = formatMoney(totals.expense);
  $('#savingsValue').textContent = `${Math.round(totals.savings)}%`;
  $('#savingsTrack').style.width = `${Math.min(100, totals.savings)}%`;
  $('#balanceTrend').textContent = totals.balance >= 0 ? '↗' : '↘';
  $('#balanceCaption').textContent = allTimeTotals.balance >= 0 ? 'Текущий остаток по всем записям' : 'Расходы превышают доходы';
  $('#incomeCaption').textContent = periodLabel();
  $('#expenseCaption').textContent = periodLabel();
  $('#savingsCaption').textContent = 'От доходов за период';
  $('#chartBalance').textContent = formatMoney(totals.balance);
  $('#chartPeriodLabel').textContent = periodLabel();
  renderDonut(periodTransactions);
  renderRecentTransactions(periodTransactions);
  drawCashflowChart();
}
function renderTransactionRow(transaction) {
  const category = getCategory(transaction.categoryId);
  const isIncome = transaction.type === 'income';
  const title = transaction.note || category.name;
  const secondary = transaction.items?.length ? `${category.name} · ${transaction.items.map(i => i.name).join(', ')}` : (transaction.note ? category.name : (isIncome ? 'Поступление' : 'Списание'));
  return `<div class="transaction-row">
    <div class="transaction-main"><div class="transaction-icon" style="background:${safeColor(category.color)}1b">${escapeHtml(category.icon)}</div><div class="transaction-title"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(secondary)}</small></div></div>
    <div class="transaction-category"><i class="category-color-dot" style="background:${safeColor(category.color)}"></i>${escapeHtml(category.name)}</div>
    <div class="transaction-date">${formatDate(transaction.date, { short: true })}<small>${escapeHtml(transaction.time || '12:00')}</small></div>
    <div class="transaction-amount ${isIncome ? 'income' : ''}">${isIncome ? '+' : '−'}${formatMoney(transaction.amount)}</div>
    <div class="row-actions"><button class="mini-action" data-action="edit-transaction" data-id="${escapeHtml(transaction.id)}" title="Редактировать" aria-label="Редактировать">✎</button><button class="mini-action" data-action="delete-transaction" data-id="${escapeHtml(transaction.id)}" title="Удалить" aria-label="Удалить">×</button></div>
  </div>`;
}
function renderRecentTransactions(transactions) {
  const list = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || String(b.time || '').localeCompare(String(a.time || ''))).slice(0, 5);
  $('#recentTransactions').innerHTML = list.length ? list.map(renderTransactionRow).join('') : '<div class="empty-inline">Операций за этот период пока нет.</div>';
}
function renderTransactionsPage() {
  const query = ($('#transactionSearch')?.value || '').trim().toLocaleLowerCase('ru');
  const type = $('#transactionTypeFilter')?.value || 'all';
  const categoryId = $('#transactionCategoryFilter')?.value || 'all';
  let transactions = getPeriodTransactions();
  if (type !== 'all') transactions = transactions.filter(t => t.type === type);
  if (categoryId !== 'all') transactions = transactions.filter(t => t.categoryId === categoryId);
  if (query) transactions = transactions.filter(t => {
    const category = getCategory(t.categoryId);
    return `${t.note} ${category.name}`.toLocaleLowerCase('ru').includes(query);
  });
  transactions.sort((a, b) => b.date.localeCompare(a.date) || String(b.time || '').localeCompare(String(a.time || '')));
  $('#transactionCount').textContent = `${transactions.length} ${pluralize(transactions.length, 'операция', 'операции', 'операций')}`;
  const totals = summarize(transactions);
  $('#transactionsTotal').textContent = `Баланс списка: ${formatMoney(totals.balance)}`;
  $('#allTransactions').innerHTML = transactions.map(renderTransactionRow).join('');
  $('#transactionsEmpty').classList.toggle('hidden', transactions.length > 0);
  $('#allTransactions').classList.toggle('hidden', transactions.length === 0);
}
function pluralize(number, one, few, many) {
  const n = Math.abs(number) % 100;
  const last = n % 10;
  if (n > 10 && n < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}
function renderDonut(transactions) {
  const totals = new Map();
  transactions.filter(t => t.type === 'expense').forEach(t => totals.set(t.categoryId, (totals.get(t.categoryId) || 0) + t.amount));
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((sum, entry) => sum + entry[1], 0);
  $('#donutTotal').textContent = formatCompact(total);
  if (!total) {
    $('#expenseDonut').style.background = 'conic-gradient(#eee8e4 0 100%)';
    $('#donutLegend').innerHTML = '';
    $('#donutEmpty').classList.remove('hidden');
    return;
  }
  $('#donutEmpty').classList.add('hidden');
  const shown = sorted.slice(0, 4);
  const rest = sorted.slice(4).reduce((sum, entry) => sum + entry[1], 0);
  const segments = [];
  let offset = 0;
  shown.forEach(([id, amount]) => {
    const category = getCategory(id);
    const end = offset + amount / total * 100;
    segments.push(`${safeColor(category.color)} ${offset}% ${end}%`);
    offset = end;
  });
  if (rest > 0) segments.push(`#d9d1cd ${offset}% 100%`);
  $('#expenseDonut').style.background = `conic-gradient(${segments.join(',')})`;
  const legend = shown.map(([id, amount]) => {
    const category = getCategory(id);
    return `<div class="donut-legend-item"><i style="background:${safeColor(category.color)}"></i><span>${escapeHtml(category.name)}</span><strong>${Math.round(amount / total * 100)}%</strong></div>`;
  });
  if (rest > 0) legend.push(`<div class="donut-legend-item"><i style="background:#d9d1cd"></i><span>Остальное</span><strong>${Math.round(rest / total * 100)}%</strong></div>`);
  $('#donutLegend').innerHTML = legend.join('');
}

function buildChartBuckets() {
  const range = getPeriodRange();
  if (currentPeriod === 'day') return [{ label: 'Сегодня', start: range.start, end: range.end }];
  if (currentPeriod === 'week') {
    return Array.from({ length: 7 }, (_, index) => {
      const date = shiftDate(range.start, index);
      return { label: new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(parseLocalDate(date)).replace('.', ''), start: date, end: date };
    });
  }
  if (currentPeriod === 'year') {
    return Array.from({ length: 12 }, (_, index) => {
      const start = localDate(new Date(parseLocalDate(range.start).getFullYear(), index, 1, 12));
      const end = localDate(new Date(parseLocalDate(range.start).getFullYear(), index + 1, 0, 12));
      return { label: new Intl.DateTimeFormat('ru-RU', { month: 'short' }).format(parseLocalDate(start)).replace('.', ''), start, end };
    });
  }
  return Array.from({ length: 5 }, (_, index) => {
    const startDate = new Date(parseLocalDate(range.start));
    startDate.setDate(1 + index * 7);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    if (startDate.getMonth() !== parseLocalDate(range.start).getMonth()) return null;
    const rangeEnd = parseLocalDate(range.end);
    if (endDate > rangeEnd) endDate.setTime(rangeEnd.getTime());
    return { label: `${index + 1} нед.`, start: localDate(startDate), end: localDate(endDate) };
  }).filter(Boolean);
}
function drawCashflowChart() {
  const canvas = $('#cashflowChart');
  if (!canvas || !canvas.getContext) return;
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 10) return;
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const width = rect.width, height = rect.height;
  ctx.clearRect(0, 0, width, height);
  const buckets = buildChartBuckets();
  const values = buckets.map(bucket => {
    const tx = state.transactions.filter(t => t.date >= bucket.start && t.date <= bucket.end);
    return { label: bucket.label, income: tx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0), expense: tx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0) };
  });
  const max = Math.max(1, ...values.flatMap(v => [v.income, v.expense]));
  const left = 5, right = 8, top = 8, bottom = 25;
  const chartHeight = height - top - bottom;
  const usableWidth = width - left - right;
  const groupWidth = usableWidth / values.length;
  const barGap = Math.min(5, groupWidth * .12);
  const barWidth = Math.max(4, Math.min(16, (groupWidth * .52 - barGap) / 2));
  ctx.strokeStyle = '#f0ebe8'; ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y = top + chartHeight * i / 3;
    ctx.beginPath(); ctx.moveTo(left, y + .5); ctx.lineTo(width - right, y + .5); ctx.stroke();
  }
  values.forEach((entry, index) => {
    const center = left + groupWidth * index + groupWidth / 2;
    const incomeHeight = entry.income / max * (chartHeight - 4);
    const expenseHeight = entry.expense / max * (chartHeight - 4);
    const x1 = center - barWidth - barGap / 2;
    const x2 = center + barGap / 2;
    drawRoundedBar(ctx, x1, top + chartHeight - incomeHeight, barWidth, incomeHeight, 4, '#91aa9b');
    drawRoundedBar(ctx, x2, top + chartHeight - expenseHeight, barWidth, expenseHeight, 4, '#cda2a5');
    ctx.fillStyle = '#a99fa5'; ctx.font = '9px ' + getComputedStyle(document.body).fontFamily; ctx.textAlign = 'center';
    ctx.fillText(entry.label, center, height - 7);
  });
}
function drawRoundedBar(ctx, x, y, width, height, radius, color) {
  if (height < 1) return;
  const r = Math.min(radius, width / 2, height / 2);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath(); ctx.fill();
}

function populateCategorySelect(select, type, selectedId) {
  const options = state.categories.filter(category => category.type === type);
  select.innerHTML = options.map(category => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.icon)} ${escapeHtml(category.name)}</option>`).join('');
  if (selectedId && options.some(category => category.id === selectedId)) select.value = selectedId;
}
function refreshCategoryFilters() {
  const select = $('#transactionCategoryFilter');
  const previous = select.value || 'all';
  select.innerHTML = '<option value="all">Все категории</option>' + state.categories.map(category => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`).join('');
  select.value = state.categories.some(category => category.id === previous) ? previous : 'all';
}
function renderCategories() {
  const expenseCategories = state.categories.filter(c => c.type === 'expense');
  const incomeCategories = state.categories.filter(c => c.type === 'income');
  $('#expenseCategoryCount').textContent = expenseCategories.length;
  $('#incomeCategoryCount').textContent = incomeCategories.length;
  const renderCategory = category => {
    const count = state.transactions.filter(t => t.categoryId === category.id).length;
    return `<div class="managed-category-row"><div class="managed-category-icon" style="background:${safeColor(category.color)}1c">${escapeHtml(category.icon)}</div><span class="managed-category-name">${escapeHtml(category.name)}</span><span class="managed-category-count">${count} ${pluralize(count, 'запись', 'записи', 'записей')}</span><div class="category-row-actions"><button class="mini-action" data-action="edit-category" data-id="${escapeHtml(category.id)}" aria-label="Редактировать категорию" title="Редактировать">✎</button>${category.isDefault ? '' : `<button class="mini-action" data-action="delete-category" data-id="${escapeHtml(category.id)}" aria-label="Удалить категорию" title="Удалить">×</button>`}</div></div>`;
  };
  $('#expenseCategoryList').innerHTML = expenseCategories.map(renderCategory).join('');
  $('#incomeCategoryList').innerHTML = incomeCategories.map(renderCategory).join('');
}

function normalizeRecurringNextDate(item) {
  let date = item.nextDate;
  let iterations = 0;
  while (date < today && iterations < 120) {
    date = addRecurrenceDate(date, item.frequency, item.dayOfMonth);
    iterations++;
  }
  return date;
}
function monthlyEquivalent(item) {
  if (item.frequency === 'weekly') return item.amount * 52 / 12;
  if (item.frequency === 'yearly') return item.amount / 12;
  return item.amount;
}
function frequencyLabel(frequency) { return frequency === 'weekly' ? 'Еженедельно' : frequency === 'yearly' ? 'Ежегодно' : 'Ежемесячно'; }
function renderRecurring() {
  const active = state.recurring.filter(item => item.active);
  const estimatedMonthly = active.reduce((sum, item) => sum + monthlyEquivalent(item), 0);
  $('#monthlyRecurringTotal').textContent = formatMoney(estimatedMonthly);
  $('#activeRecurringCount').textContent = String(active.length);
  const next = active.map(item => ({ ...item, normalizedDate: normalizeRecurringNextDate(item) })).sort((a, b) => a.normalizedDate.localeCompare(b.normalizedDate))[0];
  $('#nextRecurringDate').textContent = next ? formatDate(next.normalizedDate, { short: true }) : '—';
  $('#nextRecurringName').textContent = next ? next.name : 'Нет запланированных платежей';
  $('#recurringNavCount').textContent = String(active.length);
  $('#recurringCountLabel').textContent = `${state.recurring.length} ${pluralize(state.recurring.length, 'платеж', 'платежа', 'платежей')}`;
  const sorted = [...state.recurring].sort((a, b) => (a.active ? 0 : 1) - (b.active ? 0 : 1) || normalizeRecurringNextDate(a).localeCompare(normalizeRecurringNextDate(b)));
  $('#recurringList').innerHTML = sorted.map(item => {
    const category = getCategory(item.categoryId);
    const nextDate = normalizeRecurringNextDate(item);
    return `<article class="recurring-card ${item.active ? '' : 'recurring-inactive'}"><div class="recurring-card-top"><div class="recurring-card-title"><div class="recurring-card-icon" style="background:${safeColor(category.color)}1b">${escapeHtml(category.icon)}</div><div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(category.name)} · ${frequencyLabel(item.frequency)}</p></div></div><div class="recurring-price">${formatMoney(item.amount)}</div></div><div class="recurring-meta"><span class="status-label ${item.active ? '' : 'paused'}">${item.active ? 'Активен' : 'На паузе'}</span><span>Следующий платеж: <strong>${formatDate(nextDate, { short: true })}</strong></span></div><div class="recurring-card-actions"><button class="button button-soft" data-action="mark-recurring" data-id="${escapeHtml(item.id)}" ${item.active ? '' : 'disabled'}>✓ Учесть платеж</button><button class="button button-outline" data-action="toggle-recurring" data-id="${escapeHtml(item.id)}">${item.active ? 'Пауза' : 'Возобновить'}</button><button class="mini-action" data-action="edit-recurring" data-id="${escapeHtml(item.id)}" aria-label="Редактировать">✎</button><button class="mini-action" data-action="delete-recurring" data-id="${escapeHtml(item.id)}" aria-label="Удалить">×</button></div></article>`;
  }).join('');
  $('#recurringEmpty').classList.toggle('hidden', state.recurring.length > 0);
  $('#recurringList').classList.toggle('hidden', state.recurring.length === 0);
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  $$('.modal-backdrop.open').forEach(open => open.classList.remove('open'));
  modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false');
  const focusTarget = modal.querySelector('input:not([type="hidden"]), select, button');
  if (focusTarget) setTimeout(() => focusTarget.focus(), 30);
}
function closeModal() {
  $$('.modal-backdrop.open').forEach(modal => { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); });
}
function setTransactionType(type) {
  currentTransactionType = type === 'income' ? 'income' : 'expense';
  $$('.type-option').forEach(button => button.classList.toggle('active', button.dataset.transactionType === currentTransactionType));
  populateCategorySelect($('#transactionCategory'), currentTransactionType);
}
function renderItemRows(items = []) {
  const host = $('#itemRows');
  if (!host) return;
  host.innerHTML = '';
  items.forEach(item => addItemRow(item.name, item.amount));
  updateItemsTotal();
}
function productEmoji(name = '') {
  const value = String(name).toLocaleLowerCase('ru');
  const map = [
    [/огур|зелень|салат|брокколи/, '🥒'], [/помидор|томат/, '🍅'], [/молок|кефир|йогурт/, '🥛'],
    [/хлеб|батон|булоч/, '🍞'], [/яйц/, '🥚'], [/яблок/, '🍎'], [/банан/, '🍌'],
    [/сыр/, '🧀'], [/мяс|куриц|говядин|свинин/, '🥩'], [/рыб|лосос/, '🐟'],
    [/кофе/, '☕'], [/вода|напит|сок/, '🥤'], [/рис|греч|макарон|круп/, '🍚'],
    [/бензин|топлив/, '⛽'], [/такси|автобус|метро|проезд/, '🚕'],
    [/аптек|лекарств|витамин/, '💊'], [/книг/, '📚'], [/одежд|футболк|обув/, '👕']
  ];
  const match = map.find(([pattern]) => pattern.test(value));
  return match ? match[1] : '🛒';
}
function addItemRow(name = '', amount = '') {
  const host = $('#itemRows');
  const row = document.createElement('div'); row.className = 'item-row';
  row.innerHTML = '<span class="item-product-icon" aria-hidden="true">🛒</span><input class="item-name" type="text" maxlength="60" placeholder="Название товара"><div class="item-price-wrap"><input class="item-amount" type="number" min="0.01" step="0.01" placeholder="0"><span>₽</span></div><button type="button" class="item-remove" aria-label="Удалить товар">×</button>';
  row.querySelector('.item-name').value = name;
  row.querySelector('.item-product-icon').textContent = productEmoji(name);
  row.querySelector('.item-amount').value = amount;
  host.appendChild(row);
}
function updateItemsTotal() {
  const rows = [...document.querySelectorAll('.item-row')];
  const total = rows.reduce((sum, row) => sum + (Number(row.querySelector('.item-amount').value) || 0), 0);
  const hasItems = rows.some(row => row.querySelector('.item-name').value.trim() && Number(row.querySelector('.item-amount').value) > 0);
  $('#itemsTotal').textContent = hasItems ? `Итого по товарам: ${formatMoney(total)} — сумма операции будет рассчитана автоматически` : 'Добавьте товары: сумма операции рассчитается автоматически';
  if (hasItems) $('#transactionAmount').value = total.toFixed(2);
}

function openTransactionModal(transaction = null) {
  $('#transactionForm').reset();
  $('#transactionId').value = transaction?.id || '';
  $('#transactionModalTitle').textContent = transaction ? 'Редактировать операцию' : 'Добавить операцию';
  setTransactionType(transaction?.type || 'expense');
  populateCategorySelect($('#transactionCategory'), transaction?.type || 'expense', transaction?.categoryId);
  $('#transactionAmount').value = transaction ? transaction.amount : '';
  $('#transactionDate').value = transaction?.date || today;
  $('#transactionTime').value = transaction?.time || new Date().toTimeString().slice(0,5);
  $('#transactionNote').value = transaction?.note || '';
  renderItemRows(transaction?.items || []);
  $('#amountCurrency').textContent = CURRENCY_SYMBOLS[state.currency] || state.currency;
  openModal('transactionModal');
}
function openRecurringModal(item = null) {
  $('#recurringForm').reset();
  $('#recurringId').value = item?.id || '';
  $('#recurringModalTitle').textContent = item ? 'Редактировать платеж' : 'Добавить платеж';
  populateCategorySelect($('#recurringCategory'), 'expense', item?.categoryId || 'home');
  $('#recurringName').value = item?.name || '';
  $('#recurringAmount').value = item?.amount ?? '';
  $('#recurringFrequency').value = item?.frequency || 'monthly';
  $('#recurringNextDate').value = item?.nextDate || shiftDate(today, 30);
  $('#recurringCurrency').textContent = CURRENCY_SYMBOLS[state.currency] || state.currency;
  openModal('recurringModal');
}
function openCategoryModal(category = null) {
  $('#categoryForm').reset();
  $('#categoryId').value = category?.id || '';
  $('#categoryModalTitle').textContent = category ? 'Редактировать категорию' : 'Новая категория';
  $('#categoryName').value = category?.name || '';
  $('#categoryType').value = category?.type || 'expense';
  $('#categoryType').disabled = Boolean(category);
  $('#categoryIcon').value = category?.icon || '✦';
  $('#categoryColor').value = category?.color || PALETTE[0];
  openModal('categoryModal');
}

function handleTransactionSubmit(event) {
  event.preventDefault();
  try {
    const id = $('#transactionId').value;
    const allRows = [...document.querySelectorAll('.item-row')];
    const itemRows = allRows.map(row => ({
      name: row.querySelector('.item-name').value.trim(),
      amount: Number(row.querySelector('.item-amount').value)
    })).filter(item => item.name && Number.isFinite(item.amount) && item.amount > 0);

    const hasHalfFilledRows = allRows.some(row => {
      const name = row.querySelector('.item-name').value.trim();
      const rawAmount = row.querySelector('.item-amount').value.trim();
      return (name && !rawAmount) || (!name && rawAmount);
    });
    if (hasHalfFilledRows) {
      showToast('Заполните название и цену каждого товара или удалите пустую строку.');
      return;
    }

    const itemTotal = itemRows.reduce((sum, item) => sum + item.amount, 0);
    const amountInput = $('#transactionAmount');
    const amount = itemRows.length ? itemTotal : Number(amountInput.value);
    if (itemRows.length) amountInput.value = itemTotal.toFixed(2);

    const categoryId = $('#transactionCategory').value;
    const date = $('#transactionDate').value;
    const time = $('#transactionTime').value || new Date().toTimeString().slice(0, 5);

    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('Укажите сумму операции или добавьте товары с ценами.');
      amountInput.focus();
      return;
    }
    if (!date || !categoryId || !state.categories.some(c => c.id === categoryId && c.type === currentTransactionType)) {
      showToast('Выберите категорию и дату операции.');
      return;
    }

    const record = {
      id: id || makeId('tx'),
      type: currentTransactionType,
      amount,
      categoryId,
      date,
      time,
      note: $('#transactionNote').value.trim().slice(0, 90),
      items: itemRows
    };
    const index = state.transactions.findIndex(t => t.id === id);
    if (index >= 0) state.transactions[index] = record;
    else state.transactions.push(record);

    saveState();
    closeModal();
    renderAll();
    showToast(index >= 0 ? 'Операция обновлена.' : 'Расход успешно добавлен.');
  } catch (error) {
    console.error('Ошибка сохранения операции:', error);
    showToast('Не удалось сохранить операцию. Проверьте заполнение полей и попробуйте ещё раз.');
  }
}
function handleRecurringSubmit(event) {
  event.preventDefault();
  const id = $('#recurringId').value;
  const amount = Number($('#recurringAmount').value);
  const name = $('#recurringName').value.trim();
  const categoryId = $('#recurringCategory').value;
  const nextDate = $('#recurringNextDate').value;
  if (!name || !Number.isFinite(amount) || amount <= 0 || !nextDate || !state.categories.some(c => c.id === categoryId && c.type === 'expense')) {
    showToast('Проверьте название, сумму, категорию и дату.'); return;
  }
  const existing = state.recurring.find(item => item.id === id);
  const item = { id: id || makeId('rec'), name, amount, categoryId, frequency: $('#recurringFrequency').value, nextDate, dayOfMonth: existing?.dayOfMonth || parseLocalDate(nextDate).getDate(), active: existing?.active ?? true };
  const index = state.recurring.findIndex(r => r.id === id);
  if (index >= 0) state.recurring[index] = item; else state.recurring.push(item);
  saveState(); closeModal(); renderAll(); showToast(index >= 0 ? 'Платеж обновлен.' : 'Регулярный платеж добавлен.');
}
function handleCategorySubmit(event) {
  event.preventDefault();
  const id = $('#categoryId').value;
  const name = $('#categoryName').value.trim();
  const type = $('#categoryType').value;
  const icon = $('#categoryIcon').value.trim() || '✦';
  const color = safeColor($('#categoryColor').value);
  if (!name) { showToast('Введите название категории.'); return; }
  const duplicate = state.categories.some(category => category.type === type && category.name.toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru') && category.id !== id);
  if (duplicate) { showToast('Такая категория уже существует.'); return; }
  if (id) {
    const category = state.categories.find(c => c.id === id);
    if (category) Object.assign(category, { name, icon, color });
  } else {
    state.categories.push({ id: makeId('cat'), name, icon, color, type, isDefault: false });
  }
  saveState(); closeModal(); renderAll(); showToast(id ? 'Категория обновлена.' : 'Категория добавлена.');
}

function deleteTransaction(id) {
  const transaction = state.transactions.find(t => t.id === id);
  if (!transaction) return;
  if (!window.confirm('Удалить эту операцию?')) return;
  state.transactions = state.transactions.filter(t => t.id !== id);
  saveState(); renderAll(); showToast('Операция удалена.');
}
function deleteRecurring(id) {
  if (!window.confirm('Удалить регулярный платеж?')) return;
  state.recurring = state.recurring.filter(item => item.id !== id);
  saveState(); renderAll(); showToast('Платеж удален.');
}
function deleteCategory(id) {
  const category = state.categories.find(c => c.id === id);
  if (!category || category.isDefault) return;
  if (!window.confirm(`Удалить категорию «${category.name}»? Связанные записи будут перенесены в категорию «Другое».`)) return;
  const fallbackId = category.type === 'income' ? 'other-income' : 'other-expense';
  state.transactions.forEach(t => { if (t.categoryId === id) t.categoryId = fallbackId; });
  state.recurring.forEach(r => { if (r.categoryId === id) r.categoryId = 'other-expense'; });
  state.categories = state.categories.filter(c => c.id !== id);
  saveState(); renderAll(); showToast('Категория удалена.');
}
function markRecurring(id) {
  const item = state.recurring.find(r => r.id === id);
  if (!item || !item.active) return;
  const category = getCategory(item.categoryId);
  state.transactions.push({ id: makeId('tx'), type: 'expense', amount: item.amount, categoryId: item.categoryId, date: today, note: item.name });
  let nextDate = item.nextDate;
  let attempts = 0;
  do { nextDate = addRecurrenceDate(nextDate, item.frequency, item.dayOfMonth); attempts++; } while (nextDate <= today && attempts < 120);
  item.nextDate = nextDate;
  saveState(); renderAll(); showToast(`Платеж «${item.name}» учтен.`);
}
function toggleRecurring(id) {
  const item = state.recurring.find(r => r.id === id);
  if (!item) return;
  item.active = !item.active;
  saveState(); renderAll(); showToast(item.active ? 'Платеж возобновлен.' : 'Платеж поставлен на паузу.');
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportBackup() {
  const payload = { ...state, exportedAt: new Date().toISOString(), app: 'VELORA Finance Studio' };
  downloadFile(`velora-backup-${today}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  showToast('Резервная копия подготовлена.');
}
function csvCell(value) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }
function exportCsv() {
  const rows = [['Дата', 'Тип', 'Категория', 'Комментарий', 'Сумма', 'Валюта']];
  [...state.transactions].sort((a, b) => a.date.localeCompare(b.date)).forEach(t => {
    rows.push([t.date, t.type === 'income' ? 'Доход' : 'Расход', getCategory(t.categoryId).name, t.note, t.amount, state.currency]);
  });
  const csv = '\ufeff' + rows.map(row => row.map(csvCell).join(';')).join('\r\n');
  downloadFile(`velora-transactions-${today}.csv`, csv, 'text/csv;charset=utf-8');
  showToast('Файл CSV подготовлен.');
}
function importBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!parsed || !Array.isArray(parsed.categories) || !Array.isArray(parsed.transactions) || !Array.isArray(parsed.recurring)) throw new Error('Неверный формат');
      const previous = state;
      state = normalizeImportedState(parsed);
      if (!state.categories.length) { state = previous; throw new Error('Пустой список категорий'); }
      saveState(); renderAll(); showToast('Резервная копия успешно импортирована.');
    } catch (error) {
      console.error(error); showToast('Не удалось импортировать файл. Проверьте формат резервной копии.');
    }
    $('#backupFile').value = '';
  };
  reader.onerror = () => showToast('Не удалось прочитать файл.');
  reader.readAsText(file);
}
function normalizeImportedState(parsed) {
  return {
    version: 1,
    currency: 'RUB',
    categories: parsed.categories.map(c => ({ id: String(c.id || makeId('cat')), name: String(c.name || 'Без названия').slice(0, 30), icon: String(c.icon || '✦').slice(0, 4), color: safeColor(c.color), type: c.type === 'income' ? 'income' : 'expense', isDefault: Boolean(c.isDefault) })),
    transactions: parsed.transactions.map(t => ({ id: String(t.id || makeId('tx')), type: t.type === 'income' ? 'income' : 'expense', amount: Math.max(0, Number(t.amount) || 0), categoryId: String(t.categoryId || 'other-expense'), date: /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : today, time: /^\d{2}:\d{2}$/.test(t.time || '') ? t.time : '12:00', note: String(t.note || '').slice(0, 90), items: Array.isArray(t.items) ? t.items.map(i => ({ name: String(i.name || '').slice(0,60), amount: Math.max(0, Number(i.amount)||0) })).filter(i => i.name && i.amount > 0) : [] })),
    recurring: parsed.recurring.map(r => ({ id: String(r.id || makeId('rec')), name: String(r.name || 'Платеж').slice(0, 60), amount: Math.max(0, Number(r.amount) || 0), categoryId: String(r.categoryId || 'home'), frequency: ['weekly', 'monthly', 'yearly'].includes(r.frequency) ? r.frequency : 'monthly', nextDate: /^\d{4}-\d{2}-\d{2}$/.test(r.nextDate) ? r.nextDate : today, dayOfMonth: Math.min(31, Math.max(1, Number(r.dayOfMonth) || 1)), active: r.active !== false }))
  };
}

function renderAll() {
  $('#todayLabel').textContent = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date()).replace('.', '');
  $('#currencySelect').value = state.currency;
  $('#amountCurrency').textContent = CURRENCY_SYMBOLS[state.currency] || state.currency;
  $('#recurringCurrency').textContent = CURRENCY_SYMBOLS[state.currency] || state.currency;
  refreshCategoryFilters();
  renderOverview();
  renderTransactionsPage();
  renderRecurring();
  renderCategories();
}

// Navigation and delegated actions.
document.addEventListener('click', event => {
  const viewButton = event.target.closest('[data-view]');
  if (viewButton) { setView(viewButton.dataset.view); return; }
  const monthShift = event.target.closest('[data-month-shift]');
  if (monthShift) { selectedMonth.setMonth(selectedMonth.getMonth() + Number(monthShift.dataset.monthShift)); setPeriod('month'); return; }
  if (event.target.closest('[data-month-current]')) { selectedMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12); setPeriod('month'); return; }
  const periodButton = event.target.closest('[data-period]');
  if (periodButton) { setPeriod(periodButton.dataset.period); return; }
  const typeButton = event.target.closest('[data-transaction-type]');
  if (typeButton) { setTransactionType(typeButton.dataset.transactionType); return; }
  const themeButton = event.target.closest('[data-theme-toggle]');
  if (themeButton) {
    const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem(THEME_KEY, nextTheme);
    themeButton.textContent = nextTheme === 'dark' ? '☀ Включить светлую тему' : '☾ Включить тёмную тему';
    return;
  }
  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) return;
  const { action, id } = actionButton.dataset;
  switch (action) {
    case 'add-transaction': openTransactionModal(); break;
    case 'add-recurring': openRecurringModal(); break;
    case 'add-category': openCategoryModal(); break;
    case 'close-modal': closeModal(); break;
    case 'edit-transaction': { const transaction = state.transactions.find(t => t.id === id); if (transaction) openTransactionModal(transaction); break; }
    case 'delete-transaction': deleteTransaction(id); break;
    case 'edit-recurring': { const item = state.recurring.find(r => r.id === id); if (item) openRecurringModal(item); break; }
    case 'delete-recurring': deleteRecurring(id); break;
    case 'mark-recurring': markRecurring(id); break;
    case 'toggle-recurring': toggleRecurring(id); break;
    case 'edit-category': { const category = state.categories.find(c => c.id === id); if (category) openCategoryModal(category); break; }
    case 'delete-category': deleteCategory(id); break;
    case 'export-backup': exportBackup(); break;
    case 'export-csv': exportCsv(); break;
    case 'import-backup': $('#backupFile').click(); break;
    default: break;
  }
});

$('#transactionForm').addEventListener('submit', handleTransactionSubmit);
$('#addItemRow')?.addEventListener('click', () => { addItemRow(); updateItemsTotal(); });
$('#itemRows')?.addEventListener('input', event => {
  if (event.target.classList.contains('item-name')) {
    event.target.closest('.item-row').querySelector('.item-product-icon').textContent = productEmoji(event.target.value);
  }
  updateItemsTotal();
});
$('#itemRows')?.addEventListener('click', event => { if (event.target.closest('.item-remove')) { event.target.closest('.item-row').remove(); updateItemsTotal(); } });
$('#recurringForm').addEventListener('submit', handleRecurringSubmit);
$('#categoryForm').addEventListener('submit', handleCategorySubmit);
$('#transactionSearch').addEventListener('input', renderTransactionsPage);
$('#transactionTypeFilter').addEventListener('change', renderTransactionsPage);
$('#transactionCategoryFilter').addEventListener('change', renderTransactionsPage);
$('#currencySelect').addEventListener('change', event => {
  const currency = event.target.value;
  if (!CURRENCY_SYMBOLS[currency]) return;
  state.currency = 'RUB';
  event.target.value = 'RUB';
  saveState(); renderAll(); showToast('Валюта отображения — рубли.');
});
$('#backupFile').addEventListener('change', event => importBackup(event.target.files?.[0]));
$$('.modal-backdrop').forEach(backdrop => backdrop.addEventListener('click', event => { if (event.target === backdrop) closeModal(); }));
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });
window.addEventListener('resize', () => { if (currentView === 'overview') drawCashflowChart(); });

// Start with a clean RUB workspace; existing v1 demo data is intentionally not carried over.
state.currency = 'RUB';
const savedTheme = localStorage.getItem(THEME_KEY);
document.documentElement.dataset.theme = savedTheme === 'light' ? 'light' : 'dark';
renderAll();
setView('overview');
