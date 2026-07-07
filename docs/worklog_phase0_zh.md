# Phase 0 工作日志（中文复盘版）

> 目的：日后复习、检查用。记录 Phase 0 每个任务做了什么、每个文件是干什么的、
> 代码关键逻辑、踩过的坑、以及各 gate 是怎么验证通过的。
> 仓库：https://github.com/KIM-ocean-HZ/flux （private）

---

## 一、任务完成总览

| ID | 任务 | 结果 | Gate 验证 |
|----|------|------|-----------|
| E1 | uv + Python 3.12 | ✅ | `uv run python --version` → 3.12.2 |
| E2 | 核心依赖 + import 冒烟 | ✅ | torch/transformers/peft/muspy 全部 import 成功，MPS 可用 |
| V1 | muspy 读 MIDI 打印指标 | ✅ | `uv run python -m research.metrics` 打印 8 项指标 |
| V2 | mgeval 决策 | ✅ | 决策文档 `docs/mgeval_decision.md`：muspy 为主线 |
| M1 | 安装 anticipation | ✅ | `import anticipation` 通过（以 git 依赖入 uv.lock） |
| M2 | AMT 下载 + Mac 跑通 generate | ✅ | music-small-800k 在 MPS 上生成 94 个事件（~21s） |
| M3 | events → MIDI + 可视化 | ✅ | 生成可播放 .mid（15 轨 94 音符）+ PNG 钢琴卷帘图 |
| X1 | 端到端：旋律→模型→MIDI→指标 | ✅ | 一条命令产出伴奏 MIDI + 指标 CSV，**7 秒音乐生成耗时 6.4s（MPS）** |
| D1 | 起步数据集 | ✅ | Essen 民歌库 10,457 首，抽样 50/50 解析成功 |
| D2 | 音乐表示决策 | ✅ | 决策文档 `docs/representation_decision.md`：对齐 AMT 事件编码 |
| C1 | 导师邮件 | ✅ 草稿 | `docs/supervisor_email_draft.md`（**需要你过目后自己发送**） |
| P1 | vertical slice 规格 | ✅ | `docs/vertical_slice_spec.md`：只做"垂直伴奏"，React+FastAPI |
| P2 | 仓库骨架 + 假数据后端 | ✅ | 前端渲染网格；`POST /api/suggest` 返回假 ghost |
| P3 | ghost 交互骨架 | ✅ | 连续两次 regenerate 返回不同 ghost（curl 验证）；build 通过 |

---

## 二、每个文件是干什么的

### 研究侧 `research/`

#### `research/sample_data.py` — 自带样例旋律
- 用 muspy 手工构造《小星星》（C 大调，14 个音，program 0 钢琴）写成 MIDI。
- **为什么存在**：让 metrics / pipeline / 前端 demo 都不依赖任何外部下载就能跑；
  而且这首歌的指标"应该长什么样"你心里有数（6 个音高、音域 9 个半音、
  scale_consistency 必须是 1.0），方便肉眼验证指标算得对不对。
- 关键点：`RESOLUTION = muspy.DEFAULT_RESOLUTION`（每四分音符 tick 数），
  音符是 `muspy.Note(time, pitch, duration, velocity)` 的列表，逐个累加 time。
- 前端 `App.jsx` 里预置的默认旋律与它**完全同一首**，体现"一个大脑两张脸"。

#### `research/metrics.py` — 客观指标（V1，评估的锚）
- `compute_metrics(music)` 返回 8 项 muspy 绝对指标：
  - `n_pitches_used` 用了几个不同音高；`n_pitch_classes_used` 几个音级；
  - `pitch_range` 音域（半音数）；`pitch_class_entropy` 音级分布熵（越高越"杂"）；
  - `scale_consistency` 最佳匹配音阶内音符占比（1.0 = 完全在调内）；
  - `polyphony` 平均同时发声数；`empty_beat_rate` 空拍比例；
  - `groove_consistency` 节奏型一致性。
- **踩坑 1**：`muspy.groove_consistency(music, measure_resolution)` 需要第二个参数
  （每小节 tick 数）。解决：按 4/4 拍取 `music.resolution * 4`。这是个假设，
  以后遇到非 4/4 数据要注意。
- `print_metrics` 打印并返回 dict，pipeline 复用它。
- 命令行用法：`uv run python -m research.metrics [xxx.mid]`，不给路径就先生成样例。

#### `research/generate.py` — 模型加载与生成（M2/M3，共享"大脑"）
- `pick_device()`：优先 MPS（Apple Silicon GPU），否则 CPU。
- `load_amt()`：`AutoModelForCausalLM.from_pretrained('stanford-crfm/music-small-800k')`
  → `.to(device)` → `.eval()`。加载时 transformers 报一个
  `token_out_embeddings UNEXPECTED`，属于跨架构加载的可忽略警告。
- `generate_events()`：包了一层 anticipation 的 `generate()`；**如果 MPS 上算子报错
  就自动把模型挪回 CPU 重试一次**（MPS 对个别采样算子支持不稳，这是保险丝；
  实测这次没触发，MPS 全程正常）。
- `save_midi()`：`convert.events_to_midi(events)` 返回 `mido.MidiFile`，`.save(path)`。
- `save_visual()`：`visuals.visualize(tokens, path)` 出钢琴卷帘 PNG。
- 文件顶部 `os.environ.setdefault("MPLBACKEND", "Agg")`：**必须在 anticipation.visuals
  import pyplot 之前设置**，否则无显示环境（脚本/CI）下 matplotlib 会出问题。
- 命令行跑它 = M2+M3：从零生成 5 秒音乐 → `data/generated/amt_from_scratch.mid/.png`。

#### `research/pipeline.py` — 端到端管线（X1，baseline 的雏形）★
这是 Phase 0 研究侧的核心成果，一条命令走完全链路：

1. **输入**：命令行给 .mid 路径，或默认用样例《小星星》。
2. **旋律 → 控制 tokens**：`convert.midi_to_events()` 把 MIDI 变成 AMT 事件流，
   再用 `tokenize.extract_instruments(events, [0])` 把 program 0（钢琴=旋律）的
   全部事件改标成 **control tokens**（时间/时值/音符三元组整体加 CONTROL_OFFSET）。
   这就是 AMT 论文里伴奏任务的官方机制："模型一边生成、一边'预知'（anticipate）
   给定的旋律"。函数里有断言：输入必须是单乐器旋律，否则报错提醒。
3. **生成**：`generate(model, 0, end_seconds, inputs=None, controls=旋律)`，
   控制非空时模型自动进入 anticipatory 模式（AAR）。
4. **合成**：`ops.combine(生成的事件, 旋律控制)` 把旋律折回事件流 →
   `events_to_midi` 存 `data/generated/e2e_accompaniment.mid` + PNG。
5. **评估**：对输入旋律和生成混音各算一遍 8 项指标，打印 + 追加写入
   `data/results/pipeline_metrics.csv`（含 device、top_p、生成耗时列）。

实测结果（本机 M 系列, MPS）：
- 14 个旋律音符 → 生成 64 个伴奏事件，**6.4 秒**生成 7 秒音乐 ≈ 准实时；
- 输出 78 音符 / 15 轨，旋律原样保留在 program 0，伴奏散布在弦乐/合奏等音色；
- 指标对比符合直觉：混音的 polyphony 1.0→2.76、pitch_range 9→81、
  scale_consistency 1.0→0.88（伴奏引入了调外音，这正是以后微调要改善的点，
  也是 E2 实验的动机）。
- **这份 CSV 就是以后 E1 baseline 表格的雏形；6.4s 也是 efficiency 轴的第一个数据点。**

#### `research/dataset.py` — 起步数据集（D1）
- 选了 **Essen Folk Song Database**：约 1.7MB、10,457 首单声部民歌（ABC 格式），
  muspy 内置 `EssenFolkSongDatabase(root, download_and_extract=True)` 自动下载解压。
- **为什么选它**：单声部旋律恰好是伴奏任务的**输入侧**，可以当 pipeline 的
  测试旋律池；体积小、下载源活着、License 干净。
- **微调语料另算**：Phase 1 用 Lakh MIDI 子集（AMT 自己的训练域），文档里写明了。
- **踩坑 2（重要）**：muspy 解析 ABC 走 music21，而新版 music21 (v9+) 删掉了
  `.flat` API，导致 10457 首**一首都解析不出来**（`'Part' object has no attribute
  'flat'`）。解决：`uv add "music21<9"` 钉回 8.3.0，之后 50/50 抽样解析全过。
  ——这正是导师说"环境是常被低估的坑"的活例子。
- **踩坑 3**：原计划的 JSB Chorales（巴赫众赞歌，仅 215KB）镜像
  （umontreal 学生主页）已经死了，curl 无响应，所以换 Essen。

### 决策文档 `docs/`

- **`mgeval_decision.md`（V2）**：一句话决策 = muspy 内置指标为主线。原版 mgeval
  是 Python2 时代、依赖弃维护的 python-midi、Mac 上装不上；如审稿需要
  transition-matrix 类指标，再试现代复刻 `lucainiaoge/midi-obj-eval`，但不阻塞主线。
- **`representation_decision.md`（D2）**：表示法对齐 AMT 的 arrival-time 事件编码
  （每音符 3 token：到达时间 100 bins/秒、时值、音符=乐器×128+音高；控制 token
  = 同三元组加偏移）。理由：基座模型就是用这套词表训练的，自造表示 = 白白引入
  转换层风险；控制机制天然是一等公民，正好承接 §3.3 的可控性研究。
  边界划分：模型层用 AMT tokens / 指标与数据集层用 muspy Music / 前后端用
  JSON 音符（beats 为单位）/ 磁盘交换用 MIDI。
  文末写了"重访条件"：若 Phase 1 需要小节/拍感知的控制（此编码是墙钟时间、
  无节拍概念），要和导师重新讨论。
- **`supervisor_email_draft.md`（C1）**：给 Dr. Shvets 的英文邮件草稿，
  含 §3.8 五个问题（ComfyUI 适配、基座模型确认、微调数据集、评估是否够/要不要
  用户研究、目标会议）。开头一段是真实的 Phase 0 进展汇报（含 6.4s 延迟数据）。
  **⚠️ 待办：这封邮件需要你自己过目、修改、发送——我只负责草稿。**
- **`vertical_slice_spec.md`（P1）**：锁定规格 = 只做"垂直伴奏"一个 ghost 行为；
  React+Vite web 前端 + FastAPI 后端；协议 `POST /api/suggest`，JSON 音符
  `{pitch, time, duration, velocity}`（单位：拍）。水平动机发展是 stretch。
  明确排除：播放打磨、多轨 UI、MIDI 导入、会话持久化、Logic 插件。

### 产品侧 `backend/` + `frontend/`

#### `backend/main.py` — FastAPI 假数据后端（P2）
- 一个端点 `POST /api/suggest`：收 `{notes: [...]}`，返回 `{ghosts: [...]}`。
- 假伴奏逻辑：对每个**落在整拍上**的旋律音符，生成低八度根音（velocity 60）
  + 70% 概率再加一个下方大/小三度（随机选），随机性保证每次 regenerate
  肉眼可见地不同（P3 gate 的需要）。
- Pydantic 模型 `Note {pitch, time, duration, velocity=80}` 就是协议本身；
  换真模型时只改 `suggest` 函数体，协议、前端零改动（"一个大脑两张脸"）。
- CORS 允许 `http://localhost:5173`（Vite dev 源）。
- 启动：`uv run uvicorn backend.main:app --reload --port 8000`。

#### `frontend/` — React + Vite 钢琴卷帘（P2+P3）
- **`package.json`**：仅 react/react-dom + vite/@vitejs/plugin-react，无重型 DAW 库。
- **`vite.config.js`**：dev server 把 `/api` 代理到 8000 端口后端，前端代码里
  直接 `fetch('/api/suggest')`，部署时同样适用反向代理模式。
- **`src/PianoRoll.jsx`**：手写 SVG 钢琴卷帘。
  - 网格：C3–C6（MIDI 48–84）共 37 行 × 16 拍；黑键行底色加深；每 4 拍粗线；
    C 行标注音名（C3/C4/C5/C6）。
  - 坐标换算：`pitchToY = (84 - pitch) * 行高`；点击空白处反算出 (pitch, beat)
    → `onAddNote` 加一个 1 拍音符；点击已有音符 → `stopPropagation` + 删除。
  - **ghost 音符**：半透明橙色 (`opacity 0.45`)、`pointer-events: none`（点不到，
    防止误删除/误添加穿透）；已确认音符：实心蓝色。
- **`src/App.jsx`**：交互状态机（P3 核心）。
  - 状态：`notes`（已确认）、`ghosts`（建议）、`loading`、`error`。
  - `suggest()`：POST 当前 notes → 收 ghosts；按钮文案在 Suggest/Regenerate
    之间切换（有 ghost 时点击 = 重新生成一批）。
  - `accept()`：ghosts 并入 notes 后清空；`reject()`：直接清空 ghosts；
    另有 Clear 清屏按钮。
  - 默认预置《小星星》= 和研究管线同一输入，打开页面即可一键出 ghost。
- **`src/styles.css`**：深色 DAW 风格主题，蓝=确认音符、半透明橙=ghost。
- 验证：`npm run build` 通过（197KB bundle）；dev server + curl 走代理连发两次
  suggest，返回的 ghost 集合不同 → P3 gate 达成。

### 其他改动

- **`.gitignore`** 新增：`CLAUDE.md`（个人工作准则不上传）、`data/`（数据集与
  生成产物，全部可由脚本复现）、`frontend/node_modules/`、`frontend/dist/`。
- **`pyproject.toml` / `uv.lock`**：新增 anticipation（git 依赖，锁定 commit
  af37397）、fastapi、uvicorn、matplotlib、mido、tqdm、**music21<9（关键钉版）**。
- **`README.md`**：重写为研究轨 + 产品轨双板块，含全部可复现命令。
- **`main.py`**（根目录）：uv init 遗留的 hello-world，没动它，留待以后清理。

---

## 三、踩坑记录（复习重点）

1. **`groove_consistency` 签名**：muspy 文档里不显眼，必须传每小节 tick 数；
   我们按 4/4 假设取 `resolution*4`。
2. **music21 v9+ 删除 `.flat`**：muspy 0.5 的 ABC/music21 输入路径直接崩。
   钉 `music21<9` 解决。教训：**老工具链（muspy 2020 年代初）+ 新依赖 = 定时炸弹，
   uv.lock 的意义就在这**。
3. **JSB Chorales 镜像已死**：muspy 内置数据集的 URL 会腐烂，选数据集前先
   `curl -I` 验证源是否活着。
4. **matplotlib 无头环境**：要在 import pyplot 前设 `MPLBACKEND=Agg`。
5. **MPS 兼容性**：本次 torch 2.12 在 MPS 上全程正常，但 generate.py 留了
   CPU 自动回退，属于低成本保险。
6. **zsh 的 URL 通配符**：curl/gh api 带 `?` 的 URL 必须加引号，否则 zsh 报
   "no matches found"。

---

## 四、Gate 对照与遗留事项

**Phase 0 研究侧 gate（"能跑模型并打分"）**：✅ `research/pipeline.py` 一条命令
= 模型 → MIDI → 指标 CSV。
**Phase 0 产品侧 gate（"网格渲染假 ghost"）**：✅ 前端网格 + stub 后端 +
accept/reject/regenerate 闭环。

遗留待办（Phase 1 入口）：
1. **发导师邮件**（草稿在 `docs/supervisor_email_draft.md`，需你过目后发送）；
2. 听一下 `data/generated/e2e_accompaniment.mid`（我只能验证结构，没法替你听）；
3. Phase 1 开工点：文献地图 + E1 正式 baseline（用 Essen 旋律批量跑 pipeline）
   + 首次 LoRA 微调；产品侧把 stub 换成 `research.generate`。
4. 根目录 `main.py` 是脚手架遗留，可在下次清理。
5. 本日志若嫌太个人化，开源仓库前可移出 docs/。

---

## 五（补充，2026-07-06 第二次会话）：A/B 试验与方向修正

试听反馈（"15 轨大杂烩，难听"）触发了一轮修正，全部已落地：

1. **乐器约束解码原型**：`research/pipeline.py` 新增 `instrument_constraint`
   （上下文管理器，替换 anticipation 采样器的乐器掩码钩子），`run()` 新增
   `model_name / allowed_instruments / tag / model` 参数。
2. **2×2 A/B**（`research/ab_test.py`）：small/medium × 无约束/约束{钢琴,贝斯,鼓}。
   结论：约束一步把 15 轨大杂烩收敛成钢琴+鼓（`ab_small_constrained.mid`，
   当前听感基准）；medium 对玩具旋律反而沉默（4–12 事件）——《小星星》7 秒
   裸旋律对 Lakh 训练的模型是分布外输入，Phase 1 必须换真实旋律评估（任务 D4）。
3. **踩坑 7**：采样偶发越界 token 会崩 `events_to_midi` 断言 → `sanitize_events`
   生成后清洗畸形三元组并告警（批量实验不能因单 token 中断）。
4. **产品语义修正**：纵向 = 用户指定目标轨的伴奏生成（约束解码硬保证）；
   横向 = 单轨续写。`docs/vertical_slice_spec.md` 已更新，协议加 `target_instrument`。
5. **导师邮件重写**为跟进口吻（6 月中首封未回）：进展汇报 + 已采默认决定 +
   仅一个主问题（RQ 三选一），署名 Hanze Jin。见 `docs/supervisor_email_draft.md`。
6. **计划文档修订**（本地 plans/，不入库）：EN/CN 计划标注 Phase 0 完成与实测结果、
   Phase 1–3 重排日期（P1: 7/7–8/2）、RQ 收敛、决策记录；新增 `plans/flux_phase1.xlsx`
   （16 任务 + 候选 RQ 映射 + 新增决策三个 sheet）。
7. **Khala 调研结论**（详见会话记录）：音频域歌曲生成 SOTA，不接入系统，
   写进论文 related work 做 gap 反衬。

## 五之二（补充，2026-07-07）：导师回复落地

跟进邮件当天获回复。要点与落实：

1. **沉默原因**：6–7 月她忙会议报告 + 基金收尾——不是不重视。此前"低成本提问 +
   默认推进"的策略被验证有效（她一段话就把五个问题全回了）。
2. **五个开放问题全部关闭**（详见计划 §3.8）：技术选型被认可；**RQ 方向明确交给
   我自己定**（工作决定：RQ-a 主轴 + RQ-b 第二轴）；**用户研究因伦理审批出局**，
   E5 重构为客观交互评估（在轨率 / regenerate 多样性 / 延迟——不涉人类被试）；
   会议自查。
3. **会议 deadline 已查明（2026-07-07）**：
   - NeurIPS 2026 Creative AI Track：**8/3 截稿**，2–6 页，主题 Agency，9/18 出结果
     （申请季前唯一接收机会）→ xlsx 新增任务 W1：7/20 前按 K1 进展 go/no-go；
     注意接收需赴悉尼现场。
   - NIME 2027（巴黎）：CFP 未出，惯例 1 月底截稿 → **主目标**（也是导师的社区）。
   - AIMC 2027：约明年 4–5 月 → 备胎 / gap-year。
4. 更新的文件：计划 EN/CN §1.6/§3.7/§3.8、`docs/supervisor_email_draft.md`（标注
   已回复+要点归档）、`plans/flux_phase1.xlsx`（C2/C3 完成、新增 W1、RQ sheet 更新）。
5. 其余 Phase 1 任务按约定等我本人开工后再展开。

## 六、快速复现命令（备忘）

```sh
uv sync                                  # 装环境（含钉版 music21<9）
uv run python -m research.metrics        # V1：指标 demo
uv run python -m research.generate       # M2/M3：从零生成 + 可视化
uv run python -m research.pipeline       # X1：端到端（伴奏 + CSV）★
uv run python -m research.dataset        # D1：下载/枚举 Essen

uv run uvicorn backend.main:app --reload --port 8000   # 后端
cd frontend && npm install && npm run dev               # 前端 → :5173
```
