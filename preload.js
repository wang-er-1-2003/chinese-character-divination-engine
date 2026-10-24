// SPDX-License-Identifier: MIT
// Copyright (c) 2026 wang-er-1-2003
// 测字引擎子件 - preload：暴露数据桥
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('cezi', {
  data: () => ipcRenderer.invoke('cezi-data'),
  export: (payload, filename) => ipcRenderer.invoke('cezi-export', payload, filename),
});
