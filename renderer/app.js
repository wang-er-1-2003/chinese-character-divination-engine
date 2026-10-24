// SPDX-License-Identifier: MIT
// Copyright (c) 2026 wang-er-1-2003
// 测字引擎子件 - 渲染层
'use strict';

let DATA = null; // {dict, midie, dispatch, renzi, zichu}
const $ = (id) => document.getElementById(id);

init();

async function init() {
  DATA = await window.cezi.data();
  if (!DATA || !DATA.ok) {
    $('empty-hint').textContent = '数据加载失败，请检查 engine/data 目录。';
    return;
  }
  buildChaifaIndex();
  parseTanyuan();
  parseLiba();
  parseZihua();
  fillGzSelect();
  bindEvents();
  renderRules('midie');
  renderSideDefault();
  $('char-input').focus();
}

// —— 右侧常驻面板：部件反查 + 最近查询 ——
function renderSideDefault() {
  const d = $('detail');
  let hist = [];
  try { hist = JSON.parse(localStorage.getItem('cezi_history') || '[]'); } catch (e) {}
  d.innerHTML = `
    <h2>部件反查 <span style="font-size:11px;color:#7a6a98;font-weight:400;">输入部件/部首 → 列出所有含它的字</span></h2>
    <div class="gzl-row" style="margin-bottom:10px;">
      <input id="part-input" type="text" maxlength="1" placeholder="如：圭 / 因 / 木 / 隹…" style="flex:1;min-width:0;">
      <button class="btn" id="part-btn">反查</button>
    </div>
    <div id="part-out" style="font-size:13px;line-height:1.8;"></div>
    <h3>最近查询 <span style="font-size:11px;color:#7a6a98;font-weight:400;">点击回查</span></h3>
    <div id="side-recent">${hist.length ? hist.slice(0, 10).map(h =>
      `<div class="recent-item"><span class="k">${h.q}</span> · ${h.t} · ${h.hits} 条</div>`).join('')
      : '<p style="color:#7a6a98;font-size:12px;">暂无。测过的字会自动出现在这里。</p>'}</div>`;
  $('part-btn').addEventListener('click', runPart);
  $('part-input').addEventListener('keydown', e => { if (e.key === 'Enter') runPart(); });
  d.querySelectorAll('.recent-item').forEach(el => el.addEventListener('click', () => queryChar(el.querySelector('.k').textContent)));
  const bi = $('btn-query'); if (bi) bi.focus && bi.blur();
}

function queryChar(c) {
  $('char-input').value = c;
  doQuery();
}

function runPart() {
  const p = ($('part-input').value || '').trim();
  const out = $('part-out');
  if (!p) { out.textContent = '请输入部件（一个字）。'; return; }
  const ws = (DATA.rev_decomp || {})[p] || [];
  if (!ws.length) {
    out.innerHTML = `<span style="color:#a89ac2;">「${p}」不在部件索引中（可能是整字部件或未收录）。试试圭/因/木/隹/火。</span>`;
    return;
  }
  out.innerHTML = `<span class="k" style="color:#ffd9a0;">「${p}」</span> 共 ${ws.length} 字（显示前 30，点击进查字）：<br>` +
    ws.slice(0, 30).map(w => {
      const n = partVerdicts(w).length;
      return `<span class="part-w" data-w="${w}">${w}<span class="tag">${n}条</span></span>`;
    }).join(' ');
  out.querySelectorAll('.part-w').forEach(el => el.addEventListener('click', () => queryChar(el.dataset.w)));
}

// —— 计算索引：秘牒十法/六法例字反向索引（字 → 该字在各法中的拆法变换）——
let CHAIFA = null; // Map<char, [{method, base, expand}[]]>
function buildChaifaIndex() {
  CHAIFA = new Map();
  (DATA.midie.methods || []).forEach(m => {
    (m.examples || []).forEach(ex => {
      const base = ex.base;
      const expands = ex.expand.split(/[、，,；;]/).filter(Boolean);
      const rec = { method: m.title, base, expand: ex.expand };
      if (!CHAIFA.has(base)) CHAIFA.set(base, []);
      CHAIFA.get(base).push(rec);
      expands.forEach(e => {
        if (e === base) return;
        if (!CHAIFA.has(e)) CHAIFA.set(e, []);
        CHAIFA.get(e).push({ method: m.title, base, expand: ex.expand, via: '（由' + base + '得）' });
      });
    });
  });
}

// —— 计算索引：探元赋逐字取象（X字者，乃…也）——
let TANYUAN = null; // [{char, xiang}]
function parseTanyuan() {
  const sec = (DATA.dispatch.sections || []).find(s => s.name.includes('探元赋'));
  if (!sec) return;
  TANYUAN = [];
  const re = /([一-龥]{1,2})字者，?乃([^。]+)。/g;
  let m;
  while ((m = re.exec(sec.text))) {
    TANYUAN.push({ char: m[1], xiang: m[2].trim() });
  }
}

// —— 立八卦断宫位规则（乾/坤/…宫 → 笔画像 → 断语）——
let LIBAROWS = null;
function parseLiba() {
  const sec = (DATA.dispatch.sections || []).find(s => s.name.includes('立八卦断'));
  LIBAROWS = [];
  if (!sec) return;
  const re = /([乾坤震巽坎离艮兑])(?:宫|位|是|为)([^，。]{2,12})[，。]([^。]{2,30})。/g;
  let m;
  while ((m = re.exec(sec.text))) LIBAROWS.push({ g: m[1], x: m[2], d: m[3] });
}

// —— 字画经验可读条目（OCR 部分损坏，白名单提取：人工从原文确认的条目字）——
const ZIHUA_CHARS = ['家', '空', '荆', '砚', '典', '果', '马', '来', '但', '谦', '达', '奇', '城', '池', '春', '益', '田'];
let ZIHUA = null;
function parseZihua() {
  const sec = (DATA.dispatch.sections || []).find(s => s.name.includes('字画经验'));
  ZIHUA = [];
  if (!sec) return;
  ZIHUA_CHARS.forEach(c => {
    const idx = sec.text.indexOf(c + '字');
    if (idx < 0) return;
    const seg = sec.text.slice(idx, idx + 60).split(/[。！]/)[0];
    if (seg.length > 3) ZIHUA.push({ head: c + '字', text: seg });
  });
}

function bindEvents() {
  $('btn-query').addEventListener('click', doQuery);
  $('char-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') doQuery(); });
  $('btn-random').addEventListener('click', () => {
    const es = DATA.dict.entries || [];
    const e = es[Math.floor(Math.random() * es.length)];
    $('char-input').value = e['条目字'] || '';
    doQuery();
  });
  $('btn-tuilian').addEventListener('click', () => {
    const raw = $('char-input').value.trim();
    const c = Array.from(raw.replace(/[\s，。,.！？!?、；;：:""''（）()]/g, ''))[0];
    if (c) renderTuilian(c);
  });
  $('gz-select').addEventListener('change', (e) => showGz(e.target.value));
  document.querySelectorAll('.rtab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.rtab').forEach(x => x.classList.remove('on'));
    t.classList.add('on');
    renderRules(t.dataset.rt);
  }));
  const rs = $('rule-search');
  rs.addEventListener('input', () => filterRuleBody(rs.value.trim()));
}

/* ---------- 查字 ---------- */
function doQuery() {
  const raw = $('char-input').value.trim();
  if (!raw) return;
  const chars = Array.from(raw.replace(/[\s，。,.！？!?、；;：:""''（）()]/g, ''));
  const seen = new Set();
  const blocks = [];
  for (const c of chars) {
    if (seen.has(c)) continue;
    seen.add(c);
    blocks.push(lookupChar(c));
  }
  lastRaw = raw;
  lastBlocks = blocks;
  recordHistory(raw, blocks);
  refreshSideRecent();
  renderResults(blocks, raw);
}

// 查字后刷新右侧「最近查询」列表（仅在右侧处于常驻面板时）
function refreshSideRecent() {
  const host = $('side-recent');
  if (!host || $('side-back')) return;   // 被详情覆盖时不刷
  let hist = [];
  try { hist = JSON.parse(localStorage.getItem('cezi_history') || '[]'); } catch (e) {}
  host.innerHTML = hist.length ? hist.slice(0, 10).map(h =>
    `<div class="recent-item"><span class="k">${h.q}</span> · ${h.t} · ${h.hits} 条</div>`).join('')
    : '<p style="color:#7a6a98;font-size:12px;">暂无。测过的字会自动出现在这里。</p>';
  host.querySelectorAll('.recent-item').forEach(el => el.addEventListener('click', () => queryChar(el.querySelector('.k').textContent)));
}

function recordHistory(raw, blocks) {
  try {
    const total = blocks.reduce((s, b) => s + b.exact.length + b.quge.length + b.zazhan.length + b.chaifa.length + b.tanyuan.length + b.renzi.length + b.stories.length, 0);
    const list = JSON.parse(localStorage.getItem('cezi_history') || '[]');
    list.unshift({ t: new Date().toLocaleString('zh-CN', { hour12: false }), q: raw, hits: total });
    localStorage.setItem('cezi_history', JSON.stringify(list.slice(0, 50)));
  } catch (e) { /* ignore */ }
}

function renderHistory(body) {
  let list = [];
  try { list = JSON.parse(localStorage.getItem('cezi_history') || '[]'); } catch (e) {}
  let html = '<h4>查字历史</h4><div class="src">最近 50 次（本地 localStorage）。点击回填重查。</div>';
  if (!list.length) html += '<div class="c">暂无记录。测过的字会自动出现在这里。</div>';
  html += list.map((h, i) =>
    `<div class="item" data-sec="hist-${i}"><span class="k">${h.q}</span> · ${h.t} · ${h.hits} 条命中</div>`).join('');
  html += list.length ? '<div style="margin-top:10px;"><button class="btn ghost" id="btn-clear-hist">清空历史</button></div>' : '';
  body.innerHTML = html;
  body.querySelectorAll('.item[data-sec^="hist-"]').forEach(it => it.addEventListener('click', () => {
    const i = +it.dataset.sec.split('-')[1];
    $('char-input').value = list[i].q;
    doQuery();
  }));
  const cb = $('btn-clear-hist');
  if (cb) cb.addEventListener('click', () => { localStorage.removeItem('cezi_history'); renderHistory(body); });
}

function verdictClass(v) {
  if (!v) return 'unknown';
  if (v.includes('吉') && !v.includes('凶')) return '';
  if (v.includes('凶')) return 'bad';
  if (v.includes('中')) return 'mid';
  return 'unknown';
}

function lookupChar(c) {
  const dict = DATA.dict;
  const exact = (dict.entries || []).filter(e => e['条目字'] === c);
  // 秘牒取格/杂占按字检索
  const quge = (DATA.midie.quge_items || []).filter(it => it.char === c);
  const zazhan = (DATA.midie.zazhan || []).filter(z => z.char === c);
  // 拆法索引
  const chaifa = (CHAIFA && CHAIFA.get(c)) || [];
  // 探元赋字象
  const tanyuan = (TANYUAN || []).filter(t => t.char === c || t.char.includes(c));
  // 认字测（六书说字测义）
  const renzi = (DATA.renzi.items || []).filter(it => it.char === c);
  // 字触实例片段（全文定位上下文）
  const stories = findStories(c);
  return { char: c, exact, quge, zazhan, chaifa, tanyuan, renzi, stories };
}

function findStories(c, ctxLen = 70, max = 6) {
  const full = (DATA.zichu && DATA.zichu.full_text) || '';
  if (!full || c.length !== 1) return [];
  const out = [];
  const seen = new Set();
  let idx = full.indexOf(c);
  while (idx >= 0 && out.length < max) {
    const start = Math.max(0, idx - ctxLen);
    const end = Math.min(full.length, idx + 1 + ctxLen);
    const seg = full.slice(start, end).replace(/\n+/g, ' ');
    const key = seg.slice(0, 40);
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ pos: idx, ctx: seg, hit: c });
    }
    idx = full.indexOf(c, idx + 1);
  }
  return out;
}

function renderResults(blocks, raw) {
  const box = $('results');
  const title = $('results-title');
  box.innerHTML = '';            // 新查询替换旧结果，不追加
  title.textContent = '';
  const total = blocks.reduce((s, b) => s + b.exact.length + b.quge.length + b.zazhan.length + b.chaifa.length + b.tanyuan.length + b.renzi.length + b.stories.length, 0);
  title.textContent = `「${raw}」· 共 ${total} 条命中`;
  // 干支联动标注 + 导出
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:2px;';
  const gzSel = $('gz-select');
  if (gzSel && gzSel.value) {
    const gzInfo = (DATA.dict.gan_zhi_60 || []).find(g => g['干支'] === gzSel.value);
    const tag = gzInfo && gzInfo.parsed && gzInfo.parsed.length
      ? gzInfo.parsed.map(p => `${p.hz}${p.tag === '吉' ? '吉' : (p.tag.includes('凶') ? '凶' : '·')}`).join(' ')
      : '';
    const gzTag = document.createElement('span');
    gzTag.className = 'tag key';
    gzTag.textContent = `写测时辰：${gzSel.value}（${tag || '程序解析无吉凶标注'}）`;
    bar.appendChild(gzTag);
  }
  const btnTxt = document.createElement('button');
  btnTxt.className = 'btn ghost';
  btnTxt.textContent = '导出 txt';
  btnTxt.addEventListener('click', () => exportResults('txt'));
  const btnJson = document.createElement('button');
  btnJson.className = 'btn ghost';
  btnJson.textContent = '导出 json';
  btnJson.addEventListener('click', () => exportResults('json'));
  bar.appendChild(btnTxt);
  bar.appendChild(btnJson);
  box.appendChild(bar);
  if (!blocks.length) { box.innerHTML += '<div class="miss-note">未输入有效汉字。</div>'; return; }
  box.innerHTML += '';
  blocks.forEach((b, bi) => {
    const hasAny = b.exact.length || b.quge.length || b.zazhan.length || b.chaifa.length || b.tanyuan.length || b.stories.length;
    if (!hasAny) {
      const d = document.createElement('div');
      d.className = 'miss-note';
      d.innerHTML = `「${b.char}」字库与秘牒取格均无直接条目 —— 可参考右侧「秘牒十法·六法」的拆法（装头/接脚/添笔/减笔等）自行拆解；也可查《字触》同名字实例。`;
      box.appendChild(d);
      return;
    }
    b.exact.forEach(e => box.appendChild(hitCard(e, bi)));
    if (b.quge.length) {
      const q = document.createElement('div');
      q.className = 'hit-card';
      q.innerHTML = `<div class="hit-head"><span class="hit-char">${b.char}</span><span class="hit-verdict mid">取格断语 ×${b.quge.length}</span><span class="hit-src">《测字秘牒》取格</span></div>` +
        b.quge.map(x => `<div class="item"><span class="k">${x.char}</span>（${x.verdict}）</div>`).join('');
      q.addEventListener('click', () => showDetail('取格断语 · 字「' + b.char + '」', '《测字秘牒》取格', b.quge.map(x => `${x.char}（${x.verdict}）`).join('\n')));
      box.appendChild(q);
    }
    if (b.zazhan.length) {
      const z = document.createElement('div');
      z.className = 'hit-card';
      z.innerHTML = `<div class="hit-head"><span class="hit-char">${b.char}</span><span class="hit-verdict mid">杂占 ×${b.zazhan.length}</span><span class="hit-src">《测字秘牒》杂占</span></div>` +
        b.zazhan.map(x => `<div class="item">${x.text}</div>`).join('');
      z.addEventListener('click', () => showDetail('杂占 · 字「' + b.char + '」', '《测字秘牒》杂占', b.zazhan.map(x => x.text).join('\n')));
      box.appendChild(z);
    }
    if (b.chaifa.length) {
      const c = document.createElement('div');
      c.className = 'hit-card';
      c.innerHTML = `<div class="hit-head"><span class="hit-char">${b.char}</span><span class="hit-verdict mid">拆法 ×${b.chaifa.length}</span><span class="hit-src">《测字秘牒》十法/六法例字（反向索引）</span></div>` +
        b.chaifa.map(x => `<div class="item"><span class="k">${x.method}</span>：${x.base} → ${x.expand}${x.via || ''}</div>`).join('');
      c.addEventListener('click', () => showDetail('拆法 · 字「' + b.char + '」', '《测字秘牒》十法/六法例字反向索引', b.chaifa.map(x => `${x.method}：${x.base} → ${x.expand}`).join('\n')));
      box.appendChild(c);
    }
    if (b.tanyuan.length) {
      const ty = document.createElement('div');
      ty.className = 'hit-card';
      ty.innerHTML = `<div class="hit-head"><span class="hit-char">${b.char}</span><span class="hit-verdict mid">探元赋字象 ×${b.tanyuan.length}</span><span class="hit-src">《拆字部汇考》探元赋</span></div>` +
        b.tanyuan.map(x => `<div class="item"><span class="k">${x.char}字</span>：${x.xiang}</div>`).join('');
      ty.addEventListener('click', () => showDetail('字象 · 「' + b.char + '」', '《拆字部汇考》探元赋（逐字取象）', b.tanyuan.map(x => `${x.char}字者：${x.xiang}`).join('\n')));
      box.appendChild(ty);
    }
    if (b.renzi.length) {
      const rz = document.createElement('div');
      rz.className = 'hit-card';
      rz.innerHTML = `<div class="hit-head"><span class="hit-char">${b.char}</span><span class="hit-verdict mid">认字测 · 六书测义 ×${b.renzi.length}</span><span class="hit-src">《认字测》明·周宇</span></div>` +
        b.renzi.map(x => `<div class="item">第${x.no || '?'}条 · ${x.text.slice(0, 90)}${x.text.length > 90 ? '…' : ''}</div>`).join('');
      rz.addEventListener('click', () => showDetail(`认${b.char}`, '《认字测》（八十一字）', b.renzi.map(x => x.text).join('\n\n')));
      box.appendChild(rz);
    }
    if (b.stories.length) {
      const st = document.createElement('div');
      st.className = 'hit-card';
      st.innerHTML = `<div class="hit-head"><span class="hit-char">${b.char}</span><span class="hit-verdict mid">《字触》实例 ×${b.stories.length}</span><span class="hit-src">字触六卷 · 全文定位（前后${70}字上下文）</span></div>` +
        b.stories.map((s, i) => `<div class="item">…${esc(s.ctx)}…</div>`).join('');
      st.addEventListener('click', () => showDetail('《字触》实例 · 「' + b.char + '」', '字触六卷（清·周亮工）', b.stories.map(s => '…' + s.ctx + '…').join('\n\n')));
      box.appendChild(st);
    }
  });
}

function buildResultText(blocks, raw) {
  const lines = [];
  lines.push(`测字查询：${raw}`);
  lines.push(`时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`);
  const gzSel = $('gz-select');
  if (gzSel && gzSel.value) lines.push(`写测时辰：${gzSel.value}`);
  lines.push('='.repeat(40));
  blocks.forEach(b => {
    lines.push(`\n【${b.char}】`);
    if (b.exact.length) {
      b.exact.forEach(e => lines.push(
        `[字库] ${e['编号']} ${e['条目字']}（${e['断语性质'] || '—'}）\n  原文：${e['原文'] || ''}\n  白话：${e['白话翻译'] || '（无）'}\n  拆字原理：${e['拆字原理·取象'] || '（无）'}\n  应用场景：${e['应用场景'] || '—'}\n  来源：${e['来源篇名'] || ''}${e['备注'] ? '\n  备注：' + e['备注'] : ''}`));
    }
    if (b.quge.length) lines.push(`[取格] ${b.quge.map(x => `${x.char}（${x.verdict}）`).join('；')}`);
    if (b.zazhan.length) lines.push(`[杂占] ${b.zazhan.map(x => x.text).join('；')}`);
    if (b.chaifa.length) lines.push(`[拆法] ${b.chaifa.map(x => `${x.method}：${x.base}→${x.expand}`).join('；')}`);
    if (b.tanyuan.length) lines.push(`[探元赋] ${b.tanyuan.map(x => `${x.char}字：${x.xiang}`).join('；')}`);
    if (b.renzi.length) lines.push(`[认字测] ${b.renzi.map(x => `第${x.no || '?'}条：${x.text.slice(0, 80)}`).join('；')}`);
    if (b.stories.length) lines.push(`[字触] ${b.stories.map(s => '…' + s.ctx + '…').join('\n')}`);
  });
  return lines.join('\n');
}

async function exportResults(kind) {
  if (!lastRaw) return;
  const ts = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  if (kind === 'json') {
    const payload = JSON.stringify({
      query: lastRaw,
      time: new Date().toLocaleString('zh-CN', { hour12: false }),
      gz: $('gz-select').value || '',
      blocks: lastBlocks,
    }, null, 1);
    const r = await window.cezi.export(payload, `cezi_${ts}.json`);
    if (r && r.ok) showDetail('导出完成', '本地 JSON', `已写入：\n${r.path}`);
  } else {
    const r = await window.cezi.export(buildResultText(lastBlocks, lastRaw), `cezi_${ts}.txt`);
    if (r && r.ok) showDetail('导出完成', '本地 txt', `已写入：\n${r.path}`);
  }
}

function hitCard(e, bi) {
  const d = document.createElement('div');
  d.className = 'hit-card';
  d.dataset.entry = bi + ':' + e['编号'];
  const vc = verdictClass(e['断语性质']);
  d.innerHTML = `
    <div class="hit-head"><span class="hit-char">${e['条目字']}</span><span class="hit-verdict ${vc}">${e['断语性质'] || '—'}</span><span class="hit-src">${e['来源篇名'] || ''}</span></div>
    <div class="hit-orig">${e['原文'] || ''}</div>
    ${e['白话翻译'] ? `<div class="hit-bai">白话：${e['白话翻译']}</div>` : ''}
    <div class="hit-tags">${(e['应用场景'] ? `<span class="tag">${e['应用场景']}</span>` : '')}${(e['拆字原理·取象'] ? `<span class="tag key">${e['拆字原理·取象']}</span>` : '')}</div>`;
  d.addEventListener('click', () => showDetail(
    `${e['条目字']} · ${e['编号']}`,
    e['来源篇名'] || '',
    `【原文】\n${e['原文'] || ''}\n\n【白话翻译】\n${e['白话翻译'] || '（无）'}\n\n【拆字原理·取象】\n${e['拆字原理·取象'] || '（无）'}\n\n【断语性质】${e['断语性质'] || '—'}\n【应用场景】${e['应用场景'] || '—'}\n\n【备注】${e['备注'] || '（无）'}`
  ));
  return d;
}

/* ---------- 60 干支时方 ---------- */
function fillGzSelect() {
  const sel = $('gz-select');
  const gz = DATA.dict.gan_zhi_60 || [];
  gz.forEach(g => {
    const o = document.createElement('option');
    o.value = g['干支'];
    o.textContent = `${g['干支']} · ${(g['可辨吉凶词'] || g['原文断语'] || '').slice(0, 12)}`;
    sel.appendChild(o);
  });
}

function showGz(v) {
  const gz = (DATA.dict.gan_zhi_60 || []).find(g => g['干支'] === v);
  const badge = $('gz-badge');
  const out = $('gz-out');
  if (!gz) { badge.textContent = '—'; out.innerHTML = ''; return; }
  badge.textContent = v;
  const parsed = gz.parsed || [];
  let phtml = '';
  if (parsed.length) {
    phtml = `<span class="lbl">程序解析（按原文地支组自动拆解，吉凶词取自原文、未人工核定）：</span><br>` +
      parsed.map(p => {
        const cls = p.tag.includes('凶') ? 'bad' : (p.tag === '吉' ? '' : (p.tag === '空' ? 'mid' : 'unknown'));
        return `<span class="hit-verdict ${cls}">${p.hz} → ${p.tag}</span>` + (p.note ? ` <span class="lbl">（${p.note}）</span>` : '') + (p.tail && p.tag !== '（无标注）' ? ` <span class="lbl">原文：${p.tail}</span>` : '');
      }).join('<br>') + '<br>';
  }
  out.innerHTML = phtml +
    `<span class="lbl">原文断语（识典非OCR，残字照录）：</span> ${gz['原文断语（识典非OCR，残字照录）'] || gz['原文断语'] || ''}<br>` +
    `<span class="lbl">原表"可辨吉凶词"列：</span> ${gz['可辨吉凶词'] || '（源表 60 行中该列仅 2 行有内容，其余为空）'}<br>` +
    `<span class="lbl">说明：</span> ${gz['说明'] || '（源表未填）'}`;
}

/* ---------- 规则库 ---------- */
const RULE_TABS = {
  midie: renderMidie,
  quge: renderQuge,
  dispatch: renderDispatch,
  renzi: renderRenzi,
  zichu: renderZichu,
  history: renderHistory,
};
let currentRuleTab = 'midie';
let lastRaw = '';
let lastBlocks = [];

function renderRules(tab) {
  currentRuleTab = tab;
  const body = $('rule-body');
  $('rule-search').value = '';
  RULE_TABS[tab](body);
}

function renderMidie(body) {
  const M = DATA.midie;
  let html = '<h4>《测字秘牒》十法 · 心易六法</h4><div class="src">清·程省（本地 txt 文本层）。十法：装头/接脚/穿心/包笼/破解/添笔/减笔/对关/摘字；观梅附后；心易六法：象形/会意/假借/谐声/指事/转注。</div>';
  (M.methods || []).forEach((m, i) => {
    html += `<div class="sec" data-sec="midie-${i}">
      <div class="t">${m.title} <span class="c">（${m.char_count} 字 · ${m.examples.length} 例）</span></div>
      <div class="body">${esc(m.text)}</div>
      ${m.examples.length ? `<div class="c">例：${m.examples.slice(0, 24).map(x => `${x.base}（${x.expand}）`).join(' ')}${m.examples.length > 24 ? ' …' : ''}</div>` : ''}
    </div>`;
  });
  body.innerHTML = html;
  body.querySelectorAll('.sec').forEach(s => s.addEventListener('click', () => {
    s.classList.toggle('open');
    const t = s.querySelector('.t').textContent;
    showDetail(t, '《测字秘牒》', s.querySelector('.body').textContent.trim().slice(0, 4000));
  }));
}

function cleanGroup(g) {
  if (!g) return '';
  return g.replace(/[（(].*$/, '').replace(/[）)]/g, '').trim();
}

function renderQuge(body) {
  const M = DATA.midie;
  let html = '<h4>《测字秘牒》取格断语 · 杂占</h4><div class="src">取格：一字来，以一句断之。先详五行生克，次观六神动静。按原文部首分组（行首组名；个别行首为残句噪声，如实保留并清洗）。杂占：△字实例断语。</div>';
  html += `<div class="c">取格条目 ${M.quge_item_count || 0} 条 · 部首组 ${M.quge_groups ? M.quge_groups.length : 0} · 杂占 ${M.zazhan_count || 0} 条。点组展开，点条目看详情。</div>`;
  const groups = M.quge_groups || [];
  const byGroup = {};
  (M.quge_items || []).forEach((x, i) => {
    const g = cleanGroup(x.group || '');
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push({ ...x, idx: i });
  });
  const groupKeys = [];
  const seenG = new Set();
  groups.concat((M.quge_items || []).map(x => cleanGroup(x.group || ''))).forEach(g => {
    if (g && !seenG.has(g)) { seenG.add(g); groupKeys.push(g); }
  });
  groupKeys.forEach(g => {
    const items = byGroup[g] || [];
    if (!items.length) return;
    html += `<div class="sec" data-sec="qg-${g}">
      <div class="t">部首「${g}」 <span class="c">（${items.length} 条）</span></div>
      <div class="body">${items.map(x => `<div class="item" data-qitem="${x.idx}"><span class="k">${x.char}</span>（${x.verdict}）</div>`).join('')}</div>
    </div>`;
  });
  const noGroup = (M.quge_items || []).filter(x => !cleanGroup(x.group || ''));
  if (noGroup.length) {
    html += `<div class="sec" data-sec="qg-"><div class="t">未分组 <span class="c">（${noGroup.length} 条）</span></div><div class="body">${noGroup.map(x => `<div class="item" data-qitem="${x.idx}"><span class="k">${x.char}</span>（${x.verdict}）</div>`).join('')}</div></div>`;
  }
  html += '<h4 style="margin-top:12px;">△ 杂占实例</h4>' + (M.zazhan || []).map((z, i) =>
    `<div class="item" data-sec="zz-${i}"><span class="k">${z.char}</span> ${z.text}</div>`).join('');
  body.innerHTML = html;
  body.querySelectorAll('.sec[data-sec^="qg"]').forEach(s => s.addEventListener('click', () => s.classList.toggle('open')));
  body.querySelectorAll('.item[data-qitem]').forEach(it => it.addEventListener('click', (e) => {
    e.stopPropagation();
    const x = (M.quge_items || [])[+it.dataset.qitem];
    if (x) showDetail(`${x.char}（${x.verdict}）`, '《测字秘牒》取格', `${x.char}（${x.verdict}）`);
  }));
  body.querySelectorAll('.item:not([data-qitem])').forEach(it => it.addEventListener('click', () => {
    showDetail(it.querySelector('.k') ? it.querySelector('.k').textContent : '杂占', '《测字秘牒》杂占', it.textContent.trim());
  }));
}

function renderDispatch(body) {
  const D = DATA.dispatch;
  let html = '<h4>《古今图书集成·艺术典》拆字部（卷747-748）</h4><div class="src">射复/挂影纪事 · 拆字数（指迷赋/相字歌/元黄克应歌/元黄叙/花押赋/探元赋/齐景至理论=《神机相字法》/字画经验/天字诗诀/立八卦断）· 新订指明心法（上下）· 拆字部记事 · 存目提要</div>';
  // 立八卦断：宫位→笔画像→断语 结构化表
  if (LIBAROWS && LIBAROWS.length) {
    html += '<div class="sec" data-sec="liba"><div class="t">立八卦断 · 宫位解析 <span class="c">（' + LIBAROWS.length + ' 宫）</span></div><div class="body">' +
      LIBAROWS.map(r => `<div class="item"><span class="k">${r.g}宫</span> ${r.x}，${r.d}</div>`).join('') + '</div></div>';
  }
  (D.sections || []).forEach((s, i) => {
    html += `<div class="sec" data-sec="dp-${i}">
      <div class="t">${s.name} <span class="c">（${s.char_count} 字${s.slice ? ' · ' + s.slice : ''}）</span></div>
      <div class="body">${esc(s.text.slice(0, 3000))}${s.text.length > 3000 ? '\n…（全文见详情）' : ''}</div>
    </div>`;
  });
  body.innerHTML = html;
  body.querySelectorAll('.sec[data-sec="liba"]').forEach(s => s.addEventListener('click', () => s.classList.toggle('open')));
  body.querySelectorAll('.sec[data-sec^="dp-"]').forEach(s => s.addEventListener('click', () => {
    s.classList.toggle('open');
    const t = s.querySelector('.t').textContent;
    const i = +s.dataset.sec.split('-')[1];
    showDetail(t, '《拆字部汇考》', (DATA.dispatch.sections[i] || {}).text || '');
  }));
}

function renderRenzi(body) {
  const R = DATA.renzi;
  let html = '<h4>《认字测》八十一字（明·周宇）</h4><div class="src">以六书说字测字。目录 81 字权威清单；正文段落按清单定位（源文本 OCR 有相邻条目粘连）。点击字看测文。</div>';
  html += '<div class="grid81">' + (R.catalog || []).map((c, i) =>
    `<div class="cell" data-sec="rz-${i}" title="${c.no}.${c.char}">${c.char}</div>`).join('') + '</div>';
  body.innerHTML = html;
  body.querySelectorAll('.cell').forEach(c => c.addEventListener('click', () => {
    const i = +c.dataset.sec.split('-')[1];
    const it = (R.items || []).find(x => x.char === (R.catalog[i] || {}).char);
    showDetail(`${R.catalog[i].no}. 认${R.catalog[i].char}`, '《认字测》', it ? it.text : '（该字正文段落未在 OCR 文本中定位到）');
  }));
}

function renderZichu(body) {
  const Z = DATA.zichu;
  const P = Z.people || {};
  let html = '<h4>《字触》六卷（清·周亮工辑）</h4><div class="src">历代拆字故事/谶语/名家实例总集：廋部（离合诗字谜）、外部（谢石/汪龙/郑仰田等）、晰部、几部、谐部、说部。可搜索卷内关键词。</div>';
  // 人名/故事索引
  if (P.known && P.known.length) {
    html += '<div class="people-sec"><span class="lbl">人名索引（已知名单 · 全文定位）</span><div class="chips">' +
      P.known.map((p, i) => `<span class="chip" data-p="k${i}">${p.name} ×${p.count}</span>`).join('') + '</div>';
    html += '<div class="c">注：谢石/汪龙/郑仰田 3 处命中来自整理导言（非正文实例）；正文人名多为 OCR 变形（如礫/櫟）。</div></div>';
  }
  if (P.stories && P.stories.length) {
    html += '<div class="people-sec"><span class="lbl">故事主人公定位（「X公…曰」近似 · 前后文）</span>' +
      P.stories.map((s, i) => `<div class="item" data-p="s${i}"><span class="k">${s.head}</span> ${s.ctx.slice(0, 60)}…</div>`).join('') + '</div>';
  }
  if (P.candidates && P.candidates.length) {
    html += `<div class="sec" data-sec="zcp"><div class="t">称呼模式候选 <span class="c">（${P.candidates.length} 个 · OCR 疑似变形，仅供参考）</span></div><div class="body">` +
      P.candidates.map(c => `${c.name} ×${c.count}`).join('  ·  ') + '</div></div>';
  }
  (Z.sections || []).forEach((s, i) => {
    html += `<div class="sec" data-sec="zc-${i}">
      <div class="t">${s.name} <span class="c">（${s.char_count} 字）</span></div>
      <div class="body">${esc(s.text.slice(0, 2000))}${s.text.length > 2000 ? '\n…（全文见详情）' : ''}</div>
    </div>`;
  });
  body.innerHTML = html;
  body.querySelectorAll('.sec[data-sec="zcp"]').forEach(s => s.addEventListener('click', () => s.classList.toggle('open')));
  body.querySelectorAll('.sec[data-sec^="zc-"]').forEach(s => s.addEventListener('click', () => {
    s.classList.toggle('open');
    const t = s.querySelector('.t').textContent;
    const i = +s.dataset.sec.split('-')[1];
    showDetail(t, '《字触》', (Z.sections[i] || {}).text || '');
  }));
  body.querySelectorAll('.chip[data-p]').forEach(ch => ch.addEventListener('click', () => {
    const p = P.known[+ch.dataset.p.slice(1)];
    showDetail(p.name, '《字触》人名索引', (p.ctxs || []).map((c, i) => `[${i + 1}] …${c}…`).join('\n\n'));
  }));
  body.querySelectorAll('.item[data-p^="s"]').forEach(it => it.addEventListener('click', () => {
    const s = P.stories[+it.dataset.p.slice(1)];
    showDetail(s.head, '《字触》故事定位（近似）', '…' + s.ctx + '…');
  }));
}

/* ---------- 拆字推演（字形拆解 + 拆法变换 + 部件断语） ---------- */
const IDS_OPS = new Set(['⿰','⿱','⿲','⿳','⿴','⿵','⿶','⿷','⿸','⿹','⿺','⿻']);
const OP_NAMES = {
  '⿰':'左右', '⿱':'上下', '⿲':'左中右', '⿳':'上中下', '⿴':'全包围',
  '⿵':'上三包围', '⿶':'下三包围', '⿷':'左三包围', '⿸':'左上包围',
  '⿹':'右上包围', '⿺':'左下包围', '⿻':'穿插/嵌套',
};

// IDS 递归拆解：子1=首字符，子2=剩余递归（MMH 数据 97.8% 满足；反例降级为平铺部件）
// ch 可能是单字，也可能是内嵌 IDS 表达式（如 ⿱罒⿱冖夕）
function decomposeTree(ch, depth) {
  const d = (ch.length > 1 && IDS_OPS.has(ch[0])) ? ch : (DATA.decomp || {})[ch];
  if (!d || depth <= 0) return { ch, leaf: true };
  const op = d[0];
  if (!IDS_OPS.has(op)) return { ch, leaf: true };
  const rest = d.slice(1);
  // 反例处理：rest 开头是操作符 → 结构特殊，平铺部件列表
  if (IDS_OPS.has(rest[0] || '')) {
    const flat = Array.from(rest).filter(x => !IDS_OPS.has(x) && x !== '？');
    return { ch, op, name: OP_NAMES[op] || op, special: true, parts: flat.map(x => decomposeTree(x, depth - 1)) };
  }
  const p1 = rest[0] || '';
  const p2 = rest.slice(1);
  const parts = [];
  if (p1 && !IDS_OPS.has(p1)) parts.push(decomposeTree(p1, depth - 1));
  if (p2) parts.push(decomposeTree(p2, depth - 1));
  return { ch, op, name: OP_NAMES[op] || op, parts };
}

// 部件/字 的断语聚合：字库 / 取格 / 探元赋 / 杂占
function partVerdicts(ch) {
  const out = [];
  (DATA.dict.entries || []).filter(e => e['条目字'] === ch).slice(0, 2).forEach(e => {
    out.push({ src: '字库', text: (e['原文'] || '').slice(0, 40) + (e['断语性质'] ? '（' + e['断语性质'] + '）' : '') });
  });
  (DATA.midie.quge_items || []).filter(it => it.char === ch).slice(0, 2).forEach(it => {
    out.push({ src: '取格', text: `${it.char}（${it.verdict}）` });
  });
  (TANYUAN || []).filter(t => t.char === ch).slice(0, 1).forEach(t => {
    out.push({ src: '探元赋', text: `${t.char}字者，${t.xiang}` });
  });
  return out;
}

// 拆法变换：c 作为 base 的正向 + c 作为 expand 的反向（chaifa 索引）
function chaifaTransforms(c) {
  const out = [];
  (DATA.midie.methods || []).forEach(m => {
    (m.examples || []).forEach(ex => {
      if (ex.base === c) out.push({ method: m.title, kind: '正', from: c, to: ex.expand });
    });
  });
  (CHAIFA.get(c) || []).forEach(r => {
    if (r.base !== c) out.push({ method: r.method, kind: '反', from: r.base, to: c, via: r.via });
  });
  return out;
}

function renderTuilian(c) {
  const box = $('results');
  const title = $('results-title');
  title.textContent = `「${c}」拆字推演`;
  box.innerHTML = '';            // 推演替换旧结果，不追加
  const wrap = document.createElement('div');
  wrap.className = 'hit-card';
  // ① 字形拆解树
  const tree = decomposeTree(c, 4);
  let html = `<div class="hit-head"><span class="hit-char">${c}</span><span class="hit-verdict mid">字形拆解</span><span class="hit-src">Make Me a Hanzi 部件库（GPL-3.0，本地自用）</span></div>`;
  html += '<div class="decomp-tree">' + treeHtml(tree, c) + '</div>';
  // ② 拆法变换
  const tf = chaifaTransforms(c);
  html += `<div class="hit-head" style="margin-top:10px;"><span class="hit-char" style="font-size:16px;">拆法变换</span><span class="hit-verdict mid">秘牒十法/心易六法</span><span class="hit-src">${tf.length ? tf.length + ' 条' : '无直接例字'}</span></div>`;
  if (tf.length) {
    html += '<div class="decomp-tree">' + tf.map(t => `<div class="titem"><span class="k">${t.method}</span>（${t.kind === '正' ? '可成' : '由' + t.from + '得'}）${t.from} → ${t.to}</div>`).join('') + '</div>';
  }
  // ③ 部件断语
  html += '<div class="hit-head" style="margin-top:10px;"><span class="hit-char" style="font-size:16px;">部件/成字断语</span><span class="hit-verdict mid">字库 · 取格 · 探元赋</span></div>';
  const pv = collectPartVerdicts(tree);
  if (pv.length) {
    html += '<div class="decomp-tree">' + pv.map(p => `<div class="titem"><span class="k">${p.ch}</span> [${p.src}] ${p.text}</div>`).join('') + '</div>';
  } else {
    html += '<div class="c">该字拆解出的部件无直接断语（可查规则库搜索）。</div>';
  }
  // ④ 部件反向入字（A）
  const nodeSet = [];
  collectNodes(tree, nodeSet);
  const REV = DATA.rev_decomp || {};
  const revRows = [];
  nodeSet.slice(1).forEach(p => {
    if (p.length > 1 || IDS_OPS.has(p)) return;
    const ws = (REV[p] || []).filter(w => w !== c).slice(0, 10);
    if (!ws.length) return;
    revRows.push({ p, ws: ws.map(w => ({ w, n: partVerdicts(w).length })) });
  });
  if (revRows.length) {
    html += `<div class="hit-head" style="margin-top:10px;"><span class="hit-char" style="font-size:16px;">部件可入字</span><span class="hit-verdict mid">反向索引</span><span class="hit-src">MMH 反查：拆出的部件还能组成哪些字（每部件 ≤10）</span></div>`;
    html += '<div class="decomp-tree">' + revRows.map(r =>
      `<div class="titem"><span class="k">${r.p}</span> → ${r.ws.map(x => `${x.w}<span class="tag">${x.n}条</span>`).join(' ')}</div>`).join('') + '</div>';
  }
  // ⑤ 笔画特征自查（C）：立八卦断 + 字画经验可读条目
  const checkRows = [];
  (LIBAROWS || []).forEach(r => checkRows.push({ g: r.g + '宫', feat: r.x, d: r.d, src: '立八卦断' }));
  (ZIHUA || []).forEach(z => checkRows.push({ g: z.head, feat: '', d: z.text, src: '字画经验' }));
  if (checkRows.length) {
    html += `<div class="hit-head" style="margin-top:10px;"><span class="hit-char" style="font-size:16px;">笔画特征自查</span><span class="hit-verdict mid">立八卦断 · 字画经验</span><span class="hit-src">对照你所写的字笔画/结构，勾选相似特征 → 聚合断语</span></div>`;
    html += `<div id="zihua-checks">` + checkRows.map((r, i) =>
      `<div class="check-item" data-zi="${i}"><span class="k">${r.g}${r.feat ? '：' + r.feat : ''}</span> ${r.d}</div>`).join('') + '</div>';
    html += '<div class="c" id="zihua-picked" style="margin-top:6px;">尚未勾选</div>';
  }
  // ⑥ 组合取象（B）：部件对 → 全库断语文本搜双部件
  const combo = comboOmen(c, tree);
  if (combo.length) {
    html += `<div class="hit-head" style="margin-top:10px;"><span class="hit-char" style="font-size:16px;">组合取象</span><span class="hit-verdict mid">部件组合 → 古籍断语</span><span class="hit-src">取格/字库/探元赋/杂占中同时含两部件的条目（≤8）</span></div>`;
    html += '<div class="decomp-tree">' + combo.map(x =>
      `<div class="titem"><span class="k">${x.a}+${x.b}</span> [${x.src}] ${x.text}</div>`).join('') + '</div>';
  }
  wrap.innerHTML = html;
  box.insertBefore(wrap, box.firstChild);
  // 勾选交互
  const checks = wrap.querySelectorAll('.check-item');
  checks.forEach(ch => ch.addEventListener('click', () => {
    ch.classList.toggle('on');
    const picked = [...wrap.querySelectorAll('.check-item.on')].map(x => x.textContent.trim());
    const el = wrap.querySelector('#zihua-picked');
    el.textContent = picked.length ? picked.map((t, i) => `${i + 1}. ${t}`).join('\n') : '尚未勾选';
    el.style.whiteSpace = 'pre-wrap';
  }));
}

function collectNodes(node, acc) { acc.push(node.ch); (node.parts || []).forEach(k => collectNodes(k, acc)); }

// 组合取象：输入字的部件两两组合，在古籍断语文本中搜同时含两部件的条目
function comboOmen(c, tree) {
  const nodeSet = [];
  collectNodes(tree, nodeSet);
  const parts = nodeSet.filter(p => p.length === 1 && !IDS_OPS.has(p)).slice(0, 5);
  const pool = [];
  (DATA.midie.quge_items || []).forEach(it => pool.push({ src: '取格', k: it.char, text: it.verdict }));
  (DATA.dict.entries || []).forEach(e => { if (e['原文']) pool.push({ src: '字库', k: e['条目字'], text: e['原文'] }); });
  (TANYUAN || []).forEach(t => pool.push({ src: '探元赋', k: t.char, text: t.xiang }));
  (DATA.midie.zazhan || []).forEach(z => pool.push({ src: '杂占', k: z.char, text: z.text }));
  const out = [];
  const seen = new Set();
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const a = parts[i], b = parts[j];
      if (a === b) continue;
      pool.forEach(p => {
        const t = p.text || '';
        if (t.includes(a) && t.includes(b) && t.length < 60) {
          const key = p.src + p.k + t;
          if (!seen.has(key)) {
            seen.add(key);
            out.push({ a, b, src: p.src, text: t });
          }
        }
      });
    }
  }
  return out.slice(0, 8);
}

function treeHtml(node, rootChar) {
  if (node.leaf) {
    const v = partVerdicts(node.ch);
    const flag = v.length ? `<span class="tag key">${v.length} 条断语</span>` : '';
    return `<div class="titem leaf"><span class="k">${node.ch}</span>${flag}</div>`;
  }
  const v = partVerdicts(node.ch);
  const flag = v.length ? `<span class="tag key">${v.length} 条断语</span>` : '';
  const kids = (node.parts || []).map(k => `<div class="titem">${treeHtml(k)}</div>`).join('');
  const sp = node.special ? '<span class="c">（结构特殊，按字形部件平铺）</span>' : '';
  return `<div class="tnode"><span class="k">${node.ch}</span> <span class="c">${node.name || ''}${sp}</span>${flag}${kids ? '<div class="tchildren">' + kids + '</div>' : ''}</div>`;
}

function collectPartVerdicts(node, acc) {
  acc = acc || [];
  const v = partVerdicts(node.ch);
  v.forEach(x => acc.push({ ch: node.ch, ...x }));
  (node.parts || []).forEach(k => collectPartVerdicts(k, acc));
  return acc;
}

/* ---------- 规则库搜索（当前 tab 过滤 + 高亮） ---------- */
function filterRuleBody(q) {
  const body = $('rule-body');
  if (!q) {
    renderRules(currentRuleTab);
    return;
  }
  body.querySelectorAll('mark.rule-hit').forEach(m => m.parentNode.replaceChild(document.createTextNode(m.textContent), m));
  body.normalize();
  body.querySelectorAll('.sec, .item, .cell').forEach(el => {
    const hit = el.textContent.toLowerCase().includes(q);
    el.style.display = hit ? '' : 'none';
    if (el.classList.contains('sec') && hit) el.classList.add('open');
  });
  // 重新高亮
  const nodes2 = [];
  const walker2 = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.parentNode && n.parentNode.tagName !== 'MARK' && n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  });
  while (walker2.nextNode()) nodes2.push(walker2.currentNode);
  nodes2.forEach(node => {
    const text = node.textContent;
    const lower = text.toLowerCase();
    let idx = lower.indexOf(q);
    if (idx < 0) return;
    const frag = document.createDocumentFragment();
    let last = 0;
    while (idx >= 0) {
      frag.appendChild(document.createTextNode(text.slice(last, idx)));
      const mk = document.createElement('mark');
      mk.className = 'rule-hit';
      mk.textContent = text.slice(idx, idx + q.length);
      frag.appendChild(mk);
      last = idx + q.length;
      idx = lower.indexOf(q, last);
    }
    frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
  });
}

/* ---------- 详情 ---------- */
function showDetail(title, src, text) {
  const d = $('detail');
  d.innerHTML = `<div class="side-back" id="side-back">← 返回部件反查</div><h2>${esc(title)}</h2><div class="src">${esc(src)}</div><p>${esc(text)}</p>`;
  d.scrollTop = 0;
  const sb = $('side-back');
  if (sb) sb.addEventListener('click', renderSideDefault);
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
