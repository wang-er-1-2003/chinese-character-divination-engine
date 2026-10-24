# Chinese Character Divination Engine（测字引擎）

A local desktop engine for traditional Chinese **charactery** (测字 / character divination), built with Electron. All data is extracted from classical texts, verified item by item, with sources annotated — no fabricated readings.

## Features

| Module | Content |
|---|---|
| Direct lookup | 2,786-character reading table (cezi_dict) |
| Cezi Midie (测字秘牒) | Ten methods + six methods of character reading |
| Chai Zi Gejue (拆字部汇考) | Character-splitting verses from the classic compendium |
| Ren Zi Ce (认字测) | 81-character test readings |
| Zi Chu (字触) | 6-volume case studies of classical character divination |
| Decomposition engine | Character splitting (decomp.json / rev_decomp.json) with dispatch rules |

## Structure

```
renderer/app.js        UI + query logic (context-isolated, no Node in renderer)
engine/data/*.json     Data layer (rules, dictionaries, decomposition)
data_raw/              Raw source material (OCR transcripts, makemeahanzi dictionary)
main.js / preload.js   Electron main + IPC bridge
```

## Run

```
npm install        # dev only; the engine itself has zero runtime dependencies
npm start
```

No network access is needed at runtime — everything is local JSON.

## Data sources

- `engine/data/cezi_dict.json`: built from classical charactery texts (public domain), with OCR transcripts in `data_raw/ocr_rare.txt`
- `data_raw/makemeahanzi/`: [makemeahanzi](https://github.com/skishore/makemeahanzi) dictionary (MIT licensed), used for character decomposition
- All readings are restructured rule data, not verbatim copies of modern copyrighted works

## License

MIT © 2026 wang-er-1-2003

---

# 中文简介

传统测字术（拆字 / 测字）的本地桌面引擎。数据全部来自古籍整理（测字秘牒十法六法、拆字部汇考、认字测、字触六卷），逐条核对、标注来源，不编造断语。运行时零网络依赖，数据全在本地 JSON。
