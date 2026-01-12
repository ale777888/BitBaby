// BitBaby - Professional Logic (Final)
// 注意：按你的要求，不改任何显示效果/主题/交互/逻辑，只新增“收益”列 + 必要bug修复

const fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function normalizeNumericString(v){
  if (v === null || v === undefined) return '';
  let s = String(v).replace(/[\s,]/g, '').trim();
  if (!s) return '';
  s = s.replace(/[^\d.\-]/g, '');
  const parts = s.split('.');
  if (parts.length > 2) s = parts[0] + '.' + parts.slice(1).join('');
  if (s.indexOf('-') > 0) s = s.replace(/-/g, '');
  return s;
}

function parseAmountToCents(v){
  const s = normalizeNumericString(v);
  if (!s || s === '-' || s === '.') return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function centsToNumber(cents){ return cents / 100; }

function setTodayIfEmpty(){
  const el = document.getElementById('tradeDate');
  if (!el.value){
    const d = new Date();
    el.value = d.toISOString().split('T')[0];
  }
}

// === 状态文案：保持你当前版本不变 ===
const STATUS = {
  hit:  { label: '达到预计收益', cls: 'status-hit'  },
  miss: { label: '未达到预计收益', cls: 'status-miss' },
  over: { label: '超额完成收益', cls: 'status-over' },
};

function statusOptions(selected){
  return Object.entries(STATUS).map(([key, meta])=>{
    return `<option value="${key}" ${key === selected ? 'selected' : ''}>${meta.label}</option>`;
  }).join('');
}

function applyStatusClass(selectEl){
  selectEl.classList.remove('status-hit','status-miss','status-over');
  const meta = STATUS[selectEl.value] || STATUS.hit;
  selectEl.classList.add(meta.cls);
}

function classifyCell(el){
  const val = parseFloat(normalizeNumericString(el.value));
  el.classList.remove('pos','neg','muted');
  if (val > 0) el.classList.add('pos');
  else if (val < 0) el.classList.add('neg');
  else el.classList.add('muted');
}

function computeFeesForRow(row){
  const amountCents = parseAmountToCents(row.querySelector('.amount-input')?.value);

  const l1 = centsToNumber(Math.round(amountCents * 0.02));
  const l2 = centsToNumber(Math.round(amountCents * 0.01));
  const l3 = centsToNumber(Math.round(amountCents * 0.005));

  const update = (cls, val) => {
    const el = row.querySelector(cls);
    if(el) {
      el.value = fmt.format(val);
      classifyCell(el);
    }
  };

  update('.fee-l1', l1);
  update('.fee-l2', l2);
  update('.fee-l3', l3);
}

// === Bug Fix #1：防止 innerHTML 注入/破坏DOM（不改变UI，只转义用户值） ===
function escapeHTML(v){
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function rowTemplate(data = {}){
  const { pair='', amount='', profit='', status='hit' } = data;

  // 保持原结构与 class，不动UI，只插入收益列，并且对 value 做转义
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input class="cell-input pair-input" placeholder="BTC/USDT" value="${escapeHTML(pair)}"></td>
    <td><input class="cell-input amount-input" inputmode="decimal" placeholder="0.00" value="${escapeHTML(amount)}"></td>
    <td><input class="cell-input fee-input fee-l1" readonly tabindex="-1" value="0.00"></td>
    <td><input class="cell-input fee-input fee-l2" readonly tabindex="-1" value="0.00"></td>
    <td><input class="cell-input fee-input fee-l3" readonly tabindex="-1" value="0.00"></td>
    <td><input class="cell-input profit-input" inputmode="decimal" placeholder="0.00" value="${escapeHTML(profit)}"></td>
    <td class="status-col">
      <select class="status-select status-input">
        ${statusOptions(status)}
      </select>
    </td>
    <td class="action-col">
      <button class="btn small danger del-btn" tabindex="-1">×</button>
    </td>
  `;

  const sel = tr.querySelector('.status-input');
  applyStatusClass(sel);

  // 返佣计算逻辑不变
  computeFeesForRow(tr);

  return tr;
}

function refreshTotals(){
  const rows = [...document.querySelectorAll('#tbody tr')];
  let s1=0, s2=0, s3=0;

  rows.forEach(r=>{
    s1 += parseAmountToCents(r.querySelector('.fee-l1')?.value);
    s2 += parseAmountToCents(r.querySelector('.fee-l2')?.value);
    s3 += parseAmountToCents(r.querySelector('.fee-l3')?.value);
  });

  const updateSum = (id, cents) => {
    const val = centsToNumber(cents);
    const el = document.getElementById(id);
    if(el) {
      el.textContent = `${fmt.format(val)} U`;
      el.className = `footer-value ${val > 0 ? 'pos' : (val < 0 ? 'neg' : 'muted')}`;
    }
  };

  updateSum('bottomL1', s1);
  updateSum('bottomL2', s2);
  updateSum('bottomL3', s3);

  debouncedAutoSave();
}

let timeout;
function debouncedAutoSave(){
  clearTimeout(timeout);
  timeout = setTimeout(autoSave, 500);
}

function bindEvents(){
  const tbody = document.getElementById('tbody');

  tbody.addEventListener('input', (e)=>{
    if (e.target.classList.contains('amount-input')){
      computeFeesForRow(e.target.closest('tr'));
      refreshTotals();
    } else {
      // 收益/币种等输入：仅保存，不改变任何额外表现
      debouncedAutoSave();
    }
  });

  tbody.addEventListener('change', (e)=>{
    if (e.target.classList.contains('status-input')){
      applyStatusClass(e.target);
      debouncedAutoSave();
    }
  });

  tbody.addEventListener('click', (e)=>{
    if(e.target.classList.contains('del-btn')){
      e.target.closest('tr').remove();
      refreshTotals();
    }
  });

  document.getElementById('addRow').addEventListener('click', ()=>{
    tbody.appendChild(rowTemplate());
    refreshTotals();
  });

  document.getElementById('resetDemo').addEventListener('click', ()=>{
    if(confirm('重置数据？')) loadDemo();
  });

  document.getElementById('exportCSV').addEventListener('click', exportCSV);
  document.getElementById('savePNG').addEventListener('click', savePNG);
  document.getElementById('tradeDate').addEventListener('input', debouncedAutoSave);
}

// 导出修正：确保居中和样式统一（保持你当前逻辑）
function replaceInputsForExport(root){
  root.querySelectorAll('input.cell-input').forEach(inp=>{
    const div = document.createElement('div');
    div.className = inp.className.replace('cell-input', 'export-text');
    div.textContent = inp.value || '—';
    if(inp.classList.contains('pos')) div.classList.add('pos');
    if(inp.classList.contains('neg')) div.classList.add('neg');
    div.style.justifyContent = 'center';
    div.style.textAlign = 'center';
    inp.replaceWith(div);
  });

  root.querySelectorAll('select.status-input').forEach(sel=>{
    const meta = STATUS[sel.value] || STATUS.hit;
    const div = document.createElement('div');
    div.className = `status-select ${meta.cls} status-export`;
    div.textContent = meta.label;
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.justifyContent = 'center';
    sel.replaceWith(div);
  });

  const dateInp = root.querySelector('#tradeDate');
  if(dateInp){
    const div = document.createElement('div');
    div.className = 'bb-date-input-v8';
    div.textContent = dateInp.value || 'DATE';
    div.style.display = 'flex';
    div.style.justifyContent = 'center';
    div.style.alignItems = 'center';
    div.style.border = '1px solid rgba(255,255,255,0.1)';
    dateInp.replaceWith(div);
  }
}

async function savePNG(){
  const panel = document.getElementById('capturePanel');
  if (!window.html2canvas) return alert('Library Missing');

  const clone = panel.cloneNode(true);

  // 复制 input/select 的值 —— 新增收益列后数量仍匹配
  const srcInputs = panel.querySelectorAll('input, select');
  const dstInputs = clone.querySelectorAll('input, select');
  srcInputs.forEach((el, i) => { if(dstInputs[i]) dstInputs[i].value = el.value; });

  // 移除操作列（按钮列）—— 仍按最后一列移除
  clone.querySelectorAll('button').forEach(b=>b.remove());
  const ths = clone.querySelectorAll('th');
  if(ths.length) ths[ths.length-1].remove();
  clone.querySelectorAll('tr').forEach(tr=>{
    const tds = tr.querySelectorAll('td');
    if(tds.length) tds[tds.length-1].remove();
  });

  replaceInputsForExport(clone);

  const wrap = document.createElement('div');
  wrap.style.cssText = `position:fixed; top:0; left:-9999px; width:${panel.offsetWidth}px`;
  wrap.appendChild(clone);
  document.body.appendChild(wrap);

  try{
    const canvas = await html2canvas(clone, {
      backgroundColor: '#101010',
      scale: 3,
      useCORS: true
    });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `BitBaby_PnL_${new Date().getTime()}.png`;
    a.click();
  }finally{
    wrap.remove();
  }
}

// === Bug Fix #2：CSV 导出标准转义（不改变按钮/流程/文件名） ===
function csvEscape(v){
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCSV(){
  const rows = [...document.querySelectorAll('#tbody tr')].map(r => {
    return [...r.querySelectorAll('input, select')].map(i => i.value);
  });

  // 增加 Profit 列（收益），其余不变
  const header = ["Pair","Amount","L1","L2","L3","Profit","Status"];
  const lines = [
    header.map(csvEscape).join(","),
    ...rows.map(cols => cols.map(csvEscape).join(","))
  ].join("\n");

  // 保持原 data:text/csv 下载方式（尽量不改变行为）
  const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(lines);
  const link = document.createElement("a");
  link.setAttribute("href", csvContent);
  link.setAttribute("download", "data.csv");
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function loadDemo(){
  // 仅增加 profit 字段，其他不变
  const demo = [
    {pair:'ETH/USDT', amount:'5000', profit:'', status:'hit'},
    {pair:'SOL/USDT', amount:'1200', profit:'', status:'over'},
    {pair:'DOGE/USDT',amount:'800',  profit:'', status:'miss'},
  ];
  const tbody = document.getElementById('tbody');
  tbody.innerHTML = '';
  demo.forEach(d => tbody.appendChild(rowTemplate(d)));
  refreshTotals();
}

function autoSave(){
  const rows = [...document.querySelectorAll('#tbody tr')].map(r=>({
    pair: r.querySelector('.pair-input')?.value || '',
    amount: r.querySelector('.amount-input')?.value || '',
    profit: r.querySelector('.profit-input')?.value || '',
    status: r.querySelector('.status-input')?.value || 'hit'
  }));
  localStorage.setItem('bb_v7', JSON.stringify({
    date: document.getElementById('tradeDate').value,
    rows
  }));
}

function init(){
  setTodayIfEmpty();
  bindEvents();

  const raw = localStorage.getItem('bb_v7');
  if(raw){
    try{
      const d = JSON.parse(raw);
      if(d.date) document.getElementById('tradeDate').value = d.date;

      const tbody = document.getElementById('tbody');
      tbody.innerHTML = '';

      // === Bug Fix #3：兼容旧存储（profit 缺失时补空）===
      const rows = Array.isArray(d?.rows) ? d.rows : [];
      rows.forEach(r => {
        if (r && typeof r === 'object' && !('profit' in r)) r.profit = '';
        tbody.appendChild(rowTemplate(r || {}));
      });

      refreshTotals();
    }catch(e){
      loadDemo();
    }
  } else {
    loadDemo();
  }
}

document.addEventListener('DOMContentLoaded', init);
