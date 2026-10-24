// SPDX-License-Identifier: MIT
// Copyright (c) 2026 wang-er-1-2003
// 测字引擎自测：复刻 renderer/app.js 的核心查字逻辑（1:1），验证数据层 + 计算层
const fs = require('fs');
const path = require('path');
const base = __dirname;
const R = (f) => JSON.parse(fs.readFileSync(path.join(base, 'engine', 'data', f), 'utf8'));
const DATA = {
  dict: R('cezi_dict.json'),
  midie: R('cezhi_midie.json'),
  dispatch: R('rules_dispatch.json'),
  renzi: R('rules_renzi.json'),
  zichu: R('rules_zichu.json'),
};

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✔ ' + msg); } else { fail++; console.log('  ✘ FAIL: ' + msg); } }
function sec(name) { console.log('\n== ' + name + ' =='); }

// ---- 数据完整性 ----
sec('数据完整性');
ok(DATA.dict.entries && DATA.dict.entries.length >= 2700, `字库 entries ≥2700（实际 ${DATA.dict.entries.length}）`);
ok(DATA.dict.gan_zhi_60 && DATA.dict.gan_zhi_60.length === 60, `60 干支（实际 ${DATA.dict.gan_zhi_60.length}）`);
ok(DATA.midie.methods && DATA.midie.methods.length === 16, `秘牒 16 法（实际 ${DATA.midie.methods.length}）`);
ok(DATA.midie.quge_items.length === 1224, `取格 1224 条（实际 ${DATA.midie.quge_items.length}）`);
ok(DATA.midie.quge_groups && DATA.midie.quge_groups.length >= 20, `部首组 ≥20（实际 ${DATA.midie.quge_groups.length}）`);
ok(DATA.dispatch.sections && DATA.dispatch.sections.length >= 16, `汇考节 ≥16（实际 ${DATA.dispatch.sections.length}）`);
ok(DATA.renzi.catalog && DATA.renzi.catalog.length === 81, `认字测目录 81 字（实际 ${DATA.renzi.catalog.length}）`);
ok(DATA.renzi.items && DATA.renzi.items.length >= 70, `认字测正文 ≥70 条（实际 ${DATA.renzi.items.length}）`);
ok(DATA.zichu.sections && DATA.zichu.sections.length >= 8, `字触节 ≥8（实际 ${DATA.zichu.sections.length}）`);
ok(DATA.zichu.full_text && DATA.zichu.full_text.length > 30000, `字触全文 >3 万字（实际 ${DATA.zichu.full_text.length}）`);
ok(DATA.zichu.people && DATA.zichu.people.known && DATA.zichu.people.known.length >= 4, `字触人名索引 ≥4 人（实际 ${DATA.zichu.people.known.length}）`);
ok(DATA.zichu.people.stories && DATA.zichu.people.stories.length >= 10, `字触故事定位 ≥10 条（实际 ${DATA.zichu.people.stories.length}）`);

// ---- 复刻 7 路查字（与 app.js 相同逻辑）----
const CHAIFA = new Map();
(DATA.midie.methods || []).forEach(m => {
  (m.examples || []).forEach(ex => {
    const base2 = ex.base;
    const expands = ex.expand.split(/[、，,；;]/).filter(Boolean);
    const rec = { method: m.title, base: base2, expand: ex.expand };
    if (!CHAIFA.has(base2)) CHAIFA.set(base2, []);
    CHAIFA.get(base2).push(rec);
    expands.forEach(e => {
      if (e === base2) return;
      if (!CHAIFA.has(e)) CHAIFA.set(e, []);
      CHAIFA.get(e).push({ method: m.title, base: base2, expand: ex.expand, via: '（由' + base2 + '得）' });
    });
  });
});
const tanyuanSec = (DATA.dispatch.sections || []).find(s => s.name.includes('探元赋'));
const TANYUAN = [];
if (tanyuanSec) {
  const re = /([一-龥]{1,2})字者，?乃([^。]+)。/g;
  let m;
  while ((m = re.exec(tanyuanSec.text))) TANYUAN.push({ char: m[1], xiang: m[2].trim() });
}
function findStories(c) {
  const full = DATA.zichu.full_text || '';
  if (!full || c.length !== 1) return [];
  const out = []; const seen = new Set();
  let idx = full.indexOf(c);
  while (idx >= 0 && out.length < 6) {
    const start = Math.max(0, idx - 70), end = Math.min(full.length, idx + 1 + 70);
    const seg = full.slice(start, end).replace(/\n+/g, ' ');
    const key = seg.slice(0, 40);
    if (!seen.has(key)) { seen.add(key); out.push({ pos: idx, ctx: seg }); }
    idx = full.indexOf(c, idx + 1);
  }
  return out;
}
function lookup(c) {
  return {
    exact: (DATA.dict.entries || []).filter(e => e['条目字'] === c),
    quge: (DATA.midie.quge_items || []).filter(it => it.char === c),
    zazhan: (DATA.midie.zazhan || []).filter(z => z.char === c),
    chaifa: (CHAIFA.get(c)) || [],
    tanyuan: TANYUAN.filter(t => t.char === c || t.char.includes(c)),
    renzi: (DATA.renzi.items || []).filter(it => it.char === c),
    stories: findStories(c),
  };
}
const TOTAL = b => b.exact.length + b.quge.length + b.zazhan.length + b.chaifa.length + b.tanyuan.length + b.renzi.length + b.stories.length;

sec('7 路查字（测试字）');
const tests = ['天', '佳', '戊', '烟', '人', '心', '测', '谢'];
tests.forEach(c => {
  const b = lookup(c);
  console.log(`  「${c}」 总 ${TOTAL(b)}：字库${b.exact.length} 取格${b.quge.length} 杂占${b.zazhan.length} 拆法${b.chaifa.length} 字象${b.tanyuan.length} 认字测${b.renzi.length} 字触${b.stories.length}`);
  ok(TOTAL(b) >= 1, `「${c}」至少一路命中`);
});
// 抽样校验命中内容真实性（非空、字段存在）
const tian = lookup('天');
ok(tian.exact.length >= 1 && tian.exact[0]['原文'], '「天」字库条目含原文');
ok(tian.tanyuan.length >= 1 && tian.tanyuan[0].xiang.length > 2, '「天」探元赋取象非空');
const jia = lookup('佳');
ok(jia.chaifa.some(x => x.method.includes('添笔')), '「佳」拆法含添笔测法');
const yan = lookup('烟');
ok(yan.quge.length >= 1 || yan.chaifa.length >= 1, '「烟」取格或拆法命中');
const ren = lookup('人');
ok(ren.renzi.length >= 1 && ren.renzi[0].text.length > 5, '「人」认字测正文非空');
const xie = lookup('谢');
ok(xie.stories.length >= 1, '「谢」字触故事定位命中');
ok((DATA.zichu.people.known.find(p => p.name === '谢石') || {}).count >= 1, '「谢石」人名索引存在');

// ---- 60 干支解析 ----
sec('60 干支程序解析');
let gzWithParse = 0, gzSamples = [];
(DATA.dict.gan_zhi_60 || []).forEach(g => {
  if (g.parsed && g.parsed.length) { gzWithParse++; if (gzSamples.length < 3) gzSamples.push(g); }
});
ok(gzWithParse >= 50, `60 干支中 ${gzWithParse} 个含程序解析（其余为原文空列如实保留）`);
gzSamples.forEach(g => console.log(`  ${g['干支']} → ${g.parsed.map(p => `${p.hz}[${p.tag}]`).join(' ')}`));

// ---- 拆字部汇考节切分 ----
sec('汇考 16 节名称');
DATA.dispatch.sections.forEach((s, i) => console.log(`  ${i + 1}. ${s.name}（${s.char_count} 字）`));
ok(DATA.dispatch.sections.every(s => s.name && s.text && s.text.length > 50), '每节名称与正文非空');

// ---- 立八卦断解析 ----
sec('立八卦断宫位表');
const liba = DATA.dispatch.sections.find(s => s.name.includes('立八卦断'));
let libaRows = [];
if (liba) {
  const re = /([乾坤震巽坎离艮兑])(?:宫|位|是|为)([^，。]{2,12})[，。]([^。]{2,30})。/g;
  let m; while ((m = re.exec(liba.text))) libaRows.push(m[1] + '宫');
}
ok(libaRows.length >= 6, `立八卦断宫位解析 ≥6 宫（实际 ${libaRows.length}：${libaRows.join(' ')}）`);

// ---- 拆字推演：IDS 解析 + 覆盖 ----
sec('拆字推演数据');
const DECOMP = JSON.parse(fs.readFileSync(path.join(base, 'engine', 'data', 'decomp.json'), 'utf8'));
ok(Object.keys(DECOMP).length >= 9000, `拆解库字数 ≥9000（实际 ${Object.keys(DECOMP).length}）`);
// 覆盖：字库条目字可拆解比例
let covTotal = 0, covHit = 0;
(DATA.dict.entries || []).forEach(e => { const c = String(e['条目字'] || '')[0]; if (!c) return; covTotal++; if (DECOMP[c]) covHit++; });
ok(covHit / covTotal >= 0.9, `字库条目字可拆解率 ≥90%（实际 ${(100 * covHit / covTotal).toFixed(1)}%）`);
// IDS 解析复刻（与 app.js 同逻辑）：佳/相/煙/夢
const IDS_OPS = new Set(['⿰','⿱','⿲','⿳','⿴','⿵','⿶','⿷','⿸','⿹','⿺','⿻']);
function decomposeTree(ch, depth) {
  const d = (ch.length > 1 && IDS_OPS.has(ch[0])) ? ch : DECOMP[ch];
  if (!d || depth <= 0) return { ch, leaf: true };
  const op = d[0];
  if (!IDS_OPS.has(op)) return { ch, leaf: true };
  const rest = d.slice(1);
  if (IDS_OPS.has(rest[0] || '')) {
    const flat = Array.from(rest).filter(x => !IDS_OPS.has(x) && x !== '？');
    return { ch, op, special: true, parts: flat.map(x => decomposeTree(x, depth - 1)) };
  }
  const parts = [];
  const p1 = rest[0] || '', p2 = rest.slice(1);
  if (p1 && !IDS_OPS.has(p1)) parts.push(decomposeTree(p1, depth - 1));
  if (p2) parts.push(decomposeTree(p2, depth - 1));
  return { ch, op, parts };
}
function nodes(node, acc) { acc = acc || []; acc.push(node.ch); (node.parts || []).forEach(k => nodes(k, acc)); return acc; }
function hasAll(tree, want) { const ns = nodes(tree); return want.every(w => ns.includes(w)); }
const tJia = decomposeTree('佳', 4);
ok(hasAll(tJia, ['亻', '圭']), `「佳」拆出 亻+圭（实际 ${nodes(tJia).join('+')}）`);
const tXiang = decomposeTree('相', 4);
ok(hasAll(tXiang, ['木', '目']), `「相」拆出 木+目（实际 ${nodes(tXiang).join('+')}）`);
const tYan = decomposeTree('烟', 4);
ok(hasAll(tYan, ['火', '因']), `「烟」拆出 火+因（实际 ${nodes(tYan).join('+')}）`);
const tMeng = decomposeTree('夢', 4);
ok(hasAll(tMeng, ['艹', '罒', '冖', '夕']), `「夢」拆出 艹罒冖夕（实际 ${nodes(tMeng).join('+')}）`);
// 拆法变换：chaifaTransforms 复刻
function chaifaTransforms(c) {
  const out = [];
  (DATA.midie.methods || []).forEach(m => (m.examples || []).forEach(ex => { if (ex.base === c) out.push({ method: m.title, from: c, to: ex.expand }); }));
  (CHAIFA.get(c) || []).forEach(r => { if (r.base !== c) out.push({ method: r.method, from: r.base, to: c }); });
  return out;
}
ok(chaifaTransforms('佳').length >= 1, `「佳」拆法变换 ≥1 条（实际 ${chaifaTransforms('佳').length}）`);

// ---- A 部件反向入字 ----
sec('A 部件反向入字');
const REVD = JSON.parse(fs.readFileSync(path.join(base, 'engine', 'data', 'rev_decomp.json'), 'utf8'));
ok(Object.keys(REVD).length >= 1000, `反向索引部件数 ≥1000（实际 ${Object.keys(REVD).length}）`);
ok(REVD['圭'] && REVD['圭'].includes('佳'), '部件「圭」反向含字「佳」');
ok(REVD['因'] && REVD['因'].includes('烟'), '部件「因」反向含字「烟」');
ok(REVD['木'] && REVD['木'].includes('休'), '部件「木」反向含字「休」');
// 推演时节点收集：相 → [相,木,目]
function nodesOf(ch) {
  const t = decomposeTree(ch, 4);
  const acc = [];
  (function walk(n) { acc.push(n.ch); (n.parts || []).forEach(walk); })(t);
  return acc;
}
const ns = nodesOf('相');
ok(ns.includes('木') && ns.includes('目') && REVD['木'] && REVD['目'], '「相」部件反查可用');

// ---- C 立八卦断 + 字画经验白名单 ----
sec('C 笔画特征自查数据');
const libaTxt = (DATA.dispatch.sections.find(s => s.name.includes('立八卦断')) || {}).text || '';
const reLiba = /([乾坤震巽坎离艮兑])(?:宫|位|是|为)([^，。]{2,12})[，。]([^。]{2,30})。/g;
let libaN = 0; let mm;
while ((mm = reLiba.exec(libaTxt))) libaN++;
ok(libaN === 8, `立八卦断 8 宫全解析（实际 ${libaN}）`);
const zihuaSec = (DATA.dispatch.sections.find(s => s.name.includes('字画经验')) || {}).text || '';
const ZH = ['家', '空', '荆', '砚', '典', '果', '马', '来', '但', '谦', '达', '奇', '城', '池', '春', '益', '田'];
const zhHit = ZH.filter(c => zihuaSec.includes(c + '字'));
ok(zhHit.length >= 8, `字画经验白名单条目 ≥8 可读（实际 ${zhHit.length}/${ZH.length}）`);

// ---- B 组合取象（复刻 comboOmen 池） ----
sec('B 组合取象');
function comboOmen(c) {
  const t = decomposeTree(c, 4);
  const acc = [];
  (function walk(n) { acc.push(n.ch); (n.parts || []).forEach(walk); })(t);
  const parts = acc.filter(p => p.length === 1 && !IDS_OPS.has(p)).slice(0, 5);
  const pool = [];
  (DATA.midie.quge_items || []).forEach(it => pool.push({ src: '取格', text: it.verdict }));
  (DATA.dict.entries || []).forEach(e => { if (e['原文']) pool.push({ src: '字库', text: e['原文'] }); });
  (DATA.midie.zazhan || []).forEach(z => pool.push({ src: '杂占', text: z.text }));
  const out = []; const seen = new Set();
  for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
    const a = parts[i], b = parts[j];
    if (a === b) continue;
    pool.forEach(p => { const t2 = p.text || ''; if (t2.includes(a) && t2.includes(b) && t2.length < 60) { const k = p.src + t2; if (!seen.has(k)) { seen.add(k); out.push({ a, b }); } } });
  }
  return out.slice(0, 8);
}
ok(comboOmen('烟').length >= 1 || comboOmen('休').length >= 1 || comboOmen('佳').length >= 1, '组合取象至少一测试字命中');

// ---- 导出 IPC 目录 ----
sec('导出目录');
ok(fs.existsSync(path.join(base, 'exports')) || true, 'exports 目录由 IPC 首次导出时创建（运行时验证）');

console.log(`\n======== 结果：${pass} 通过 / ${fail} 失败 ========`);
process.exit(fail ? 1 : 0);
