# Odd Dice (cover) — Lyric PV

millsage「Odd Dice」的翻唱 PV 工程（Covered by 夢ノ結唱 AVER）。
画面全部由代码生成：抽象二维动态图形加逐字歌词动画，不使用任何插画。逐字时间、拍点、拍号和速度都从 Synthesizer V 工程（`.svp`）里自动提取。

> 本仓库不包含音频。歌曲版权归原作者所有；渲染时请使用你自己的混音文件。

## 技术栈

| 部分 | 技术 |
|---|---|
| 视频框架 | [Remotion 4](https://www.remotion.dev/)（React 18 + TypeScript）：每一帧都是时间的纯函数，可以确定性渲染 |
| 数据管线 | Python 3 + numpy + ffmpeg：解析 SVP 速度表和音符，把歌词假名和音符对齐，分析混音频段，自动判断时间偏移 |
| 背景与氛围 | Canvas 2D：雨、波纹、线稿骰子、骰子塔、极光、速度隧道、气泡等 |
| 歌词 | DOM + CSS/SVG 滤镜：固定排版，每个字在唱到时原地出现 |
| 尾奏 | WebGL 片元着色器：多层迷幻万花筒 |

## 环境要求

- Node.js 18+
- Python 3，并安装 `numpy` 和 `pillow`：`pip install numpy pillow`
- ffmpeg，需要能在命令行直接调用

## 使用方法

### 1. 安装依赖
```bash
npm install
```

### 2. 准备素材（这些文件不在仓库里）
| 文件 | 位置 |
|---|---|
| 混音（wav） | `public/odddice.wav` |
| SVP 工程 | 任意位置，例如工程根目录的 `odddice.svp` |
| 字体 | `public/fonts/`：`jp-400.ttf` `jp-600.ttf` `jp-800.ttf`（Shippori Mincho），`en-300.ttf` `en-500.ttf`（Cormorant Garamond） |
| 歌词 | `lyrics.txt`（30 行，格式见文件内的注释） |

### 3. 生成数据
```bat
:: Windows (PowerShell)
.\scripts\build_data.bat odddice.svp public\odddice.wav
```
```bash
# macOS / Linux
bash scripts/build_data.sh odddice.svp public/odddice.wav
```
这一步会生成：
- `src/data/*.json`：逐字时间、拍点、音频特征；
- `timing_report.txt`：每个字的出现时间和对应的 SVP 音符，用来查错。

同时会自动判断混音的时间偏移，写入 `src/render-settings.json`。

### 4. 预览
```bash
npm run studio
```

### 5. 渲染
```bat
.\scripts\render.bat full                 :: 成片 → out\odddice_mv.mp4
.\scripts\render.bat preview              :: 半分辨率全片
.\scripts\render.bat range 93 145         :: 指定秒数区间
.\scripts\render.bat still 66.4           :: 单帧 PNG
```
macOS / Linux 用 `bash scripts/render.sh` 加同样的参数。

额外参数会原样传给 Remotion，例如 `--concurrency=6`。尾奏如果是黑屏，加 `--gl=swangle`。

## 常用调整

| 想改什么 | 位置 |
|---|---|
| 各段时间范围、背景、氛围层、每行歌词的动画样式 | `src/direction.ts` |
| 单个字的出现时间（代码内固定修正） | `src/direction.ts` → `GLYPH_TIMING` |
| 快句比歌声提前显示的程度 | `src/direction.ts` → `REVEAL_SPEED` |
| 副歌每句的动作 | `src/direction.ts` → `CHORUS_KIND` |
| 单个字的出现时间（不改代码） | `lyrics.overrides.json`，例如 `{"L18P0@-1": {"t0": 104.3}}`，改完重新跑 build_data |
| 标题、Covered by 那一行、尾奏落款 | `src/config.ts`（`TITLE` / `COVER_LINE` / `CREDITS`） |
| 歌词动画 | `src/lyrics/LyricLayer.tsx` |
| 氛围层图形 | `src/scenes/Atmos.tsx` |
| 尾奏万花筒 | `src/scenes/shaders.ts`、`src/scenes/GeoOutro.tsx` |
| 2:22 的震颤和红绿偏色 | `src/scenes/Tension.tsx` |

## 目录结构
```
scripts/        数据生成与渲染脚本（Python / bat / sh）
src/
  data/         build_data 生成的 JSON
  lyrics/       歌词动画
  scenes/       背景、氛围、黑场时刻、尾奏、标题
  lib/          时间轴与歌词时间计算
  direction.ts  分镜与演出参数
  config.ts     标题、落款、配色
public/         混音（不入库）和字体
```
