// ============================================================
// YANGPARUI – app.js
// Rubber Price Dashboard & Analytics
// Data source: Webhook API (n8n)
//
//   Field mapping:
//   Cup_Lump_surat       → ยางก้อนถ้วย = Cup Lump Rubber    (สุราษฎร์ธานี)
//   USS_songkhla         → ยางแผ่นดิบ  = Unsmoked Sheet/USS (สงขลา)
//   Field_Latex_songkhla → น้ำยางสด    = Field Latex         (สงขลา)
//
//   "0" values are treated as no-data and excluded.
// ============================================================

// ── Config ────────────────────────────────────────────────────
const WEBHOOK_URL       = 'https://n8n.srv1038568.hstgr.cloud/webhook/Para';
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ── State ─────────────────────────────────────────────────────
let rawData            = [];
let currentCalcType    = 'cup';  // calculator screen
let alertTypeKey       = 'cup';  // alert screen selected type
let trendTypeKey       = 'cup';  // trend screen selected type
let trendTabDays       = 7;
let trendChartInstance = null;
let alertChartInstance = null;
let lastFetchTime      = null;

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  updateClock();
  setInterval(updateClock, 1000);
  setInterval(loadData, REFRESH_INTERVAL_MS);
});

// ── Data Loading ──────────────────────────────────────────────
async function loadData() {
  showLoadingState(true);
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    rawData = Array.isArray(json) ? json : [];
    lastFetchTime = new Date();
    bootAll();
  } catch (e) {
    console.error('Webhook fetch failed:', e);
    showError(`ไม่สามารถดึงข้อมูลได้: ${e.message}`);
  } finally {
    showLoadingState(false);
  }
}

function showLoadingState(loading) {
  const heroPrice = document.getElementById('hero-price');
  if (heroPrice && loading && !rawData.length) heroPrice.textContent = 'กำลังโหลด...';
}

function showError(msg) {
  const el = document.getElementById('hero-diff');
  if (el) { el.textContent = '⚠️ ' + msg; el.style.color = '#D32F2F'; }
}

function bootAll() {
  renderHomeHero();
  renderHomeAlertBadge();
  renderPriceStrip();
  updateFetchTimestamp();
}

// ── Field Accessors ───────────────────────────────────────────
// Returns numeric value or null when "0" / missing / falsy

/** Cup Lump (ยางก้อนถ้วย) – สุราษฎร์ธานี */
function cupPrice(row) {
  const v = parseFloat(row.Cup_Lump_surat);
  return (v && v > 0) ? v : null;
}

/** Field Latex / Fresh Latex (น้ำยางสด) – สงขลา */
function latexPrice(row) {
  const v = parseFloat(row.Field_Latex_songkhla);
  return (v && v > 0) ? v : null;
}

/** Unsmoked Sheet / USS (ยางแผ่นดิบ) – สงขลา */
function sheetPrice(row) {
  const v = parseFloat(row.USS_songkhla);
  return (v && v > 0) ? v : null;
}

function priceAccessor(typeKey) {
  if (typeKey === 'cup')   return cupPrice;
  if (typeKey === 'latex') return latexPrice;
  if (typeKey === 'sheet') return sheetPrice;
  return cupPrice;
}

function getDataForType(typeKey) {
  const acc = priceAccessor(typeKey);
  return rawData.filter(r => acc(r) !== null);
}

// ── Type Info Helper ─────────────────────────────────────
function typeInfo(typeKey) {
  const map = {
    cup:   { name: 'ยางก้อนถ้วย',  market: 'สุราษฎร์ธานี', emoji: '🪣', acc: cupPrice },
    latex: { name: 'น้ำยางสด',     market: 'สงขลา',         emoji: '💧', acc: latexPrice },
    sheet: { name: 'ยางแผ่นดิบ',   market: 'สงขลา',         emoji: '🫓', acc: sheetPrice },
  };
  return map[typeKey] || map.cup;
}

// ── Utility ───────────────────────────────────────────────────
function fmt(n, dec = 2) {
  if (n == null || isNaN(n)) return '--';
  return Number(n).toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function movingAvg(arr, window) {
  return arr.map((_, i) => {
    if (i < window - 1) return null;
    const slice = arr.slice(i - window + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / window;
  });
}

function stdDev(arr) {
  if (!arr.length) return 0;
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.map(v => (v - avg) ** 2).reduce((a, b) => a + b, 0) / arr.length);
}

function shortDate(dateStr) {
  // "25/6/2569" → "25/6"
  return dateStr ? dateStr.replace(/\/25\d\d$/, '') : dateStr;
}

// ── Clock ─────────────────────────────────────────────────────
function updateClock() {
  const now  = new Date();
  const days = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
  const d    = now.getDate();
  const m    = now.getMonth() + 1;
  const y    = now.getFullYear() + 543;
  const h    = String(now.getHours()).padStart(2, '0');
  const mn   = String(now.getMinutes()).padStart(2, '0');
  const s    = String(now.getSeconds()).padStart(2, '0');
  setText('home-datetime', `${days[now.getDay()]} ${d}/${m}/${y} · ${h}:${mn}:${s} น.`);
}

function updateFetchTimestamp() {
  if (!lastFetchTime) return;
  const h  = String(lastFetchTime.getHours()).padStart(2, '0');
  const mn = String(lastFetchTime.getMinutes()).padStart(2, '0');
  setText('price-update-time', `${h}:${mn} น.`);
}

// ── Navigation ────────────────────────────────────────────────
function navigate(target) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${target}`).classList.add('active');
  window.scrollTo(0, 0);

  if (target === 'price')  renderPriceScreen();
  if (target === 'alert')  renderAlertScreen();
  if (target === 'calc')   renderCalcScreen();
  if (target === 'trend')  renderTrendScreen(trendTabDays);
  // tips screen has no dynamic data to render
}

// ── HOME: Hero card (Cup Lump · สุราษฎร์ธานี) ────────────────
function renderHomeHero() {
  const data = getDataForType('cup');
  if (!data.length) { setText('hero-price', 'ไม่มีข้อมูล'); return; }

  const latest    = data[data.length - 1];
  const prev      = data.length >= 2 ? data[data.length - 2] : null;
  const price     = cupPrice(latest);
  const prevPrice = prev ? cupPrice(prev) : null;
  const diff      = prevPrice !== null ? price - prevPrice : null;

  setText('hero-price', `${fmt(price)} บาท/กก.`);
  const el = document.getElementById('hero-diff');
  if (diff !== null && el) {
    const sign  = diff > 0 ? '+' : '';
    const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '▬';
    el.textContent = `${arrow} ${sign}${fmt(diff)} บาท เทียบเมื่อวาน`;
    el.style.color  = diff > 0 ? '#2E7D32' : diff < 0 ? '#C62828' : '#757575';
  } else if (el) {
    el.textContent = 'ข้อมูลล่าสุด';
    el.style.color  = '#7A9480';
  }
}

// ── HOME: Alert Badge ─────────────────────────────────────────
function renderHomeAlertBadge() {
  const { signal } = calcAlert();
  const badge = document.getElementById('alert-badge');
  if (!badge) return;
  if (signal === 'sell') {
    badge.textContent = '🔴 ควรขาย';
    badge.className   = 'menu-badge sell';
  } else {
    badge.textContent = '🟡 รอดูสถานการณ์';
    badge.className   = 'menu-badge hold';
  }
}

// ── HOME: Price Strip (สรุปราคาทุกประเภท) ────────────────────
function renderPriceStrip() {
  renderStripItem('cup',   'sv-cup',   'sd-cup',   cupPrice);
  renderStripItem('latex', 'sv-latex', 'sd-latex', latexPrice);
  renderStripItem('sheet', 'sv-sheet', 'sd-sheet', sheetPrice);
}

function renderStripItem(typeKey, valId, diffId, acc) {
  const data   = getDataForType(typeKey);
  const valEl  = document.getElementById(valId);
  const diffEl = document.getElementById(diffId);
  if (!valEl || !diffEl) return;

  if (!data.length) {
    valEl.textContent  = 'ไม่มีข้อมูล';
    diffEl.textContent = '--';
    diffEl.className   = 'strip-diff none';
    return;
  }

  const latest    = data[data.length - 1];
  const prev      = data.length >= 2 ? data[data.length - 2] : null;
  const price     = acc(latest);
  const prevPrice = prev ? acc(prev) : null;
  const diff      = prevPrice !== null ? price - prevPrice : null;

  valEl.textContent = `${fmt(price)} บาท`;

  if (diff !== null) {
    const sign  = diff > 0 ? '+' : '';
    const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '▬';
    diffEl.textContent = `${arrow} ${sign}${fmt(diff)}`;
    diffEl.className   = `strip-diff ${diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'}`;
  } else {
    diffEl.textContent = shortDate(latest.date);
    diffEl.className   = 'strip-diff flat';
  }
}

// ── PRICE SCREEN ──────────────────────────────────────────────
function renderPriceScreen() {
  updateFetchTimestamp();
  renderPriceCard('cup',   'cup');
  renderPriceCard('latex', 'latex');
  renderPriceCard('sheet', 'sheet');
}

function renderPriceCard(typeKey, prefix) {
  const acc  = priceAccessor(typeKey);
  const data = getDataForType(typeKey);

  if (!data.length) {
    setText(`${prefix}-price`, 'ไม่มีข้อมูล');
    setText(`${prefix}-diff`, '--');
    setText(`${prefix}-yesterday`, '--');
    setText(`${prefix}-vol`, '--');
    const barEl = document.getElementById(`${prefix}-bar`);
    if (barEl) barEl.style.width = '0%';
    return;
  }

  const latest    = data[data.length - 1];
  const prev      = data.length >= 2 ? data[data.length - 2] : null;
  const price     = acc(latest);
  const prevPrice = prev ? acc(prev) : null;
  const diff      = prevPrice !== null ? price - prevPrice : null;

  setText(`${prefix}-price`, `${fmt(price)} บาท/กก.`);
  
  const diffEl = document.getElementById(`${prefix}-diff`);
  if (diffEl) {
    if (diff !== null) {
      const sign  = diff > 0 ? '+' : '';
      const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '▬';
      diffEl.textContent = `${arrow} ${sign}${fmt(diff)} บาท`;
      diffEl.className   = `pc-diff ${diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'}`;
    } else {
      diffEl.textContent = 'ข้อมูลแรก';
      diffEl.className   = 'pc-diff flat';
    }
  }

  setText(`${prefix}-yesterday`, prevPrice !== null ? `${fmt(prevPrice)} บาท/กก.` : '--');
  setText(`${prefix}-vol`, latest.date || '--');

  const prices = data.map(acc).filter(Boolean);
  const minP   = Math.min(...prices);
  const maxP   = Math.max(...prices);
  const pct    = maxP !== minP ? Math.round(((price - minP) / (maxP - minP)) * 100) : 50;
  const barEl  = document.getElementById(`${prefix}-bar`);
  if (barEl) barEl.style.width = `${pct}%`;
}

// ── ALERT SCREEN ──────────────────────────────────────────────
function selectAlertType(typeKey) {
  alertTypeKey = typeKey;
  ['cup','latex','sheet'].forEach(k => {
    const el = document.getElementById(`atab-${k}`);
    if (el) el.classList.toggle('active', k === typeKey);
  });
  renderAlertScreen();
}

function calcAlert() {
  const info   = typeInfo(alertTypeKey);
  const data   = getDataForType(alertTypeKey);
  const prices = data.map(info.acc).filter(Boolean);
  if (prices.length < 2) return { signal: 'hold', today: null, ma30: null, high: null, low: null, sd: null };

  const today  = prices[prices.length - 1];
  const last30 = prices.slice(-30);
  const ma30   = last30.reduce((a, b) => a + b, 0) / last30.length;

  return {
    signal: today > ma30 ? 'sell' : 'hold',
    today,
    ma30,
    high: Math.max(...last30),
    low:  Math.min(...last30),
    sd:   stdDev(last30)
  };
}

function renderAlertScreen() {
  const info = typeInfo(alertTypeKey);
  const { signal, today, ma30, high, low, sd } = calcAlert();
  const card = document.getElementById('alert-main-card');

  if (signal === 'sell') {
    card.className = 'alert-main-card sell-signal';
    setText('alert-icon',   '🔔');
    setText('alert-status', 'ควรขาย ตอนนี้!');
    setText('alert-desc',
      `${info.name} ${info.market} อยู่ที่ ${fmt(today)} บาท/กก.\n` +
      `สูงกว่าค่าเฉลี่ย 30 วัน (${fmt(ma30)} บาท/กก.)\n` +
      `นี่คือโอกาสทองในการขายทำกำไร!`
    );
  } else {
    card.className = 'alert-main-card hold-signal';
    setText('alert-icon',   '🕐');
    setText('alert-status', 'รอดูสถานการณ์');
    setText('alert-desc',
      `${info.name} ${info.market} อยู่ที่ ${fmt(today)} บาท/กก.\n` +
      `ต่ำกว่าค่าเฉลี่ย 30 วัน (${fmt(ma30)} บาท/กก.)\n` +
      `แนะนำให้รอราคาฟื้นตัวก่อนตัดสินใจขาย`
    );
  }

  // Compare block
  const diff = (today != null && ma30 != null) ? today - ma30 : null;
  setText('alert-today-price', today !== null ? `${fmt(today)} บาท/กก.` : '--');
  setText('alert-ma30',        ma30  !== null ? `${fmt(ma30)} บาท/กก.`  : '--');
  const diffEl = document.getElementById('alert-diff-val');
  if (diffEl && diff !== null) {
    diffEl.textContent = `${diff >= 0 ? '+' : ''}${fmt(diff)}`;
    diffEl.style.color  = diff >= 0 ? '#2E7D32' : '#C62828';
  }

  setText('stat-high', high !== null ? `${fmt(high)} บาท` : '--');
  setText('stat-low',  low  !== null ? `${fmt(low)} บาท`  : '--');
  setText('stat-avg',  ma30 !== null ? `${fmt(ma30)} บาท` : '--');
  setText('stat-vol',  sd   !== null ? `±${fmt(sd, 1)} บาท` : '--');

  renderMiniChart();
}

function renderMiniChart() {
  const info   = typeInfo(alertTypeKey);
  const data   = getDataForType(alertTypeKey);
  const last7  = data.slice(-7);
  const labels = last7.map(d => shortDate(d.date));
  const prices = last7.map(info.acc);
  const maVals = movingAvg(prices, Math.min(3, prices.length));

  // Update chart section title
  const chartTitle = document.querySelector('#screen-alert .chart-title');
  if (chartTitle) chartTitle.textContent = `📉 ราคา 7 วันล่าสุด (${info.name} · ${info.market})`;

  if (alertChartInstance) alertChartInstance.destroy();
  const ctx = document.getElementById('alert-chart').getContext('2d');
  alertChartInstance = buildLineChart(ctx, labels, prices, maVals, `${info.name} – ราคาจริง (${info.market})`);
}

// ── CALCULATOR SCREEN ─────────────────────────────────────────
// cup   = Cup Lump Rubber  (ยางก้อนถ้วย) → Cup_Lump_surat
// latex = Field Latex       (น้ำยางสด)    → Field_Latex_songkhla
// sheet = Unsmoked Sheet/USS (ยางแผ่นดิบ) → USS_songkhla

function renderCalcScreen() {
  selectType('cup');
}

function selectType(typeKey) {
  currentCalcType = typeKey;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  const map = { cup: 'tbtn-cup', latex: 'tbtn-latex', sheet: 'tbtn-sheet' };
  const el  = document.getElementById(map[typeKey]);
  if (el) el.classList.add('active');
  calculate();
}

function calculate() {
  const amount   = parseFloat(document.getElementById('calc-amount').value) || 0;
  const refPrice = parseFloat(document.getElementById('calc-ref').value);
  const acc      = priceAccessor(currentCalcType);
  const data     = getDataForType(currentCalcType);
  const today    = data.length ? acc(data[data.length - 1]) : null;

  if (today === null) { setText('res-today', 'ไม่มีข้อมูล'); return; }

  const totalToday  = amount * today;
  const diff        = !isNaN(refPrice) ? today - refPrice : null;
  const extraProfit = diff !== null ? diff * amount : null;

  setText('res-today', `${fmt(today)} บาท/กก.`);
  setText('res-ref',   !isNaN(refPrice) ? `${fmt(refPrice)} บาท/กก.` : 'ยังไม่ได้กรอก');
  setText('res-diff',  diff !== null ? `${diff >= 0 ? '+' : ''}${fmt(diff)} บาท/กก.` : '--');
  setText('res-total', `${fmt(totalToday, 0)} บาท`);
  setText('res-extra', extraProfit !== null ? `${extraProfit >= 0 ? '+' : ''}${fmt(extraProfit, 0)} บาท` : '--');

  const extraEl = document.getElementById('res-extra');
  if (extraEl && extraProfit !== null)
    extraEl.style.color = extraProfit >= 0 ? '#F9A825' : '#EF5350';

  const diffEl = document.getElementById('res-diff');
  if (diffEl && diff !== null)
    diffEl.style.color = diff >= 0 ? '#69F0AE' : '#EF5350';
}

// ── TREND SCREEN ──────────────────────────────────────────────
function selectTrendType(typeKey) {
  trendTypeKey = typeKey;
  ['cup','latex','sheet'].forEach(k => {
    const el = document.getElementById(`ttab-${k}`);
    if (el) el.classList.toggle('active', k === typeKey);
  });
  renderTrendScreen(trendTabDays);
}

function switchTab(days) {
  trendTabDays = days;
  document.getElementById('tab-7').classList.toggle('active', days === 7);
  document.getElementById('tab-30').classList.toggle('active', days === 30);
  renderTrendScreen(days);
}

function renderTrendScreen(days) {
  const info   = typeInfo(trendTypeKey);
  const data   = getDataForType(trendTypeKey);
  const sliced = data.slice(-days);
  if (!sliced.length) return;

  const labels    = sliced.map(d => shortDate(d.date));
  const prices    = sliced.map(info.acc);
  const maWin     = days === 7 ? 3 : 7;
  const maVals    = movingAvg(prices, maWin);
  const avg       = prices.reduce((a, b) => a + b, 0) / prices.length;
  const max       = Math.max(...prices);
  const min       = Math.min(...prices);
  const lastPrice = prices[prices.length - 1];
  const lastMA    = maVals[maVals.length - 1];

  const statusEl = document.getElementById('trend-status');
  if (lastMA && lastPrice > lastMA) {
    statusEl.textContent = '🟢 ควรขาย'; statusEl.style.color = '#2E7D32';
  } else {
    statusEl.textContent = '🟡 รอดู'; statusEl.style.color = '#E65100';
  }

  setText('trend-avg',  `${fmt(avg)} บาท`);
  setText('trend-high', `${fmt(max)} บาท`);
  setText('trend-low',  `${fmt(min)} บาท`);
  setText('trend-chart-title',
    `📈 กราฟราคา ${days} วัน · ${info.emoji} ${info.name} · ${info.market}`
  );

  if (trendChartInstance) trendChartInstance.destroy();
  const ctx = document.getElementById('trend-chart').getContext('2d');
  trendChartInstance = buildLineChart(ctx, labels, prices, maVals, `${info.name} – ราคาจริง (${info.market})`, days <= 10 ? 4 : 2);

  renderTechSignals(prices, maVals, days, info.name);
}

function renderTechSignals(prices, maVals, days, typeName = 'ยาง') {
  const list      = document.getElementById('tech-list');
  list.innerHTML  = '';
  const lastPrice = prices[prices.length - 1];
  const lastMA    = maVals[maVals.length - 1];
  const prevMA    = maVals[maVals.length - 2];
  const prevPrice = prices[prices.length - 2];
  const signals   = [];

  if (lastMA) {
    const pct = ((lastPrice - lastMA) / lastMA * 100).toFixed(1);
    signals.push(lastPrice > lastMA
      ? { cls: 'good',   text: `✅ ราคา${typeName}สูงกว่าค่าเฉลี่ย +${pct}% → สัญญาณขายที่ดี` }
      : { cls: 'warn',   text: `⚠️ ราคา${typeName}ต่ำกว่าค่าเฉลี่ย ${pct}% → ควรรอจังหวะดีกว่านี้` }
    );
  }

  if (prevPrice !== undefined && prevMA) {
    if (prevPrice <= prevMA && lastPrice > lastMA)
      signals.push({ cls: 'good',   text: '⭐ จุดตัดขาขึ้น: เส้นราคาตัดขึ้นเหนือค่าเฉลี่ย → แนวโน้มขาขึ้น' });
    if (prevPrice >= prevMA && lastPrice < lastMA)
      signals.push({ cls: 'danger', text: '🔻 จุดตัดขาลง: เส้นราคาตัดลงต่ำกว่าค่าเฉลี่ย → แนวโน้มขาลง' });
  }

  const sd  = stdDev(prices);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const cv  = (sd / avg * 100).toFixed(1);
  signals.push(Number(cv) > 5
    ? { cls: 'warn', text: `📊 ความผันผวนสูง (CV ${cv}%) → ควรระมัดระวัง` }
    : { cls: 'good', text: `📊 ความผันผวนต่ำ (CV ${cv}%) → ราคาเสถียร` }
  );

  signals.push({ cls: '', text: `🔺 แนวต้าน ${days} วัน: ${fmt(Math.max(...prices))} บาท/กก.` });
  signals.push({ cls: '', text: `🔻 แนวรับ ${days} วัน: ${fmt(Math.min(...prices))} บาท/กก.` });

  signals.forEach(({ cls, text }) => {
    const div       = document.createElement('div');
    div.className   = `tech-item ${cls}`;
    div.textContent = text;
    list.appendChild(div);
  });
}

// ── Chart Builder ─────────────────────────────────────────────
function buildLineChart(ctx, labels, prices, maVals, datasetLabel = 'ราคาจริง', pointRadius = 4) {
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: datasetLabel,
          data: prices,
          borderColor: '#1565C0',
          backgroundColor: 'rgba(21,101,192,0.08)',
          borderWidth: 2.5,
          pointRadius,
          pointBackgroundColor: '#1565C0',
          tension: 0.4,
          fill: true,
        },
        {
          label: 'ค่าเฉลี่ยเคลื่อนที่',
          data: maVals,
          borderColor: '#F57C00',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 0,
          tension: 0.4,
          fill: false,
        }
      ]
    },
    options: chartOptions()
  });
}

function chartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: true,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(27,77,46,0.95)',
        titleColor: '#A5D6A7',
        bodyColor: '#FFFFFF',
        padding: 12,
        cornerRadius: 10,
        callbacks: {
          label: ctx => ctx.parsed.y != null
            ? `${ctx.dataset.label}: ${fmt(ctx.parsed.y)} บาท/กก.`
            : null
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { family: 'Sarabun', size: 10 }, color: '#7A9480', maxTicksLimit: 7 },
        border: { display: false }
      },
      y: {
        grid: { color: 'rgba(76,175,80,0.08)' },
        ticks: {
          font: { family: 'Sarabun', size: 11 },
          color: '#7A9480',
          callback: v => `${v.toFixed(0)}฿`
        },
        border: { display: false }
      }
    }
  };
}

// ── DOM Helper ────────────────────────────────────────────────
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
