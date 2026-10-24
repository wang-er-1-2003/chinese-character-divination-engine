// SPDX-License-Identifier: MIT
// Copyright (c) 2026 wang-er-1-2003
// 测字引擎子件 - 主进程（Electron）：本地数据读取 + 窗口
'use strict';
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

function loadJson(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'engine', 'data', name), 'utf-8'));
  } catch (e) {
    console.error(name + ' load failed:', e.message);
    return null;
  }
}

const CEZI = loadJson('cezi_dict.json');          // 字库直查表 2786 条 + 60 干支 + 噪声
const MIDIE = loadJson('cezhi_midie.json');       // 测字秘牒：16 法节 + 取格 1224 + 杂占 53
const DISPATCH = loadJson('rules_dispatch.json'); // 拆字部汇考 13 节歌诀
const RENZI = loadJson('rules_renzi.json');       // 认字测 81 字清单 + 段落
const ZICHU = loadJson('rules_zichu.json');       // 字触 六卷实例
const DECOMP = loadJson('decomp.json');           // 拆字部件库（Make Me a Hanzi，GPL-3.0）字→IDS
const REVDECOMP = loadJson('rev_decomp.json');    // 部件→含该部件的字（反向索引）

// IPC 载荷裁剪：不把全文大字段推给渲染层（避免 IPC 过大），只给结构化部分与节选
function slim(data, keepFull, leadLen) {
  if (!data) return null;
  const out = { ...data };
  for (const k of ['full_text', 'body_text']) {
    if (typeof out[k] === 'string' && !keepFull) {
      out[k + '_lead'] = out[k].slice(0, leadLen || 400);
      delete out[k];
    }
  }
  return out;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1380, height: 920,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile('index.html');
}

ipcMain.handle('cezi-data', () => {
  return {
    ok: true,
    dict: slim(CEZI, false, 300),          // 字库直查表（含 entries / gan_zhi_60 / noise / meta）
    midie: slim(MIDIE, false, 300),        // 测字秘牒（methods / quge_items / zazhan）
    dispatch: slim(DISPATCH, true, 400),   // 汇考（sections 全文保留，供规则库浏览）
    renzi: slim(RENZI, false, 300),        // 认字测（catalog / items）
    zichu: slim(ZICHU, true, 400),         // 字触（sections 全文保留）
    decomp: DECOMP,                        // 拆字部件库（195KB，直接全量）
    rev_decomp: REVDECOMP,                 // 部件反向入字索引（668KB）
  };
});

// 导出：写 engine/exports 目录（渲染层无 node 权限，走 IPC）
ipcMain.handle('cezi-export', (ev, payload, filename) => {
  const dir = path.join(__dirname, 'exports');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* ignore */ }
  const safe = String(filename || 'cezi_export.txt').replace(/[\\/:*?"<>|]/g, '_');
  const p = path.join(dir, safe);
  fs.writeFileSync(p, payload, 'utf-8');
  return { ok: true, path: p };
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
