# FLUX 阶段 A 交付记录：可听工作台与和弦输入

日期：2026-09-27。状态：**DELIVERED / 待复核**，不是“已验收”。2026-09-28 跟进：用户反馈的 11 项已处理，见 [跟进记录](PHASE_A_FOLLOWUP_2026-09-28.md)；Safari.app 人工测试由用户报告通过（第 7 节）。执行依据：[HANDOFF_A_2026-09-27](../archive/2026-10-02/docs/HANDOFF_A_2026-09-27.md)；产品行为以 [DAW_SPEC](DAW_SPEC_2026-09-26.md) 为准。B 阶段未开工。

## 1. 结论

A1–A3 已连续实现：浏览器里可以 **新建 → 启用声音并载入 SF2 → 设速度／拍号 → 电脑键盘试弹、实时录音或步进 → 多轨回放、Mute/Solo/音量、卷帘编辑与撤销 → 查看和弦识别 → 采用建议或手选根音＋类型＋低音 → 查看调性候选、级数与进行 → 保存项目 JSON、导入导出 MIDI**。CH-01–CH-08 均有对应的自动化测试和浏览器操作。

自动化证据分三层，彼此不能替代：

1. **纯函数与合成器离线渲染**（vitest 92 项）：时间、GM 目录、和弦字典／识别／分段、调性与级数、项目模型、撤销、MIDI、键盘状态机、调度器；以及用与浏览器 worklet 相同的 `spessasynth_core` 和 GeneralUser GS 离线渲染出非零音频、通道隔离与定时精度。
2. **真实浏览器自动化**（Playwright 驱动本机 Google Chrome 153 与 Playwright WebKit 26.6，5173 与 8000 两个入口）：用真实键盘／鼠标事件操作页面，从 Web Audio 图中的 AnalyserNode 读电平。自动化运行的 Chrome 为 headless 并带 `--mute-audio`，所以证明的是音频图里确有信号，**不是扬声器里被听见**。
3. **独立解析器**：Python mido 读回浏览器实际导出的 MIDI，并生成导入用夹具。

**Safari.app 实机：**用户按第 12 节第 7 步人工测试，2026-09-28 报告通过（本机 Safari 未开启“允许远程自动化”，自动化仍只能用 WebKit 近似）。

**仍需人工完成（NOT RUN）：** Chrome 真人耳听；真人手指演奏四小节的手感与可感知延迟；用户实际键盘的多键冲突。第 12 节给出 10 分钟人工验收步骤。因此阶段 A 保持“待复核”。

## 2. 基线、改动与依赖

开工基线（2026-09-27 14:09）：分支 `main`，HEAD `3a1dee0338e3953012390d84a1da93a08ab37587`；工作区已有大量未提交／未跟踪修改（README、backend/main.py、pyproject/uv.lock、research/dataset.py、docs 删除与新增、core/、archive/、scripts/、tests/ 等）。这些修改原样保留，没有清理、回滚或提交。本阶段**没有执行 git commit 或 push**。

相对开工工作区的新改动：

| 路径 | 改动 |
|---|---|
| `frontend/src/music/` | 新增纯函数：`time.js` 时间模型；`gm.js` GM 目录；`chords.js` 和弦字典、拼写、识别与分段；`analysis.js` 调性候选、级数、进行；`project.js` 项目模型、编辑与校验；`history.js` 撤销；`midi.js` SMF 导入导出；`keyboard.js` 键位、焦点、录音 take、步进分组 |
| `frontend/src/audio/` | 新增 `engine.js`（AudioContext、SpessaSynth、通道、试弹、运输）、`scheduler.js`（音频时钟调度）、`perf.js`（计时）、`soundbankCache.js`（浏览器缓存音源） |
| `frontend/src/components/` | 新增顶栏、运输栏、轨道列表、音色选择器、时间线（时间尺／和弦行／级数行／卷帘）、和弦与调性面板、键盘面板、对话框 |
| `frontend/src/App.jsx`、`styles.css`、`index.html` | 重写为新工作台；页面语言 zh-CN；空 favicon 消除 404 |
| `frontend/src/PianoRoll.jsx` | 删除：被 `components/Timeline.jsx` 取代后不再引用 |
| `frontend/tests/` | 新增 10 个 vitest 文件（92 项） |
| `frontend/e2e/` | 新增浏览器验证脚本 `phase_a.mjs`、mido 夹具生成 `make_fixtures.py`、导出读回 `check_exports.py` |
| `frontend/scripts/midi_cli.mjs` | 新增：与页面同一套 MIDI 代码的命令行入口，供跨语言检查 |
| `frontend/package.json`、`package-lock.json`、`vite.config.js` | 新增依赖与 `test` 脚本、vitest 配置 |
| `tests/test_phase_a_midi.py` | 新增：mido 读回 JS 导出、JS 导入 mido 写出的 MIDI |
| `README.md`、`docs/RESEARCH_RESET_2026-09-26.md`、`docs/HANDOFF_A_2026-09-27.md` | 只改状态段／入口说明 |

未改动：`backend/main.py`、`pyproject.toml`、`uv.lock`、`tests/test_web_entry.py`（开工与交付时 SHA-256 相同），`/api/suggest` 保留。已跟踪的前端文件 diff +1582／−161 行；新文件约 5700 行（含测试与验证脚本）。

新增依赖（全部精确锁定）：

| 包 | 版本 | 用途 | 许可 |
|---|---|---|---|
| `spessasynth_lib` | 4.3.14 | AudioWorklet SF2/SF3 合成器 | Apache-2.0 |
| `midi-file` | 1.2.4 | SMF 读写 | MIT |
| `spessasynth_core`（dev） | 4.3.22 | Node 离线渲染测试；与 lib 的传递依赖同版本 | Apache-2.0 |
| `vitest`（dev） | 5.0.2 | 前端测试 | MIT |
| `jsdom`（dev） | 30.1.1 | 键盘事件测试环境 | MIT |
| `playwright`（dev） | 1.63.0 | 浏览器验证；WebKit 构建 2359 下载到用户缓存目录 | Apache-2.0 |

Python 无新增依赖。`npm audit` 报告 4 项（browserslist、nanoid、postcss、baseline-browser-mapping），均在开工前已有的 Vite 构建链中，属无关升级，本阶段未处理。工具：Node v24.11.0、npm 11.6.1、uv 0.11.21、Python 3.12（.venv）。

## 3. 音频方案与音色

- **引擎：** 单个 `AudioContext` + 单个 SpessaSynth `WorkletSynthesizer`。“启用声音”在点击手势内创建并 `resume()` 上下文；状态依次显示“正在启动／需要选择音源文件／正在载入音源／声音就绪／失败（可重试）”，并显示 GM 覆盖（如 `GM 128/128 + 鼓组`）。没有音源时不会显示就绪。无效文件先校验 RIFF 头；SpessaSynth 解析失败只发 `soundBankError` 事件、Promise 不返回，引擎把该事件与 60 秒超时都当作失败处理。
- **通道：** 每条项目轨道固定一个合成器通道（0–12，超出后动态新增 16+），同 program 的两条轨道也是两个通道；鼓轨对其通道 `setDrums(true)`。试弹用独立通道 14，试听／预览用 13，节拍器用 15（鼓）。音量为 CC7；Mute/Solo 通过通道 `isMuted`，Mute 优先、可多轨 Solo。
- **调度：** Worker 计时器每 25 ms 唤醒，提前 120 ms 把事件以**绝对 AudioContext 时间**交给 worklet；所有时间由同一锚点（anchorTime ↔ anchorTick）计算，循环不累积漂移。React 只负责显示，播放头由 `requestAnimationFrame` 直接改 DOM。
- **停止／跳转／改速：** SpessaSynth 没有清空已排队事件的接口。停止时先在当前时间发出所有待发的 note-off，再把轨道通道设为静音直到已排队的事件全部过期（静音通道会丢弃到期的 note-on，已用离线渲染验证），然后恢复。改速度、拍号或循环范围时从当前位置重新锚定。循环尾截断正在发声的音，下一轮重新触发；跨过循环起点的长音不在下一轮重奏（首版行为）。
- **录音时间：** 键盘事件的 `timeStamp` 通过 `AudioContext.getOutputTimestamp()` 映射到“此刻正在被听到的”上下文时间，再换算 tick；不支持时退回 `currentTime`。不减任何固定毫秒，原始 tick 不量化。
- **Tone.js 未引入：** 上述时钟已由音频时间直接驱动，不需要第二个时钟。
- **音色（仅本地验证，未随仓库分发）：** GeneralUser GS **v2.0.3**，作者 S. Christian Collins；取自 `github.com/mrbumpy409/GeneralUser-GS`，commit `684543d5e5efaef08d02be50dcda8d552478fa60`（2026-02-23）。`GeneralUser-GS.sf2` 32,319,396 bytes，SHA-256 `9575028c7a1f589f5770fccc8cff2734566af40cd26ed836944e9a5152688cfe`；许可文件 `documentation/LICENSE.txt`（License v2.0）SHA-256 `7b32efefdf95ce38a043799f0659853ddc00fbaa14d8c50f0aca16b9b8b405be`。许可允许个人／商业音乐创作与在软件项目中使用，作者同时声明部分历史采样来源无法百分之百确认、并要求不要直链其下载文件。本机副本在 `data/phase_a/soundfonts/`（`data/` 已被 .gitignore 忽略）。287 个预设，bank 0 覆盖全部 128 个 GM melodic program，另有 13 套鼓组。正式捆绑前需再核许可。
- **加载与标识：** 用户通过“选择音源文件”载入任意本地 SF2/SF3/DLS。项目只记录 `soundbankId = 文件名:字节数:SHA-256 前 16 位` 及名称、大小、完整 SHA-256，不写机器路径。同一浏览器会把最近一次音源存进 IndexedDB，刷新后点“启用声音”即自动载入（存储不可用时退回手动选择）。打开引用了其它音源的项目时显示“重新定位”横幅，可选择文件或“改用当前音源”（可撤销）。

## 4. 数据表示（B 阶段可直接读取）

项目 JSON `schemaVersion: 1`，`ppq: 960`，整数 tick，`quarterBpm` 为四分音符 BPM。结构与 DAW_SPEC §8 一致：

```text
Project  id, schemaVersion, revision, name, ppq, quarterBpm, timeSignature{numerator,denominator},
         loopRange{startTick,endTick,enabled}, keyContext?, chordTrack[], tracks[], generations[], soundbanks[]
Track    id, name, role, program(0–127), isDrum, soundbankId, volume(0–127), pan, mute, solo, clips[1]
Clip     id, startTick, lengthTick, status: committed, origin: user, notes[]
Note     id, pitch, startTick(相对片段), durationTick(≥1), velocity(1–127)
ChordEvent id, startTick, durationTick, kind: chord|no_chord, chord?, source: manual|midi_detected|harmonized,
         status: suggested|confirmed, sourceTrackId?, sourceNoteIds?, sourceSignature?
Chord    rootPc(0–11), rootSpelling("Db"), quality, additions[], bassPc?, bassSpelling?
KeyContext tonicPc, tonicSpelling, mode: major|minor, source: user|inferred, status: confirmed
```

- `quality` 与 `additions` 取自唯一字典 `CHORD_TYPES`（`src/music/chords.js`）：maj、min、dim、aug、7、maj7、m7、sus2、sus4、maj+add9、min+add9、maj+add11、6、m6、9。识别、手选、预览音型、符号与级数都读同一张表；和弦符号由结构化字段生成，保存用户选择的升降号拼写。
- **B 阶段的控制输入**：`chordTrack.filter(e => e.status === 'confirmed')`（含 N.C.，按左闭右开区间且互不重叠），以及 `keyContext`（仅 `status: confirmed` 视为确定）。空白区间就是“未指定”，N.C. 是明确无和弦。
- **不持久化的派生结果**：MIDI 识别建议（虚线）与分析（调性候选、级数、进行标签、转调提示）每次由当前项目计算，带 `analysisVersion: "phase-a-1"` 与 `inputRevision`，不写进项目。旧文件中 `status: suggested` 的事件可以读入并按建议显示，不进入确认集合。
- **来源变化**：确认事件记录 `sourceTrackId` 与该范围音符的 `sourceSignature`；源音符改动后显示“输入已变化，可重新分析”，不改写事件，用户可“用新识别替换”或“保留（标记已查看）”，都可撤销。
- `revision`：每个音乐编辑、和弦／调性修改、撤销、重做都会递增，不会回退；Mute/Solo/音量、循环范围、改名和音源标识不改变 revision，也不进入撤销。
- `generations` 为空数组，未实现 B 阶段作业。

## 5. 前端规则的组织

规则都在不依赖 DOM 和音频的纯函数里（`src/music/`），界面组件只调用它们：

- **识别**（`detectChord`）：同时发声的音按音级去重做类型匹配，最低实际音决定转位；只有 1–2 个音级返回“未确定”并显示音名／音程；字典外的集合返回“无法识别”并说明原因，不降级成三和弦。七和弦、九和弦与 add9 允许省略五音（标为不完整）。候选分数只用于排序，界面显示“明确匹配／多种解释／未确定”，不显示概率。歧义由音本身判断，调性上下文只调整顺序（C–E–G–A 在 C 大调首选 C6、在 A 小调首选 Am7/C，两者都保留）。
- **分段**（`segmentChords`）：按音符实际重叠切分时间段，每段单独识别；短于 1/16 的片段（手指先后、连奏重叠）忽略；两个相同和弦之间短于一拍的经过音并入；相邻相同结果合并。依次出现的单音永远不会被合成一个和弦。只分析当前选中的音高轨，鼓轨不参与。建议边界对齐到 1/16。
- **上下文**（`analyzeHarmony`）：24 个调逐一评分——和弦是否属于该调（副属和弦、同主音借用给部分分）、开头／结尾主和弦与 V–I 终止、以及按时值和强拍加权的 Krumhansl–Kessler 音高分布。孤立和弦或音太少时状态为“证据不足”，不给唯一调性；前两名相差 <0.05 为“接近”。未确认时按推测调性暂定显示（斜体、标“推测”），确认后按确认调性。级数保留性质与转位（`I⁶`、`V⁶₅`、`I add9`、`Vsus4`、`vii°`）；副属和弦按“属功能和弦下行五度解决到非主和弦的调内和弦”规则识别，同主音借用按平行调音阶识别；进行模式（I–V–vi–IV、ii–V–I、正格／变格／阻碍终止、借用小下属、小调进行等）按级数序列匹配；四和弦窗口若完全属于另一调而不适合当前调，提示“可能转调（待确认）”。没有写死任何示例答案，也不依赖网络 LLM。

## 6. 验收结果

证据位置：`data/phase_a/evidence/`（被忽略的目录；复现方法见第 10 节）。`final-*` 为交付代码的最终运行，`perf-*`、`perf-chord-*` 为性能运行；`dev-*`、`prod-*` 是修复过程中的中间运行，保留作过程记录，其中部分失败已在 6.1 节说明，结论以 `final-*` 为准。

| 编号 | 结果 | 证据与说明 |
|---|---|---|
| A-01 音源启用、失败恢复、完整 GM／鼓 | **自动化 PASS；Safari.app 用户人工通过（2026-09-28 报告）；Chrome 耳听 NOT RUN** | 目录 128＋鼓组断言（`gm.test.js`）；离线渲染 128 个 program 全部出声、12 个鼓件出声（`audio-render.test.js`）；浏览器中目录 129 行、8 个常用预设、搜索“贝斯”、试听电平、16 个家族各一个 program 与 3 个鼓件经电脑键盘发声（Chrome、WebKit × 5173/8000）。无效音源文件的报错与重试路径由代码实现，浏览器中未专门注入失败文件（见第 11 节） |
| A-02 同音色双轨隔离、Mute/Solo、独立音量 | **自动化 PASS；耳听 NOT RUN** | 离线渲染：同 program 同音高两通道，一方 note-off／CC7=0／静音不影响另一方。浏览器：导入两条 program 0 轨（中央 C 重叠）＋两条鼓轨，分别接每轨通道的 AnalyserNode：A 结束后 B 电平仍约为 A 的 50 倍；A 音量 0 时 B 不变；Mute、多轨 Solo、Mute 优先均按规则为 0／非 0；停止后传输通道 voice 为 0。循环录音到尾自动停止并在循环尾关闭按住的音 |
| A-03 试弹、录音、步进、焦点／悬挂音 | **自动化 PASS；真人演奏 NOT RUN** | jsdom 键盘测试 12 项（键位 A=60、重复键、修饰键、输入法、文本／BPM／搜索／下拉／可编辑／对话框不发声、换八度释放旧音、失焦全部释放、录音 take、步进分组）。浏览器：在轨名、BPM、音色搜索框里打字不发声；按住重复只起一个音；换八度与失焦后无按住的音、电平 < −80 dB；90 BPM 带一小节倒数录入 4 小节 16 个音并回放出声；步进 1/8 和弦一次写入同一起点、整组松开只前进一次、休止只前进；屏幕琴键可点击发声 |
| A-04 tick／秒／小节、120→60 BPM、3/4 与 6/8 重音 | **PASS** | `time.test.js`、`scheduler.test.js`；浏览器中同一小节 120 BPM 调度时长 2.000000 s、60 BPM 4.000000 s；3/4 节拍器重音 bar-beat-beat，6/8 为两组附点四分（间隔 0.75 s）；录音后改 90→60 BPM、4/4→3/4→6/8，音符 tick 完全不变（和弦 tick 见 CH-08） |
| A-05 编辑、录音、和弦操作撤销／重做 | **PASS** | `history.test.js`（录音、移动、删除、量化、和弦写入／改动／确认来源变化，逐步比对项目状态；revision 只增不减；Mute/Solo/音量不被撤销）。浏览器：双击添加、拖动移动、拖右缘改长、Delete、⌘Z 与按钮撤销／重做逐步还原；显式量化可撤销 |
| A-06 JSON 与 MIDI round-trip、非法输入、复杂文件 | **PASS** | `project.test.js`（深度相等、11 类非法文件）；`midi.test.js`；`test_phase_a_midi.py`（mido 读回 JS 导出、JS 导入 mido 写出，PPQ 480→960）；浏览器：刷新页面后重新启用声音、打开保存的项目与文件深度相等、无音源提示；非法 JSON 报错且当前项目不变；复杂 MIDI（变速、CC64、弯音、中途换音色、PPQ 384 取整）列出限制，取消后项目不变、确认后导入；打开引用其它音源的项目出现重新定位提示；五组流程导出的 MIDI 由 mido 读回全部一致（`check_exports.py`） |
| A-07 CH-01–CH-04 | **PASS（真实电脑键盘复音输入由自动化键盘事件完成；真人 NOT RUN）** | 见下方 CH 表 |
| A-08 CH-05–CH-08 | **PASS** | 见下方 CH 表 |
| A-09 持续播放与交互性能 | **PASS（自动化，headless Chrome）** | 见第 8 节 |
| A-10 原入口与范围保护 | **PASS** | 构建成功；原 Python 回归 23 项 + 新增 2 项全部通过；5173（Vite 开发）与 8000（后端提供构建产物）都加载新界面，worklet 资源在两处都返回 200；受保护目录哈希前后一致（第 13 节） |

| CH | 结果 | 证据 |
|---|---|---|
| CH-01 | **PASS** | 电脑键盘按 60-64-67 显示 **C**，按 52-55-60 显示 **C/E**；项目 revision 不变；note-on 直接发出（键盘事件到 `noteOn` 调用 p95 ≤1 ms），和弦显示在约 80 ms 稳定窗口后更新 |
| CH-02 | **PASS** | 步进写入 C 和弦后自动出现建议并可采用（来源 `midi_detected`，状态 confirmed）；导入含同时发声 C 和弦与依次 C–D–E 的文件，只给出 1 个 C 建议；选中鼓轨时无建议 |
| CH-03 | **PASS** | C–E–G–A 显示“C6 · 多种解释 · 备选 Am7/C”；快速换键后只保留当前按住的 F–C（显示双音程、未确定），失焦后清空；单测覆盖 D 调同构移调、打乱顺序、八度重复、增三和弦对称歧义、dim7／maj9 不伪报 |
| CH-04 | **PASS** | 手选编辑器 15 种类型逐一选择并显示构成音；Cadd9 无 B♭、C9 含 B♭、Csus4 无 E；低音 E 保存为根音 C、低音 E；试听有电平；拖动和弦右缘从 1 小节改为 1.25 小节并按左闭右开截短后一个和弦 |
| CH-05 | **PASS** | 确认 C 大调：C–G–Am–F → I–V–vi–IV（1–5–6m–4），Dm7–G7–Cmaj7 → ii7–V7–Imaj7（ii–V–I）；改选 G 大调后 C 显示 IV，和弦与音符 JSON 前后相同；单测另覆盖 E♭ 大调、A 大调、F 大调中的 V |
| CH-06 | **PASS** | C–D7–G–C–F–Fm–C 未确认时推测 C 大调，确认后 I–V7/V–V–I–IV–iv–I，列出“副属和弦”“借用小下属”“借用和弦（来自 C 小调）”；孤立 C 和弦显示“证据不足”、不给级数；单测：G 大调 V7/vi、C 大调 V/vi、F 大调 IV–iv–I、上下文不同使同一 D7 读作 V7、N.C. 打断进行 |
| CH-07 | **PASS** | 采用 C–G–Am–F 后把第 1 小节一个源音从 C 拖到 D：确认和弦不变，出现 ⚠ 与“输入已变化，可重新分析（当前识别 Cadd9）”；修改和弦后撤销／重做精确还原结构、状态与来源 |
| CH-08 | **PASS** | 保存 → 刷新 → 重新打开：结构、低音、拼写、来源、调性与文件深度相等；改 133 BPM、6/8 后和弦 tick 不变；导出 MIDI 轨数 = 项目轨道数 + 1 条速度轨，和弦不变成音符 |

### 6.1 验证中发现并修复的问题

| 发现方式 | 问题 | 处理 |
|---|---|---|
| Chrome 冒烟测试 | 注册全局键盘监听的 effect 没有依赖数组，每次重渲染的清理都会释放按住的键，导致和弦按不住 | 监听只注册一次，通过 ref 读取最新处理函数 |
| 单元测试 | MIDI 导入的“PPQ 取整”提示在音符换算之前生成，取整永远不被报告 | 换算完成后再生成提示 |
| 浏览器测试 | 循环录音到尾自动停止时，按住的音按“输出时间”先被释放，比循环尾早约 25 tick 结束 | 停止时先用停止位置结束 take，再释放按键 |
| 浏览器测试 | 音色选择器打开时若项目被替换，组件读取不存在的轨道而报错 | 轨道不存在时不渲染选择器 |
| 截图检查 | 空项目也列出无意义的调性候选 | 没有音符和和弦时只保留手选调性 |
| 计时数据 | 和弦显示耗时统计在松键时沿用了旧时间戳，得出 7970 ms 的错误 p95 | 松键时清除时间戳；最终数据见第 8 节 |

其余中间失败属于测试脚本问题（Chrome 在有文字的搜索框中按 Esc 只清空文字、拖动点超出可视区域、夹具 G/F 只有根音和五音等），已修正脚本或夹具，不改变产品行为。

## 7. 浏览器与设备记录

| 项 | 记录 |
|---|---|
| 系统 | macOS 26.5（25F71），Apple Silicon |
| 默认输出设备 | Audient iD4（USB，44.1 kHz）；非蓝牙。另有 DisplayPort 显示器输出 48 kHz |
| Chrome | Google Chrome 153.0.8010.54（本机安装版），由 Playwright `channel: 'chrome'` 驱动，headless、`--mute-audio`；AudioContext 44100 Hz，baseLatency 5.8 ms，outputLatency（浏览器报告）16 ms |
| WebKit | Playwright WebKit 26.6（构建 2359），headless；AudioContext 44100 Hz，baseLatency 2.9 ms，outputLatency 报告 0.3 ms（headless 下不代表真实设备） |
| Safari.app | 26.5 已安装；自动化未运行：`safaridriver` 返回 “You must enable 'Allow remote automation'…”。**用户人工测试通过**（按第 12 节第 7 步，2026-09-28 报告；该测试针对 2026-09-28 跟进改动之前的界面） |
| 音源 | GeneralUser GS v2.0.3（第 3 节哈希） |
| 听感 | **NOT RUN**：自动化只读取音频图电平；JS 调度时间不等于可感知延迟 |

最终运行结果（交付代码）：

| 运行 | 浏览器 | 入口 | 检查项 | 控制台错误 | 导出 MIDI 读回 | 4 小节实录最大偏差 |
|---|---|---|---|---|---|---|
| `final-chrome-5173` | Chrome 153.0.8010.54 | Vite 5173 | 47/47 PASS | 0 | 5/5 一致 | 14 tick |
| `final-chrome-8000` | Chrome 153.0.8010.54 | 后端 8000（构建产物） | 47/47 PASS | 0 | 5/5 一致 | 15 tick |
| `final-webkit-5173` | WebKit 26.6 | Vite 5173 | 47/47 PASS | 0 | 5/5 一致 | 3 tick |
| `final-webkit-8000` | WebKit 26.6 | 后端 8000（构建产物） | 47/47 PASS | 0 | 5/5 一致 | 4 tick |

每个目录含 `results.json`（每项检查的细节、引擎信息、页面刷新前后的计时汇总）、截图、五组流程的项目 JSON 与 MIDI、`midi-readback.json`。“4 小节实录偏差”是自动化键盘在 90 BPM 按四分音符按键时，录入起点相对理想网格的最大偏差（960 tick = 一拍），包含测试脚本自身的计时抖动。

## 8. 性能（A-09 与和弦分析）

**8 轨循环（A-09，8000 入口，生产构建）：** 导入 8 条轨（7 条音高轨含 16 分音符密集声部、1 条鼓轨，共 120 个音），两小节循环、节拍器开，每 5 秒在播放中切换一次 Mute、改音量、在卷帘中加一个音再撤销。

| 指标 | Chrome（300 s） | WebKit（60 s，补充） |
|---|---|---|
| 实测时长／编辑次数／循环次数 | 300.2 s ／ 59 ／ 76 | 60.9 s ／ 12 ／ 16 |
| 调度提前量（事件时间 − 发送时 currentTime） | 最小 60.00 ms，p50 105.94，p95 116.59；没有迟到事件（9011 个 note-on） | 最小 60.00 ms，p95 118.25（1830 个） |
| 调度 tick 耗时 | p95 0.10 ms，最大 0.30 ms（12009 次） | p95 0.00 ms，最大 1.00 ms |
| 漂移：轨 1 每个中央 C 相对首音的绝对拍格偏差 | 最大 8.9e-16 s | 最大 3.6e-15 s |
| 最多同时 voice／停止 2.5 s 后 voice | 42 ／ 0 | 44 ／ 0 |

数据：`perf-chrome-8000/a09-perf.json`、`perf-webkit-8000/a09-perf.json`。漂移按设计不会累积：每个事件时间都由同一锚点直接计算；单测另验证 150 次循环后仍在绝对网格上（`scheduler.test.js`）。

**键盘与和弦显示（四组最终运行，页面刷新前汇总）：**

| 指标 | Chrome 5173 | Chrome 8000 | WebKit 5173 | WebKit 8000 |
|---|---|---|---|---|
| 键盘事件 → 合成器 `noteOn` 调用（JS），p95 | 0.5 ms | 0.4 ms | 1 ms | 1 ms |
| 80 ms 稳定窗口结束 → 和弦显示提交，p95 | 6.5 ms | 0.8 ms | 3 ms | 2 ms |

WebKit 的计时精度为 1 ms。规格目标“键盘事件到音频调度 p95 < 20 ms”“稳定窗口后识别 UI 更新 p95 ≤ 100 ms”在 JS 层满足；可感知延迟还要加上声卡输出延迟，未测。

**录音／导入后的和弦分段与调性／级数分析（`perf-chord-*-8000`，每种 30 次）：** 4 小节 44 个音（每小节一个三和弦加八分音符琶音）p95 Chrome 0.7 ms、WebKit 1 ms，得到 4 个建议；8 小节 88 个音 p95 Chrome 1.1 ms、WebKit 1 ms，得到 8 个建议。规格目标 p95 ≤ 500 ms。

以上均为 JS／音频图层面的测量，不包含声卡与扬声器延迟；目标 Mac 上的真实听觉延迟未测。

## 9. 五组主流程

每组都在同一页面内完成：新建 → 设速度／拍号 → 旋律轨 1 小节倒数后实时录 2 小节 → 新建同音色第二轨并准备录音 → 步进输入 4 个和弦 → 自动建议 → 采用全部 → 查看推测调性 → 确认调性 → 查看级数 → 1280×800 与 1440×900 截图 → 保存项目 JSON → 导出 MIDI（mido 读回一致）。

| 流程 | 速度／拍号 | 和弦（识别后确认） | 推测 → 确认调性 | 级数 | 覆盖点 |
|---|---|---|---|---|---|
| 1 | 90 / 4/4 | C、G/D、Am/C、F/C | C 大调 → C 大调 | I、V⁶₄、vi⁶、IV⁶₄ | 转位；之后刷新并重新打开此项目 |
| 2 | 100 / 3/4 | E♭、B♭/D、Cm、A♭ | E♭ 大调 → E♭ 大调 | I、V⁶、vi、IV | 非 4/4、非默认调性、转位 |
| 3 | 72 / 6/8 | Dsus4（多种解释）、D、Gadd9、A7/G | D 大调 → D 大调 | Isus4、I、IV add9、V⁴₂ | 6/8、sus、add、七和弦转位 |
| 4 | 84 / 4/4 | Am、Dm、E、C–E–G–A（手选为 Am7/C） | A 小调 → A 小调 | i、iv、V、i⁶₅ | 小调、多解后手选、和声小调 V |
| 5 | 110 / 4/4 | C、D7、G/D、F/C，另手选 Fm 与 N.C. | C 大调 → C 大调 | I、V7/V、V⁶₄、IV⁶₄、iv | 副属、借用、N.C. 与空白区分 |

截图与文件：`final-*/flow{1..5}-{1280,1440}.png`、`flow{n}.flux.json`、`flow{n}.mid`、`midi-readback.json`。

## 10. 复现

```sh
# 项目根目录
git status --short && git rev-parse HEAD
uv sync --frozen && npm --prefix frontend ci

npm --prefix frontend test                       # 92 项；离线渲染项需要本地音源，缺失时会跳过
npm --prefix frontend run build
.venv/bin/python -B -m pytest -q -p no:cacheprovider   # 25 项
git diff --check

# 本地验证音源（不入库）
mkdir -p data/phase_a/soundfonts && curl -L -o data/phase_a/soundfonts/GeneralUser-GS.sf2 \
  https://raw.githubusercontent.com/mrbumpy409/GeneralUser-GS/684543d5e5efaef08d02be50dcda8d552478fa60/GeneralUser-GS.sf2
shasum -a 256 data/phase_a/soundfonts/GeneralUser-GS.sf2   # 9575028c…8cfe

# 入口
uv run --frozen uvicorn backend.main:app --reload --port 8000   # http://127.0.0.1:8000/
npm --prefix frontend run dev                                    # http://localhost:5173/

# 浏览器验证（WebKit 需先执行一次 (cd frontend && npx playwright install webkit)）
.venv/bin/python frontend/e2e/make_fixtures.py data/phase_a/fixtures
cd frontend
node e2e/phase_a.mjs --browser chrome --url http://localhost:5173/ --out ../data/phase_a/evidence/final-chrome-5173
node e2e/phase_a.mjs --browser webkit --url http://127.0.0.1:8000/ --out ../data/phase_a/evidence/final-webkit-8000
node e2e/phase_a.mjs --browser chrome --url http://127.0.0.1:8000/ --out ../data/phase_a/evidence/perf-chrome-8000 --perf 300 --only A-09
cd .. && .venv/bin/python frontend/e2e/check_exports.py data/phase_a/evidence/final-chrome-8000
```

本次 8000 端口由用户在 2026-09-26 启动的 `uvicorn --reload` 进程提供（同一项目、后端未改，读取磁盘上的 `frontend/dist`），未重启或终止该进程；5173 为本次启动的 Vite。最终运行前清空了各 `final-*` 证据目录。

## 11. 已知限制

- 本阶段不做：R0／生成、模型、Web MIDI、CC64 延音与弯音录制（Tab 延音未开放，界面有说明）、变换菜单、多片段、变速图。
- MIDI 导入只保留固定速度与拍号：变速／变拍号、CC（除开头的 CC7 音量）、弯音、触后、SysEx、轨内换音色都会列出并允许取消，不会宣称无损。PPQ 换算不能整除时四舍五入并计数。
- MIDI 导出为单端口：音高轨最多 15 条（一轨一通道），超出拒绝导出；多条鼓轨共用第 10 通道，导出前要求确认。鼓组只提供 GM 标准鼓组（program 0），GS 其它鼓组未开放。同一轨内同音高重叠的两个音在播放时共用一个 note-off（后一个结束时一起结束），不会被截短。
- 循环首版：循环尾截断正在响的音，下一轮重触发；跨过循环起点的长音下一轮不补奏。录音遇循环尾自动停止，不做叠录。
- 暂停／恢复后的输出时间映射依赖浏览器的 `getOutputTimestamp()`；敲拍校准未实现。
- 和弦识别只分析当前选中的一条音高轨，不自动合并多轨；分解和弦（琶音）不推测为和弦，返回未确定（“建议配和声”属 B 阶段）。调性分析为全局调，转调只提示“待确认”。
- GM 鼓在通道上忽略 note-off，通鼓等采样的衰减尾巴会在 −80 dB 以下再持续十几秒才被引擎计为结束；这不是卡住的音，停止播放时传输通道会被立即清空。
- 失焦／切换标签页时释放所有按住的键；正在播放的传输继续（Worker 计时器保证后台调度）。
- 1280×800 下右侧面板内容较长时需要滚动；窄屏抽屉布局未做。
- 无效音源文件与 worklet 加载失败路径已实现并在代码中处理，但浏览器自动化没有注入这类失败。

## 12. 人工验收清单（约 10 分钟）

1. 用 Chrome 打开 http://127.0.0.1:8000/ ，点“启用声音”，选择 `data/phase_a/soundfonts/GeneralUser-GS.sf2`，确认状态“声音就绪 · GM 128/128 + 鼓组”。
2. 点“电脑键盘”，按 A/D/G：应听到 C 大三和弦，并显示 C；按 Z 后按 D/G/K 显示 C/E。
3. 点“载入示例”，播放，确认听到《小星星》；打开“节拍器”，切换 3/4、6/8 听重音。
4. 导入 `data/phase_a/fixtures/a02_same_program.mid`，播放时分别点两条钢琴轨的 M/S，确认同音高互不截断。
5. 用 90 BPM 录 4 小节自己的旋律并回放；在步进模式输入几个和弦，采用建议、确认调性、查看级数。
6. 保存项目、刷新、重新打开；导出 MIDI 用其它软件打开检查。
7. 在 Safari 中重复 1–4，确认能启用声音、载入音源、按键发声且松键停止。（验证脚本目前只驱动 Chrome 与 Playwright WebKit；Safari.app 自动化需先在 Safari 设置 → 开发者中打开“允许远程自动化”。）

## 13. 受保护文件前后哈希

目录内所有文件（排除 `__pycache__`）逐个 SHA-256 后再整体 SHA-256：

| 目录 | 开工 | 交付 |
|---|---|---|
| `research` | `bb11da6cf5261a82…` | `bb11da6cf5261a82…` 相同 |
| `core` | `399c841c2cd056a7…` | `399c841c2cd056a7…` 相同 |
| `archive` | `40070a4ca316089f…` | `40070a4ca316089f…` 相同 |
| `docs/claude_research` | `55b28683a7360d64…` | `55b28683a7360d64…` 相同 |
| `data/sample` | `38a27d4aa6bb3560…` | `38a27d4aa6bb3560…` 相同 |
| `data/generated` | `4d4656b5e99634ac…` | `4d4656b5e99634ac…` 相同 |
| `data/results` | `ffb85b8c596ea43a…` | `ffb85b8c596ea43a…` 相同 |

`backend/main.py` `bbd4d63d…7229`、`pyproject.toml` `a65b5b3c…1821`、`uv.lock` `18030a79…dea9`、`tests/test_web_entry.py` `ba38a25a…e042` 开工与交付相同。`frontend/package.json` 与 `package-lock.json` 因新增依赖而改变（`1d333b75…`、`f125fe58…`）。本阶段没有运行 `research.pipeline`、`research.ab_test`、`research.generate`、`python -m core.transforms` 或 `scripts/demo_check.sh`。
