# FLUX 独立调研报告（2026-09-26）

> 核验日期：2026-09-26（BST）。本文结论用中文书写，保留英文技术名。
>
> 写作顺序可追溯：第 1.1–1.3 节写于约 15:03 BST，当时尚未联网核验外部事实。第 1.4 节写于联网调研之后（15:22 BST）。这两部分写作时都**还没有阅读** `docs/RESEARCH_RESET_2026-09-26.md`、`docs/DAW_SPEC_2026-09-26.md`、`docs/research/*.md`，并已在当时写入磁盘（该中间版本的文件修改时间为 15:22:34 BST；其中 §1.4 标题的时间误写成“16:40 BST”）。此后第 1 节唯一的改动是把这个笔误改成 15:22，其余内容逐字未动。第 2 节起是阅读现有报告后补全的内容，与现有报告的逐条对照见 [CROSS_REVIEW.md](CROSS_REVIEW.md)。
>
> 配套文件：[DAW_REVIEW.md](DAW_REVIEW.md)（交互与音源）、[EXPERIMENT_PLAN.md](EXPERIMENT_PLAN.md)（实验与 go/no-go）、[SOURCES.md](SOURCES.md)（来源、核验日期、访问状态）。
>
> **一页结论**
>
> 1. “杂乱”现在还不能算作模型的定论。网页是随机 stub；研究管线至少有 5 个源码确认的确定性缺陷：终点截断、首音不可见、旋律与生成音混轨、力度统一被重写为 72、输出固定 120 BPM。此外还有 4 个在产物中反复出现的待验证原因：乐器散乱、提前终止导致稀疏、超长延音、和声冲突。
> 2. 最先要做的生成路线是：**“和弦轨 + 角色 pattern”的确定性流行编曲器**，它既是第一版可用生成器，也是所有模型必须超过的基线。与此同时，在修好的公平管线上比较 AMT 和 MIDI-GPT（单角色、小节补全）。钢琴续写单独比较 Aria、AMT large、RWKV-piano。
> 3. LLM 负责**规划和操作**，不做逐音符的主生成器。先有 CLI，再包 MCP，二者与 HTTP 共用同一业务层。Jev 只能作为候选排序或意图路由的**可选实验层**，输入是代码抽取的特征，而且必须胜过规则打分和普通 LLM 才能进入默认路径。
> 4. 数据方面：先用你拥有权利的原创片段建立评估集。流行钢琴看 POP909、Pop1K7；多轨看 Lakh/GigaMIDI 的人工抽查子集，Slakh 用于功能测试。**暂不训练**。LoRA 或 state tuning 只在出现可重复的“风格缺口”后才开展，并且预设停止条件。

## 0. 证据等级与记录约定

| 标记 | 含义 |
|---|---|
| 【本机复现】 | 在本仓库文件或其副本上实际运行得到。运行环境是连接用户 Mac 的 Linux VM（aarch64、4 vCPU、3.8 GiB，无 GPU/MPS）或云端副本。**这不是在 Mac 的 MPS 上运行模型** |
| 【源码确认】 | 逐行读源码得出。模型或文件运行后会发生什么，是按代码推导出来的 |
| 【产物确认】 | 解析仓库中已有的 MIDI/CSV 产物得出 |
| 【官方声称】 | 来自论文、模型卡或官方仓库，本轮没有复现 |
| 【研究推断】 | 根据证据推出的判断，需要实验证实 |
| 【未知】 | 找不到证据，或证据相互冲突 |

本轮没有下载模型权重，没有运行 AMT，没有调用付费 API，也没有上传用户音乐。

## 1. 初步判断（写于阅读现有报告之前）

### 1.1 代码审计：已实现／只是文档计划／确定性缺陷／待测质量假设

| 类别 | 内容 | 证据 |
|---|---|---|
| 已实现 | FastAPI 提供构建后的前端和 `POST /api/suggest`。建议音符是**随机 stub**：对落在整数拍上的音符生成低八度音，70% 概率再加下方三度。没有加载任何模型 | 【源码确认】`backend/main.py:66-83`；后端不 import `research.*` |
| 已实现 | SVG 钢琴卷帘：固定 16 拍 × C3–C6，点击加 1 拍音符、点击删除，Ghost 叠加，Accept/Reject/Clear | 【源码确认】`frontend/src/PianoRoll.jsx`、`App.jsx` |
| 已实现 | 离线 AMT 管线：单旋律 MIDI → program 0 controls → `anticipation.sample.generate` → 混合 MIDI/PNG → muspy 8 项指标追加到 CSV | 【源码确认】`research/pipeline.py` |
| 已实现 | 解码时的乐器掩码（monkey-patch `sample.instr_logits`） | 【源码确认】`pipeline.py:31-55` |
| 已实现 | 6 种确定性变换（sequence、inversion、retrograde、augmentation、diminution、fragmentation）用 `Fraction` 精确计算 | 【本机复现】云端副本 20/20 测试通过（Python 3.11 + 最小 pytest shim；`test_web_entry.py` 因缺 fastapi 未运行） |
| 只是文档计划 | 音频播放、电脑键盘输入、录音、BPM/拍号、多轨、Mute/Solo、完整 GM 目录、生成结果放新轨、网页接入真实模型、LoRA/微调、流行数据准备、正式评估协议 | 【源码确认】前端和后端都没有相关代码。`peft` 只在依赖里，没有被 import；仓库里没有训练代码 |
| 确定性缺陷 | **生成终点错把最后一个 onset 当作选区末尾**：`ops.max_time` 只取 onset（`ops.py:223-243`），Twinkle 得到 7.0 s，但旋律实际在 8.0 s 结束；采样到 onset ≥ end_time 就 `break`（`sample.py:176-179`）。结果是最后一个旋律音（终止式的主音）下方没有任何新伴奏 | 【源码确认】【本机复现】纯 Python 复算得 7.0 s；【产物确认】5 个伴奏 MIDI 中，生成音的最晚 onset 都 ≤ 13.96 拍，而最后一个旋律 onset 在 14.0 拍 |
| 确定性缺陷 | **第一个旋律音对模型不可见**：`sample.generate` 用 `ops.clip(controls, DELTA, …, seconds=False)`，会丢掉 onset < 5 tick（50 ms）的 control（`sample.py:130`）。Twinkle 的 14 个 control 只剩 13 个，开头 0.0 s 的音被丢掉 | 【本机复现】纯 Python 复算；【产物确认】5 个伴奏输出里，没有任何生成音早于第 1.0 拍。需核对上游是否有意这样设计 |
| 确定性缺陷 | **同 program 聚轨**：`melody_to_controls()` 只接受 program 0（其他 program 会触发 `assert`），并把所有 program 0 的轨道合成一路。采样器本身已经把生成事件和 controls 分开（`ops.split`），但 pipeline 随后又 `ops.combine` 混回去，`compound_to_midi` 再按 program 分轨。结果是旋律和生成的钢琴落在同一轨、同一通道 | 【源码确认】；【产物确认】`ab_small_constrained.mid` 的 track0 = 14 个旋律音 + 49 个生成音 |
| 确定性缺陷 | **表现力与单位信息丢失**：输出所有音符（包括原旋律）的力度都写成 72；`ticks_per_beat=50`，没有写 `set_tempo`，所以固定按 120 BPM 解释；拍号、调号、CC、踏板和弯音全部丢失 | 【源码确认】`convert.py`；【产物确认】全部生成 MIDI 的力度都是 {72}，没有 tempo 和拍号事件 |
| 确定性缺陷 | **pilot 方法不可归因**：free 组用 top_p 0.98，constrained 组用 0.95，与约束条件混在一起；每组 n=1，没有设 seed；输入只有 Twinkle；指标算在“旋律+伴奏”的混合 MIDI 上；`gen_seconds` 不含加载，但第一次调用包含 MPS 预热；MPS 回退 CPU 后模型会被永久移到 CPU，CSV 里的 device 仍记为 `mps` | 【源码确认】`ab_test.py:21-27`、`generate.py:51-58`、`pipeline.py:116-137`；【产物确认】CSV 9 行 |
| 确定性缺陷 | 前端 Accept 会把 ghost 并入同一个 `notes` 数组，没有“新轨”这个概念；请求进行中编辑音符，旧响应仍会覆盖显示；超出 C3–C6 的 ghost 静默不可见 | 【源码确认】`App.jsx:38-41`、`App.jsx:19-36` |
| 确定性缺陷 | 变换层不校验 MIDI 音高范围和负时间：`Note(pitch=200)` 能创建成功，半音倒影可以得到 180。diatonic 模式会把半音音静默吸附到调内（C# → C） | 【本机复现】云端副本 |
| 确定性缺陷 | 不带参数运行 `research.pipeline` / `ab_test` / `metrics` 会重写 `data/sample/sample_melody.mid`（内容确定，但会覆盖文件） | 【源码确认】`sample_data.py:40-45` |
| 待测质量假设 | 自由模式下乐器散乱：每次输出 13–14 个 GM program，每个只有 1–11 个音 | 【产物确认】`e2e_accompaniment`、`ab_small_free` |
| 待测质量假设 | 输出稀疏是**采样循环提前终止**造成的，不一定是模型“沉默”：medium free 的 12 个生成音全部在第 1–4 拍，medium constrained 只有 4 个音 | 【产物确认】；因果关系待实验 |
| 待测质量假设 | 长延音造成浑浊：生成音最长持续 15–18 拍，有 3–11 个音延续到第 16 拍之后 | 【产物确认】 |
| 待测质量假设 | 和声冲突：free/e2e 输出中有 9–12 个生成音与同时发声的旋律构成小二度或大七度，有 9–13 个 C 大调外音 | 【产物确认】（粗略统计，没有做听感判断） |
| 待测质量假设 | 力度全平导致旋律不突出；模型大小、采样参数和训练域对“流行感”的影响 | 尚无证据 |

硬件记录：用户的 Mac 是 darwin/arm64，由桌面应用运行时报告，**芯片型号和内存从本会话不可见（【未知】）**。诊断所用的 VM 是 Linux aarch64、4 vCPU、3.8 GiB，无 GPU/MPS。`.venv` 里是 macOS arm64 wheel（torch 2.12.0、transformers 5.12.0），VM 不能执行。所以本报告**没有测量任何 MPS 速度**。CSV 里的 `gen_seconds` 只是 7 月一次运行的记录，且受上面提到的混杂因素影响。

### 1.2 对“待核事实”的逐条结论

1. **网页建议仍是随机 stub，网页没有调用 AMT**：成立。网页上的听感不能用来评价 AMT。
2. **研究管线用的是预训练 AMT，FLUX 没有训练过模型，Essen 只是候选输入池**：成立，而且比描述的更弱。`pipeline`、`ab_test` 根本没有读取 Essen，所有记录在案的运行都只用 Twinkle。“民歌训练坏了模型”没有任何代码或产物支持。
3. **core 六种变换独立于研究 pipeline**：成立。两边互不 import。
4. **`melody_to_controls()` 只处理 program 0；采样器已分离生成与输入；同 program 聚轨**：都成立。采样器返回的是纯生成事件，**聚轨发生在 pipeline 的混合和 MIDI 写出两步**。
5. **`ops.max_time()` 不含时值，终点错取最后 onset**：成立，产物也印证了这一点。
6. **AMT 的信息损失**：词表层面没有力度、CC、弯音、tempo、拍号、调号和轨道 ID，时间用秒（10 ms 分辨率，序列 ≤100 s，时值 ≤10 s）。转换器层面还有：读到的力度被丢掉，输出统一写 72；输出固定按 120 BPM 解释；同 program 的多轨合并。**转换器层的问题可以在 FLUX 自己的 I/O 层绕开**：源轨不经过模型往返，只导入生成音；按源 tempo map 把秒映射回拍；力度另行规则化。词表层的问题需要换模型或重新训练。
7. **pilot 方法问题**：全部成立。另外，参考采样器没有 KV cache，每个 token 都要把整个上下文重新前向一次，所以延迟数字只反映这个采样器实现，不反映模型本身的可达速度。

### 1.3 初步技术判断（联网核验前，置信度另标）

1. **“杂乱”现在还不能归因到模型质量**（高置信）。网页体验来自随机 stub；研究产物受到至少 7 个确定性问题影响：终点截断、首音不可见、乐器散乱、旋律与钢琴混轨、统一力度、超长延音、提前终止。第一步应该修管线、建立公平比较，而不是直接换模型或训练。
2. **AMT 和产品需求在结构上有错位**（中高置信）：按秒而不是按拍/小节，没有力度，没有轨道身份，也没有“第 m–n 小节、指定角色”的显式补全接口。但它的 anticipation 机制确实支持“以某乐器为条件，生成其他声部”。它**应该作为基线保留，不作为默认目标**。
3. **产品主线更适合“小节＋轨道”感知的多轨补全模型**（中置信，待核验）。MMM/MIDI-GPT 一类模型与“新轨、目标小节、每轨乐器”的交互天然对齐。前提是权重、许可证和在 Mac 上的可运行性都经过核实。
4. **确定性的规则伴奏应该是第一个“能用”的生成器，也是必须保留的基线**（中高置信）：由旋律估计和弦，再套用贝斯、鼓、铺底的流行模式。模型要在盲听中胜过它，才值得接入。
5. **LLM 更适合做“规划器＋操作层”，不适合做逐音符的主生成器**（中置信）。它可以规划和弦、段落和角色，并调用有校验的结构化编辑；直接输出音符 JSON 只适合短而简单的声部，而且必须经过校验器。MCP、CLI、HTTP 应该共用同一业务层。
6. **Jev**：我没有关于它的可靠先验，**必须先核实它是否存在、入口和语义**。直觉上，它最多适合“对 4–8 个候选的特征描述做选择或排序”，不适合逐音符决策。
7. **六种变换应保留为可选的确定性编辑工具**（高置信）：用户主动触发的“动机发展”操作，同时可以作为 LLM 的工具，但不作为研究主线。
8. **可听的多轨工作台是所有听感评估的前提**（高置信）。单位（拍/秒/tick）、轨道和音色都必须先正确。
9. **数据**（低到中置信，待核验许可）：流行钢琴方向考虑 POP909、Pop1K7；多轨流行方向考虑 Lakh 子集、MetaMIDI、GigaMIDI，Slakh 可作参照。先用数据做评估和风格条件；只有在管线修好、对比显示存在明确差距之后，才考虑 LoRA。

### 1.4 联网核验后的独立判断（2026-09-26 15:22 BST 写入，仍在阅读现有报告之前）

1. **AMT 不是“差模型”，但它和本产品的交互不对齐。** MIREX 2025 钢琴续写盲听中，Anticipatory 780M 在 coherency、structure、creativity 三项取得最高均值，musicality 3.45 与最高的 3.50 接近（14 名评分者）。因此“换掉 AMT 就会好听”没有证据。但它依然按秒、无力度、无轨道 ID。
2. **“流行旋律 + 贝斯/鼓/和弦”应先做“和弦轨 + 规则 pattern”的确定性编曲器。** 它是保底路线，也是基线。模型候选依次是：MIDI-GPT（小节/轨道补全与属性控制，有 macOS arm64 wheel，**但 HF 权重卡是 CC-BY-NC-4.0**）；Composer's Assistant 2（代码 MIT，**只用公共领域和宽松许可 MIDI 训练**，许可证最干净，但与 REAPER 绑定）；MIDI-RWKV（MIT，CPU 可跑，有 POP909 state tuning 证据）；修好管线后的 AMT。流行钢琴织体另有 AccoMontage2 / Structured Arrangement（代码 MIT，限 4/4，需要乐句标注）。
3. **钢琴续写**：Aria（Apache-2.0，0.7B，官方支持 MLX）和 AMT large 最值得比较。**同音色变奏**：先用 core 变换加小节补全模型。
4. **Jev 真实存在**：`jev-1.13.0`，2026-09-15 发布，只接受文本，官方明确写了“不能可靠计数”“不能可靠判断数值接近”“Score 等级的数值校准较弱”。社区测试显示：Score 过度自信，交换选项名会改变 32.5% 的答案，非英语准确率下降。只适合对**代码抽取的类别描述**做候选选择和意图路由，并且必须与零成本基线对照；不能逐音符使用。
5. **LLM + MCP**：Logic 没有公开的工程/音符编程接口，社区 MCP 靠 AX、CGEvent、CoreMIDI 操作。REAPER 有官方 ReaScript，可以读写音符并提供撤销块。Ableton 的 LOM 通过 Max for Live 提供，属于官方接口；Python Remote Script 则是非官方途径。FLUX 应先有自己的项目模型和 CLI，再包一层 MCP（当前规范版本 2026-07-28）。LLM 担任规划器和操作层。
6. **网页音频栈**：Tone.js（MIT）负责时钟和运输；SpessaSynth（Apache-2.0）加 GeneralUser GS 负责完整 GM；@tonejs/midi 负责 MIDI I/O。Web MIDI 在 Chrome、Edge、Firefox 可用，Safari 不支持。电脑键盘输入不依赖 Web MIDI。
7. **数据许可普遍比“代码许可”严格**：GigaMIDI 是 CC BY-NC 且限研究用；MetaMIDI 需申请；Aria-MIDI 是 CC-BY-NC-SA；MAESTRO 是 CC BY-NC-SA；Lakh 以 CC-BY 4.0 分发，但底层歌曲版权并未因此授权。POP909 仓库是 MIT，Pop1K7 是 CC BY 4.0，但二者的底层作品都是受版权保护的流行歌。

---

## 2. 代码与产物审计：证据细节

### 2.1 环境与复现边界

| 项 | 记录 |
|---|---|
| 用户 Mac | darwin/arm64，由桌面应用报告；芯片、内存、macOS 版本从本会话**不可见**。 |
| 诊断环境 | 连接 Mac 的 Linux VM（aarch64、4 vCPU、3.8 GiB，无 GPU/MPS），在其中用 Python 3.10 纯 Python 解析 MIDI；另在云端副本用 Python 3.11 跑变换测试。 |
| 锁定依赖（`uv.lock`） | torch 2.12.0、transformers 5.12.0、muspy 0.5.0、mido 1.3.3、peft 0.19.1（未被 import）、anticipation 锁在 `af37397`。GitHub API 显示该提交就是上游 main 的最新提交（2024-03-18，“Fix an off-by-one in the logit checking for max instruments”）。 |
| Git 状态 | 未提交的修改保持原样。审计时一次只读 `git status` 在 `.git/` 残留了空的 `index.lock`，经你批准已删除该文件；之后所有 git 查询都加 `GIT_OPTIONAL_LOCKS=0`。 |
| 没有做的事 | 没有下载权重，没有运行 AMT，没有测 MPS，没有调用 Jev 或其他付费 API，也没有上传你的任何音乐。 |

### 2.2 七月 pilot 产物逐个解析 【产物确认】

统计口径：先把输出 MIDI 中与 Twinkle 14 个旋律音一一匹配的音（同音高、同 onset、同在 channel 0）剔除，剩下的记为生成音。“调外”指 C 大调以外的音级。“冲突”指生成音与同时发声的旋律音相差 1 或 11 个半音（模 12）。解析脚本见 [EXPERIMENT_PLAN 附录 A](EXPERIMENT_PLAN.md#附录-a只读产物解析脚本)。

| 文件 | 条件 | 生成音（音高/鼓） | 生成乐器数 | 生成 onset 范围（拍） | 调外 | 冲突 | 第 16 拍后仍在响 | 最长时值（拍） |
|---|---|---|---|---|---|---|---|---|
| `e2e_accompaniment` | small，自由，top_p 0.98（7 月 6 日较早版本 pipeline `4126193`，终点逻辑相同；没有 CSV 行） | 64（62/2） | 13 + 鼓 | 1.00–13.96 | 9 | 9 | 3 | 17.7 |
| `ab_small_free` | small，自由，0.98 | 62（53/9） | 14 + 鼓 | 1.00–13.06 | 13 | 12 | 11 | 15.6 |
| `ab_small_constrained` | small，{0,32,128}，0.95 | 50（49/1） | 只有钢琴，**贝斯 0** | 1.00–13.08 | 9 | 2 | 5 | 17.3 |
| `ab_medium_free` | medium，自由，0.98 | 12（12/0） | 9 | 1.00–**4.00** | 4 | 3 | 0 | 6.0 |
| `ab_medium_constrained` | medium，{0,32,128}，0.95 | **4**（4/0） | 只有钢琴，**贝斯 0** | 1.00–**3.00** | 0 | 0 | 1 | 18.3 |

共同现象：

- 5/5 在第 0–1 拍内没有任何生成音。这与首个 control 被丢一致，但因果关系待验证。
- 5/5 在最后一个旋律 onset（第 14 拍）处及之后都没有生成 onset，终止式没有伴奏。这一点源码确认。
- medium 的两组在第 4 拍之后完全没有生成音。这与“采样到越界 time token 就 break”一致，待验证。
- 所有音（包括原旋律）的力度都是 72；文件里没有 tempo 和拍号事件；`ticks_per_beat=50`。
- 两组“约束”都没有产生一个贝斯音，鼓最多 1 个。可见允许集合**既不保证目标角色出现，也不保证非空**。

### 2.3 AMT 信息损失：分清是词表限制、转换器限制，还是 FLUX 管线造成的

| 信息 | 词表（模型层） | `anticipation.convert`（转换层） | FLUX pipeline | FLUX 能否绕开 |
|---|---|---|---|---|
| 力度 | 没有 token | 读入后在 `compound_to_events` 删除；输出时统一写 72 | 原旋律也被重写成 72 | 能：源轨不经模型往返；生成音按角色规则赋力度 |
| CC / 踏板 / 弯音 / aftertouch | 没有 | 忽略 | — | 源轨能保存；**生成器不会产生这些内容** |
| Tempo map | 没有，只用绝对秒 | 输入按 tempo 换算成秒；输出 `ticks_per_beat=50`、不写 `set_tempo`，所以按 120 BPM 解释 | 输入不是 120 BPM 时，输出的拍网格会错位 | 能：用源 tempo map 把生成的秒映射回 tick |
| 拍号 / 调号 / 歌词 / marker | 没有 | 忽略 | — | 在项目层保存；模型只看得到秒 |
| 轨道身份 | 只有 program（0–127）加鼓（128） | 同 program 的多轨合并；输出按 program 建轨 | 旋律与生成的钢琴落在同一轨、同一通道 | 能：候选单独返回，由项目层分配 `trackId` 和通道 |
| 时间 | 10 ms 分辨率，序列 ≤100 s，时值 ≤10 s | 超长时值截断；未知时值设为 250 ms | 生成窗口按秒计 | 按小节边界映射；超过 100 s 要分窗 |
| 首个 control | — | — | `sample.generate` 丢弃 onset <50 ms 的 control | 输入整体右移 ≥50 ms，或自写采样循环去掉这一步（需实验验证影响） |
| 生成终点 | — | — | 用最后一个 onset 作终点，并在采样到越界 time 时 `break` | 终点改为选区末尾；最后一个音的尾部另定策略 |

第 1.2 节说过的效率问题要单独记住：参考采样器每个 token 都对整个上下文重新前向一次，没有 KV cache。旧的 `gen_seconds` 反映的是这个实现的开销，而不是模型本身的可达速度。

### 2.4 pipeline 与 core 是否需要共存

- 两者互不依赖，职责也不重叠。`research/pipeline.py` 是离线实验编排，把旋律变成 controls、调用 AMT、写 MIDI、算指标。`core/transforms.py` 是纯函数形式的精确编辑。
- 建议：
  - `core` 保留为 FLUX 的确定性编辑库，承担三种角色：选区的可选“变换”菜单、LLM 可调用的工具、“同音色变奏”任务的无模型基线。需要补上 MIDI 音高 0–127 校验和负时间校验。
  - `pipeline.py` 冻结为历史基线，不再追加 `pipeline_metrics.csv`。它的功能由新的“生成适配器 + 实验运行器”取代（见 EXPERIMENT_PLAN E0）。
  - 六种变换**不是**研究主线，也不是生成的前置步骤。

## 3. “杂乱”诊断摘要

- **已确认的确定性原因（源码/产物）**：终点截断；首音不可见；旋律与生成音混轨；力度全为 72；输出按 120 BPM 解释；pilot 条件混杂且 n=1。**网页上听到的“杂乱”全部来自随机 stub，与模型无关。**
- **强嫌疑（产物中反复出现，因果待验证）**：自由模式下乐器散乱（13–14 个 program、每个只有几个音）；超长延音（最长 15–18 拍）；提前终止导致稀疏（medium 在第 4 拍后没有任何音）；约束后目标角色缺失（贝斯 0）；与旋律的小二度/大七度冲突（9–12 个）。
- **尚未测试**：音源和混音、训练域是否贴近现代流行、模型能力上限、和弦条件的作用。
- 每个假设的最小证伪实验见 [EXPERIMENT_PLAN §2](EXPERIMENT_PLAN.md#2-杂乱的假设表与最小证伪实验)。

## 4. 音乐模型与表示：发现、筛选与按任务比较

### 4.1 广泛发现（2026-09-26 状态）

| 技术类别 | 代表系统（核验日期 2026-09-26） | 与 FLUX 的关系 | 是否进入决赛 |
|---|---|---|---|
| 事件自回归（按秒） | **AMT**（2023 年预印本，TMLR 2024；代码与权重均 Apache-2.0；small/medium/large = 128M/360M/780M）；SkyTNT midi-model（Apache-2.0，约 0.2B，训练数据为 Los Angeles MIDI Dataset）；MIDI-LLM（Llama 3.2 1B 加 AMT 词表，Llama 3.2 Community License，文本到 MIDI） | AMT 已在管线里，是最低迁移成本的基线 | AMT 进入（作基线） |
| 小节/轨道补全 | **MIDI-GPT**（AAAI 2025；代码 MIT，HF 权重 CC-BY-NC-4.0，训练数据 GigaMIDI）；**Composer's Assistant 2**（ISMIR 2024；MIT；只用公共领域和宽松许可 MIDI 训练；与 REAPER 集成）；**MIDI-RWKV**（2025-06，v2 于 2026-01；MIT；约 35M 参数；CPU 可跑）；music2music / REMI-z（NeurIPS 2025；权重许可空缺） | 与“新轨、目标小节、角色”的交互天然对齐 | 前三者进入 |
| 扩散 / 掩码 | GETMusic（2023；用爬取的流行音乐训练；官方权重链接失效，issue #203 自 2024-09 起一直未关） | 任务贴合，但拿不到权重 | 不进入（阻塞：权重） |
| 流行伴奏系统（检索加生成） | **AccoMontage2**（ISMIR 2022；MIT；旋律→和弦 + 钢琴伴奏，钢琴织体来自 POP909；仅支持 4/4）；Structured Arrangement，即 AccoMontage-3（NeurIPS 2024；MIT；lead sheet→多轨；需要 GPU） | 与“流行钢琴 / 乐队伴奏”直接相关 | AccoMontage2 进入（钢琴织体对照） |
| 钢琴续写 | **Aria**（ISMIR 2025；Apache-2.0；0.7B；官方提供 MLX）；RWKV-piano（MIREX 2025 参赛，约 20M） | 只做钢琴 | Aria 进入 |
| 文本到 MIDI | Text2midi（AAAI 2025；Apache-2.0；训练数据 MidiCaps）；MIDI-LLM | 不以保留用户旋律为任务 | 不进入主线，只作灵感素材 |
| 乐谱/ABC 语言模型 | MuPT（Apache-2.0，ABC 记谱）；NotaGen（MIT，古典音乐） | 与 DAW 多轨 MIDI 的适配成本高，风格也不对 | 不进入 |
| 和弦条件符号模型 | MusicLang（GPL-3.0，商用需联系作者；声明“Lakh 为 CC0”与 Lakh 原站的 CC-BY 4.0 不符） | 可借鉴“和弦是一等对象”的思路 | 不进入 |
| 符号基础模型 | Moonbeam（Apache-2.0；81.6K 小时；需要微调） | 研究观察 | 不进入 |
| 音频 / 混合旁路 | YuE2（代码 Apache-2.0，权重 CC BY-NC 4.0，README 的评测日期为 2026-09-12）；MuScriptor（2026，多乐器转录，权重 CC BY-NC 4.0，**不保留力度**）；Basic Pitch（Apache-2.0，单乐器效果最好） | 可编辑 MIDI 不是它们的主产物 | 只作旁路 |
| 确定性方法 | **R0：FLUX 自建的“和弦轨 + 角色 pattern”编曲器**；core 变换 | 可控、即时、没有第三方许可问题 | 进入（作基线兼保底） |

排除理由：从零训练大模型（没有数据权利和算力，也没有证据表明这是瓶颈）；插件宿主和混音台（超出“输入 → 生成 → 对比 → 保留”这个验证目标）；把音频生成作主线（没有可编辑的逐轨 MIDI 验收）。

### 4.2 决赛候选的九项记录

> 下面的“证据”只说明公开资料证明了什么。所有“更好/更差”的判断都需要按 EXPERIMENT_PLAN 在同任务、同输入、同评价条件下才能成立。

#### AMT（Anticipatory Music Transformer）

1. **身份**：arXiv [2306.08620](https://arxiv.org/abs/2306.08620)（v1 2023-06-14，v2 2024-07-25，TMLR）。代码是 [jthickstun/anticipation](https://github.com/jthickstun/anticipation)（Apache-2.0，最后提交 2024-03-18）。权重是 `stanford-crfm/music-{small,medium,large}-800k`，small 的 `pytorch_model.bin` 为 512,433,185 bytes；medium/large 按参数量推算约 1.4 GB / 3.1 GB，属于推断。
2. **I/O 与任务**：处理秒制事件，可以把任意乐器的已知事件作为 controls，任务包括续写、时间窗补全和按乐器伴奏。controls 本身不会被改写。
3. **轨道与角色**：没有轨道 ID，同 program 无法区分；没有“小节”概念，只能用秒窗近似；角色只能靠乐器掩码，**不保证输出非空**。覆盖 128 种音色加鼓。
4. **表现力**：没有 tempo、拍号、力度、踏板。
5. **设备**：HF/PyTorch。7 月在 MPS 上跑过（回退情况没有记录）。本轮未测速。参考采样器没有 KV cache。
6. **训练语料**：Lakh（官方模型卡）。流行/摇滚占比高但年代偏旧，这是研究推断。用 Lakh 衍生的测试集有污染风险。
7. **许可**：代码和权重都是 Apache-2.0；数据 Lakh 以 CC-BY 4.0 分发，但底层作品版权未获授权。
8. **公开证据**：论文人评称 20 秒伴奏的音乐性与人类作品相近（官方声称）。**MIREX 2025 钢琴续写盲听**（14 名评分者）中，Anticipatory 780M 的 coherency 3.70、structure 3.69、creativity 3.30 是四个系统中最高的，musicality 3.45 仅次于 RWKV-20M 的 3.50（[来源](https://arxiv.org/html/2509.12267)）。这是第三方同任务评测，但只涉及钢琴续写，而且规则允许参赛队挑选输出。
9. **最小实验**：在修好的管线上，用 6 段 × 4 小节，每次只生成一个角色（贝斯、鼓、和弦铺底），各 3 个种子。**失败条件**：修复后空输出或稀疏仍超过 30%，或盲听明显不如 R0。

#### MIDI-GPT

1. **身份**：arXiv [2501.17011](https://arxiv.org/abs/2501.17011)（AAAI 2025）。代码是 [Metacreation-Lab/MIDI-GPT](https://github.com/Metacreation-Lab/MIDI-GPT)，README 写 MIT，版权年份 2026。HF 权重 [Metacreation/MIDI-GPT](https://huggingface.co/Metacreation/MIDI-GPT) 创建于 2026-06-01、修改于 2026-07-28，许可为 cc-by-nc-4.0。文件：`yellow_small-final` 82.5 MB，`yellow_medium-final` 350.5 MB，`prism_medium-step376000` 358 MB（仍在训练），`expressive_medium-step90000`（仍在训练）。仓库 `docs/models.md` 写 prism 在 step 58000、expressive 在 step 56000，**与 HF 上的文件不一致**；`from_pretrained(name)` 会解析到最新检查点，所以**必须锁定具体文件和 revision**。
2. **I/O 与任务**：输入多轨 Score（带小节）；任务包括轨道生成、小节补全和属性条件。未选中的轨道和小节作为上下文保持不变。
3. **轨道与角色**：轨道是一等对象，同 instrument 多轨的 round-trip 待测；用 `TrackPrompt(id, bars)` 指定目标小节；可设置属性（密度、复音、时值），prism 另有 18 个 genre 组。乐器按 GM。
4. **表现力**：Score 里有 tempo（μs/拍）和每小节拍号；力度只在 expressive 模型中有，而该模型还在训练；没有看到踏板。
5. **设备**：`pip install "midigpt[inference]"`，有 macOS arm64 wheel（README）。参数量没有公布，按文件大小推算 yellow_medium 约 87M（fp32，推断）。本轮未测。
6. **训练语料**：GigaMIDI v2.0.0（HF 卡），genre 元数据覆盖流行。与 Lakh/GigaMIDI 测试集重叠的风险高。
7. **许可**：代码 MIT，**权重 CC-BY-NC-4.0**，数据 GigaMIDI 为 CC BY-NC 且限研究用。因此只能用于研究和演示。
8. **公开证据**：论文作者自己的评估。在 MIDI-RWKV 论文的 8 小节补全对比中，MIDI-GPT（20M）的 content preservation 为 0.380（RWKV 0.596），groove 0.950 为最高。两者都是作者方评测。
9. **最小实验**：用 yellow_small 和 yellow_medium 跑相同的 6 段，只补目标轨 4 小节。工程成本低到中等（有 wheel）。**失败条件**：Mac 上 p95 超过 10 s；round-trip 丢轨；盲听不优于 R0。

#### Composer's Assistant 2（CA2）

1. **身份**：arXiv [2407.14700](https://arxiv.org/abs/2407.14700)（ISMIR 2024）。代码是 [m-malandro/composers-assistant-REAPER](https://github.com/m-malandro/composers-assistant-REAPER)（MIT），最新版本 v2.1.0（2024-10-09），仓库最后推送 2025-06-16。模型随 release 发布。
2. **I/O 与任务**：在 REAPER 工程中，对任意 track-measure 单元做补全；未选中的单元保持不变。
3. **轨道与角色**：用轨名表示乐器；用空 MIDI item 指定要写的小节。
4. **表现力**：支持任意拍号（每小节 ≤8 个四分音符）；每四分音符 24 tick，其中 12 个是合法 onset 位置。力度和鼓的处理没有找到说明（未知）。
5. **设备**：T5 类结构；大模型 512 维，编码器和解码器各 16 层。可以只用 CPU（较慢），可选 CUDA。Mac 未测。
6. **训练语料**：只用公共领域和宽松许可 MIDI（作者声称）。现代流行歌大多受版权保护，所以流行风格的覆盖可能偏弱（研究推断）。验证和测试用 LMD 的 e/f 目录。
7. **许可**：代码 MIT；权重没有单独的许可文本（未知）；数据是公共领域/宽松许可（作者声称）。**这是候选中数据许可最干净的一个。**
8. **公开证据**：note F1 从 CA1 的 52.6% 提高到 77.0%；28 人听测中与真实音乐无显著差异（小样本，作者方）。
9. **最小实验**：要么绕过 REAPER 直接调用其 Python NN server（需要复刻输入编码，成本中到高），要么先在 REAPER 里手工跑这 6 段。**失败条件**：无法脱离 REAPER 使用，或流行感明显不足。

#### MIDI-RWKV

1. **身份**：arXiv [2506.13001](https://arxiv.org/abs/2506.13001)（v1 2025-06-16；v2 2026-01-26 更名为 “Adaptable Symbolic Music Infilling with MIDI-RWKV”）。代码是 [christianazinn/MIDI-RWKV](https://github.com/christianazinn/MIDI-RWKV)（MIT），权重 `midi_rwkv.pth` 放在仓库里。
2. **I/O 与任务**：使用 REMI+（MidiTok，BPE 扩到 16k）；一次补全一段连续小节，多次调用即可实现任意掩码；有密度、时值、复音三种属性。
3. **轨道**：各轨按顺序排列，带 program token；同 program 多轨能否表示待测。
4. **表现力**：tempo 和拍号 token 取决于 MidiTok 配置（待核）；没有踏板。
5. **设备**：约 35M 参数，RWKV-7，通过 rwkv.cpp 在 CPU 上推理；论文报告 8 小节补全约 3 s（i9-14900K CPU）。Mac 未测。
6. **训练语料**：GigaMIDI（1.05M 个文件）。state tuning 用 POP909 的 99 首旋律轨。
7. **许可**：代码 MIT；权重在 MIT 仓库中，没有单独的模型卡；训练数据为 NC，衍生权重的风险未知。
8. **公开证据**（作者方）：content preservation 0.596，CA 为 0.410，MIDI-GPT 为 0.380。state tuning 只训练 294K 参数、约 4 分钟，在 28 人排名中显著优于 base 和 LoRA（p<0.05）。
9. **最小实验**：CPU 上跑 6 段补全；再用约 20 段你有权使用的流行片段做 state tuning 小试。**失败条件**：rwkv.cpp 转换链不稳定，或补全质量低于 R0。

#### Aria（仅钢琴续写）

1. **身份**：arXiv 2506.23869（ISMIR 2025）。代码是 [EleutherAI/aria](https://github.com/EleutherAI/aria)（Apache-2.0）。权重 [loubb/aria-medium-base](https://huggingface.co/loubb/aria-medium-base)（Apache-2.0，`model.safetensors` 2,634,170,640 bytes，最后修改 2026-04-13），另有 gen 和 embedding 两个变体。
2. **I/O 与任务**：输入钢琴 MIDI prompt，续写在其后，prompt 保持不变。
3. **轨道与角色**：单轨钢琴，没有目标小节补全；训练数据中多轨只占少数。
4. **表现力**：有力度和时值（performance MIDI）；没有 tempo/拍号（绝对时间）；踏板未知。
5. **设备**：0.7B；官方有 MLX（Apple Silicon）、PyTorch CUDA 和 HF 版本。Mac 未测。
6. **训练语料**：Aria-MIDI（CC-BY-NC-SA），含流行钢琴翻弹。模型卡明确提示**热门作品存在被记忆的现象**。
7. **许可**：代码和权重 Apache-2.0；数据 CC-BY-NC-SA 4.0。
8. **公开证据**：只有官方评测；Aria 没有参加 MIREX 2025。
9. **最小实验**：用 MLX 跑 6 段 4 小节钢琴续写，与 AMT large、RWKV-piano 同条件比较。**失败条件**：续写偏离 prompt 的调性和节拍，或出现记忆片段（与训练集 n-gram 重叠）。

#### AccoMontage2（及 Structured Arrangement）

1. **身份**：AccoMontage2 为 arXiv 2209.00353（ISMIR 2022），代码 [billyblu2000/AccoMontage2](https://github.com/billyblu2000/AccoMontage2)（MIT）。Structured Arrangement 为 arXiv 2310.16334（NeurIPS 2024），代码 [zhaojw1998/Structured-Arrangement-Code](https://github.com/zhaojw1998/Structured-Arrangement-Code)（MIT，更新于 2024-10-28）。
2. **I/O**：AccoMontage2 输入旋律 MIDI、乐句标注（如 `A8B8`）、调和调式，输出和弦进行加钢琴伴奏。Structured Arrangement 输入 lead sheet（旋律加和弦）和乐句，输出多轨编曲。
3. **轨道与角色**：伴奏写在独立的轨上。AccoMontage2 只出钢琴，Structured Arrangement 出乐队多轨。
4. **表现力与限制**：AccoMontage2 只支持 4/4，乐句长度只能是 4 或 8 小节。
5. **设备**：AccoMontage2 只需 CPU；Structured Arrangement 要 GPU（CUDA 11.1）。
6. **训练语料**：AccoMontage2 的织体库来自 POP909；Structured Arrangement 用 Slakh 和 LMD。
7. **许可**：代码 MIT；检查点放在 Google Drive，没有写许可；底层数据有版权问题。
8. **公开证据**：作者方评测。
9. **最小实验**：用 AccoMontage2 跑 6 段中属于 4/4 的 5 段，与 R0 的键盘声部比较。**失败条件**：乐句标注成本过高，或输入格式太脆弱。

#### R0：FLUX 自建的“和弦轨 + 角色 pattern”编曲器

1. **身份**：新写的代码，不依赖外部权重。
2. **I/O**：输入旋律轨、和弦轨（用户输入，或自动估计后由用户确认）和风格预设；输出贝斯、鼓、和弦铺底、钢琴织体等候选轨。
3. **轨道与角色**：同音色和目标小节天然支持，角色明确。
4. **表现力**：按项目 tick 保留 tempo 和拍号；按 pattern 设置力度；钢琴可以写 CC64（踏板）。
5. **设备**：纯 Python 或 TS，毫秒级，不需要 GPU。
6. **训练语料**：不训练。风格来自手写的 pattern 库，需要音乐人审校。
7. **许可**：自有代码，pattern 为原创，没有第三方许可问题。
8. **公开证据**：有产品先例——Logic Session Players 就是由和弦轨驱动贝斯和键盘演奏者（[Apple 文档](https://support.apple.com/guide/logicpro/chords-and-session-players-lgcp70dd5af3/mac)）。音乐质量要靠自己测。
9. **最小实验**：做 3–4 种风格 × 4 个角色的 pattern，跑 6 段。**失败条件**：盲听中“模板感”被一致指出，或和弦估计需要人工改的小节超过 25%。

### 4.3 按任务的优先级

| 任务 | 第一选择 | 第二 | 第三 | 不建议 | 理由 |
|---|---|---|---|---|---|
| 流行旋律 + 贝斯/鼓/和弦铺底 | R0 | MIDI-GPT yellow（一次只补一个角色） | 修好后的 AMT（单角色，可把和弦铺底作为 controls）或 CA2 | 自由多乐器生成；文本到 MIDI | 流行节奏组高度依赖惯用语，R0 能保证对拍、和弦一致、角色分离；模型要在盲听中胜出才值得接入 |
| 流行钢琴伴奏（织体） | R0 键盘 | AccoMontage2 | MIDI-GPT / AMT | Aria（它是续写，不是伴奏） | POP909 的织体检索就是为这个任务设计的 |
| 同音色变奏 | core 变换 | MIDI-GPT 在同轨重写 1–2 小节（带属性控制） | AMT 时间窗补全 | 整段重新生成 | 保留动机身份，可控，可撤销 |
| 钢琴续写 | Aria、AMT large、RWKV-piano 三方同条件比较 | — | — | 用 Aria 做乐队伴奏 | MIREX 的证据显示 AMT large 不弱；Aria 有 MLX 路线 |
| 文本/风格探索（可选） | LLM 规划 + R0 | Text2midi / MIDI-LLM 仅作灵感素材 | — | 让 LLM 直接写整首 | 不能保留用户的旋律 |

**“全面超过 AMT”这一说法没有任何证据支持。**唯一的第三方同任务证据（MIREX 2025，钢琴续写）反而显示 AMT large 很强。

### 4.4 表示与 tokenization

- [MidiTok](https://github.com/Natooz/MidiTok)（MIT）支持 REMI、REMI+、MIDI-Like、TSD、Structured、CPWord、Octuple、MuMIDI、MMM、PerTok，并可训练 BPE、Unigram、WordPiece。它用 [Symusic](https://github.com/Yikai-Liao/symusic)（MIT，C++，支持 tick/quarter/second 三种时间单位，有 macOS arm64 wheel，可读写 MIDI 和 ABC）做 I/O。
- **换 tokenizer 与已有权重不兼容。** tokenizer 决定了 embedding 词表和序列语法，换 tokenizer 就等于换一个新模型，需要重新训练，至少要重学 embedding 并大量继续训练。FLUX 能做的是给每个模型写一个 adapter，在“项目 tick 表示”和“模型原生表示”之间转换：
  - AMT：tick 与秒通过 tempo map 互转；
  - MIDI-GPT：Score 按小节组织；
  - MIDI-RWKV：REMI+（通过 MidiTok）；
  - Aria：秒。
- 建议项目层以 tick 为唯一事实来源，用 Symusic 做导入导出，并用 round-trip 测试保证 tempo、拍号、轨道和通道在转换中不丢失。

### 4.5 音频旁路：价值与损失

- **音频生成**（如 YuE2）：输出的是音频，权重为 NC 许可，需要 24 GB 以上 GPU，**无法满足“可编辑逐轨 MIDI”的验收**。不进入主线。
- **音频→MIDI**（MuScriptor、YourMT3+、Basic Pitch）：可以把参考音频转成带乐器标签的 MIDI 草稿。但 MuScriptor 明确说明不保留力度，转录也有误差，而且它的权重是 NC。可以作为以后“导入参考录音”的可选功能，但**不能用好听的音频演示代替 MIDI 验收**。
- **分轨**：本轮没有核验具体版本，未评估。

## 5. Jev、LLM、MCP 与 CLI

### 5.1 TypeSafe Jev：当日核验的官方事实（2026-09-26）

| 项 | 官方内容 | 来源 |
|---|---|---|
| 身份 | TypeSafe AI 的 “System One model”。它不生成文本，只接收 state 和有类型的问题，返回类型化的决策和概率。发布日期 **2026-09-15**（官方博客；MarkTechPost 报道时写的是 09-19） | [发布博客](https://typesafe.ai/blog/introducing-system-one-models-and-jev)、[文档首页](https://docs.typesafe.ai/) |
| 版本 | `jev-1.13.0`；`jev-latest` 和 `jev-preview` 当日都指向它 | [Models](https://docs.typesafe.ai/models.md) |
| 接口 | `POST https://api.typesafe.ai/v1/systemone`，Bearer key，`questions` 为 map | [API](https://docs.typesafe.ai/api.md) |
| 其他入口 | OpenRouter：`typesafe/jev-1.13`（另有 `/api/alpha/decisions`）；社区测试经 Vercel AI Gateway 调用；LiteLLM 提供透传 | [OpenRouter](https://openrouter.ai/docs/guides/community/jev)、[LiteLLM](https://docs.litellm.ai/docs/pass_through/typesafe) |
| 输入 | **只接受文本**（字符串、JSON 对象或数组），不支持图像、音频、视频 | Models |
| 上下文 | TypeSafe 文档：每请求 64k tokens，其中 state 32k；OpenRouter 文档：共 32k（state 加问题）。**两者冲突**，以实际账户测试为准 | Models、OpenRouter |
| Choice | 最多 255 个选项；返回 `choice`、`probabilities`（和为 1）、`confidence`；不能多选；文档建议加 “other / none of the above” 选项 | [Choice](https://docs.typesafe.ai/primitives/choice.md) |
| Score | 2–10 个有序等级；`score` 是按概率加权的等级均值；另有 `confidence` | [Score](https://docs.typesafe.ai/primitives/score.md) |
| Noul | 返回“是”的概率，没有单独的 confidence | [Noul](https://docs.typesafe.ai/primitives/noul.md) |
| confidence | 由分布的集中程度算出（3 个选项时为 `(3·p_max − 1)/2`），**不是另外测得的正确率**。文档没有给出校准数据；博客称 “higher confidence means higher accuracy” | [Confidence](https://docs.typesafe.ai/confidence.md) |
| 价格与速率 | 每百万输入 token $0.042，输出免费；250k tokens/s、1,200 RPM，限额会动态调整 | Models |
| 延迟 | 端到端 70–500 ms，**测量地点是美国西海岸的笔记本** | 发布博客 |
| 语言 | 以英语为主；支持 CJK，但优化较少 | Models |
| 数据 | 不用客户数据训练；ZDR 只对企业开放；“Jev is not fine-tuned or LoRA-adapted with customer data”，所有账户共用同一套权重 | [Legal](https://docs.typesafe.ai/legal.md)、Models |
| 访问 | 官方为 early access / waitlist；没有公开权重，不能自托管 | 发布博客 |
| 官方限制（1.13） | 不能可靠计数；“不是计算器”；不能可靠判断 RGB/hex 数值是否接近；Score 等级的数值校准弱；把日期当文本处理；state 中无关内容越多准确率越低；对抗性内容可以左右答案；不生成文本 | [Jev 1.13 jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13.md) |

**独立测试证据**（社区测试，脚本可复现，但未经同行评审）：

- [scienthoon/jev-ood-calibration](https://github.com/scienthoon/jev-ood-calibration)：2026-09-19 通过 Vercel AI Gateway 调用 4,621 次，花费约 $0.06。
  - 在规则生成的工单上：Choice 准确率 89.0%，Noul 91.7%，Score（4 级优先级）只有 44.7%。
  - ECE：Choice 0.082，Noul 0.079，Score 0.325。Choice 和 Score 过度自信（重新拟合温度 T≈3.3），Noul 欠自信（T=0.66）。
  - 概率被量化到 0.01，经常直接是 0 或 1。`confidence` 字段的校准比直接用 max-prob 还差。
- [DEV 社区 8 天测试](https://dev.to/aws-builders/jev-after-eight-days-of-independent-tests-level-with-mid-price-llms-behind-the-frontier-1c60)（2026-09-24）：
  - 把选项名称换掉，会改变 32.5% 的答案。
  - 俄语 XNLI 准确率 77.3%，英语对应任务为 88.3%。
  - 比前沿 LLM 低 6.5–11.5 分；用任务标签训练的复制模型表现更好。
- arXiv [2609.26758](https://arxiv.org/abs/2609.26758)，标题为 “Type-Safe Is Not Error-Free: A Constrained Decision Head Follows the Option Name, Not the Rubric Bound to It”。**只通过搜索确认了它存在；正文因抓取返回 HTTP 429 而未读。**

### 5.2 Jev 能不能“读懂” MIDI 数字列表

**判断：大概率不能直接读懂，需要由代码先抽取特征再交给它。**理由是官方明确列出了它不能可靠计数、不能判断数值接近、把日期当文本。音程、节奏和和声判断恰恰依赖对整数（pitch、tick）的差值、计数和比较。

**如何验证而不是猜**：做一个真值可以自动判定的探针集，例如“这 8 个音是否都在 C 大调”“第 3 小节有没有切分”“贝斯是否在每个强拍弹根音”。把同样的信息用三种形式提问：(a) 原始 MIDI JSON；(b) 代码抽取的类别特征；(c) 两者一起。比较三者的准确率和校准。预期 (b) 明显优于 (a)。约 200 个问题 × 1–2k tokens，费用约 $0.02。具体协议见 EXPERIMENT_PLAN E5。

### 5.3 概率、信心、校准和音乐质量是四件事

| 概念 | 含义 | 对 FLUX 的影响 |
|---|---|---|
| `probabilities` | 在**当前选项集合**下的相对分布 | 选项全都很差时，最高者仍可能有 0.9 |
| `confidence` | 分布有多集中的统计量 | 不等于“选对的概率” |
| 校准 | 在**你的数据分布**上，预测概率与实际频率相符 | 必须用 FLUX 自己的标签来测；通用任务上的 ECE 不能外推 |
| 音乐质量 | 多维度，部分主观，依赖听者和上下文 | 需要盲听标签；程序可检查的部分交给代码 |

**候选都很差时如何拒绝**：

1. 排序之前先用硬规则过滤（越界、空输出、非法音符、与旋律的强拍冲突率超过阈值）；
2. Choice 中加入 `none_suitable` 选项；
3. 对每个候选另问一个 Noul：“是否满足可用性 rubric”；
4. 当 max-prob 低于在开发集上调出的阈值时拒绝，并把“拒绝”作为一种结果计入评价。

**中文需求**：官方说明 CJK 优化较少，社区测试也显示非英语准确率下降。所以要把中文请求单独分层测。另一种做法是先由代码或 LLM 把中文请求规范化为英文模板，再交给 Jev；两种方式都需要实测。

### 5.4 Jev 适合哪些任务（每条都给出可以推翻它的条件）

| 用途 | 判断 | 可以推翻这个判断的结果 |
|---|---|---|
| 意图分类 / 工具选择（封闭集合，如“简化贝斯 / 重新生成 / 移调 / 变奏”） | **适合做实验** | 在 60 条中英命令上，准确率不高于“规则 + LLM”；或中文准确率低于 85% |
| 风格、角色标签（辅助标注） | 可以辅助，但必须人工抽查 | 与人工标签的一致率低于 70% |
| 对 4–8 个候选排序 | **值得做对照实验**，前提是候选以可读的类别特征描述 | top-1 与开发者盲选的一致率，没有比规则打分高出 10 个百分点 |
| 逐音符选择 | **不合适** | 要推翻它，需要逐音 Choice 生成的 16 音旋律在盲听中优于“候选生成 + 排序”，而且延迟可接受 |

逐音符选择不合适的理由：

1. 每个音一次网络往返（70–500 ms），几百个音就要几十秒到几分钟，而音频调度不能等待网络；
2. 每一步都是局部选择，没有长期结构；
3. 官方建议用 Choice 抽取**有界**选项，而不是把它当作自由生成器；
4. 逐音符决策需要精确计数时值，这正是它官方承认的弱项。

### 5.5 与其他判断方式的必要性和成本比较

| 方法 | 需要什么 | 长处 | 短处 | 单次成本或延迟 | 什么时候选 |
|---|---|---|---|---|---|
| 精确代码规则 | 规则和阈值 | 确定、可解释、零成本 | 无法判断“风格像不像” | 小于 1 ms | **所有硬约束**；排序的第一层 |
| 普通 LLM（结构化输出） | prompt 和特征描述 | 理解中文，能给出理由 | 慢、贵，概率不可用 | 约秒级 | 意图理解、给出批评理由 |
| Jev | 类别特征和选项 | 快、便宜、带概率 | 仅文本；不会数数；对选项名敏感；中文较弱 | 70–500 ms（美国西海岸测得）；约 $0.0001 | 封闭集合的快速决策（需先通过实验） |
| 音乐嵌入 / 检索（如 Aria embedding 模型） | 参考曲库和 embedding | 直接“看”音符，风格相似度更可靠 | 需要合法的参考库；风格不等于质量 | 本地毫秒级 | 风格匹配、去重、记忆检测 |
| 监督学习排序器 | 几百到几千条偏好标签 | 针对你的口味，最有潜力 | 需要先积累标签 | 本地毫秒级 | 有足够盲听标签之后 |

**怎样测出 Jev 的真实增益**：固定生成器版本，固定候选池。所有排序器面对**同一个**候选池。同时报告两个参照：池中存在可用候选的比例（oracle 上限）和随机选择的下限。排序器的收益用“相对于 oracle 能恢复多少”来衡量。这样生成器的改善就不会被算到排序器头上。

### 5.6 LLM 参与编曲的五条路线

| 路线 | 输入 → 输出 | 证据 | 主要风险 | FLUX 定位 |
|---|---|---|---|---|
| A. 直接输出音符 JSON | 需求 + 上下文 → 音符数组 | ABC-Eval（2025-09）显示 LLM 在符号音乐理解和指令遵循上有明显局限 | 计数/对拍错误；长数组贵且慢；重复 | 只作实验对照（短声部 + 校验器） |
| B. 和弦/结构计划 → 代码展开 | 需求 → 段落、和弦、角色、pattern ID、密度 → R0 展开 | 与 Session Players 的“和弦轨驱动”思路一致；Midra 已经实现 prompt → 计划 → 音符 → MIDI（Apache-2.0，没有质量基准） | 容易有模板感 | **首选的 LLM 用法** |
| C. 调用专用生成器 | 需求 → 生成器参数、条件、范围 → 候选 | 生成器能力受限于它本身支持的条件 | 工具调用不会凭空增加能力 | 次选，在模型通过 E2 之后 |
| D. 读取工程后批量编辑 | 工程快照 → 编辑操作集合 → 候选 → 应用 | MCP、DAW 桥接都在做这件事 | 并发、撤销、状态漂移 | **操作层**（edit_batch → candidate） |
| E. 多候选生成 + 批评重排 | N 个候选 → 过滤 → 排序 → 试听 | CoComposer（2025）：多代理 LLM 系统的音质仍不如 MusicLM，但可编辑性更好 | 候选全差时排序无效 | 与 Jev、规则排序一起做 E3 |

### 5.7 真实存在的 DAW 接口（区分官方与社区）

| DAW | 官方结构化接口 | 能否读写音符 / 撤销 | 社区桥接 | 维护风险 |
|---|---|---|---|---|
| Logic Pro | 只有 **Scripter**：轨道上的 JavaScript MIDI 插件，用于实时处理或生成 MIDI，需要开启“完整功能”（[Apple](https://support.apple.com/guide/logicpro/use-scripter-lgce728c68f6/mac)）。**没有项目级编程 API** | 社区 MCP 自己也写明 “Logic Pro does not expose a programmatic API”，region 中的音符无法以编程方式读回 | [koltyj/logic-pro-mcp](https://github.com/koltyj/logic-pro-mcp)（MIT）：CoreMIDI、AX、CGEvent、AppleScript、OSC。[MongLong0214/logic-pro-mcp](https://github.com/MongLong0214/logic-pro-mcp)（MIT）：先生成 SMF 再自动化导入；MIDI 读回写明为 “deferred”；返回“确认 / 不确定 / 失败”三态 | 高：UI 路径随版本变化，需要辅助功能和自动化权限，界面语言会影响元素定位 |
| Ableton Live | **LOM（Max for Live，JS/Max）**：`Clip.add_new_notes` / `get_notes_extended` / `remove_notes_extended` / `apply_note_modifications`（Live 11.0+）（[Cycling '74](https://docs.cycling74.com/apiref/lom/clip/)）。Python Remote Script 没有官方文档 | 可以读写音符；撤销走 Live 自己的撤销历史 | [ahujasid/ableton-mcp](https://github.com/ahujasid/ableton-mcp)（MIT，第三方）：Remote Script + socket + MCP；README 写明**匿名遥测默认开启**，可用 `ABLETON_MCP_DISABLE_TELEMETRY` 关闭 | 中 |
| REAPER | **ReaScript（Lua/EEL2/Python）**：`MIDI_InsertNote`、`MIDI_GetNote`、`MIDI_Sort`、`Undo_BeginBlock2/EndBlock2`、`TimeMap2_QNToTime` 等（[官方 API](https://www.reaper.fm/sdk/reascript/reascripthelp.html)） | **读写音符、撤销块都是官方支持**，结构化程度最完整 | 多个社区 MCP（bonfire-systems、total-reaper-mcp 等）；Composer's Assistant 就是基于 ReaScript 集成的 | 低到中 |

**结论**：要让 LLM 直接在外部 DAW 里编曲，REAPER 的官方接口最完整，Logic 最脆弱。FLUX 应该**以自己的项目模型为准**；把 MIDI 导出到 Logic 试听是最简单的路径；外部 DAW 的 MCP 作为独立的短实验，不作为网页可用性的前置依赖。**MCP 只是通道，不会让模型懂音乐。**

### 5.8 最小工具契约与共享业务层

```text
flux_core（Python 包，唯一业务层）
  model/      Project / Track / Clip / Note / ChordTrack / Candidate / Generation（tick 制，JSON Schema v1）
  validate/   结构校验 + 音乐规则（音域、重叠、小节边界、鼓映射、力度范围）
  generators/ R0 规则 | AMT 适配器 | MIDI-GPT 适配器 | …（同一接口：request → candidates + provenance）
  transforms/ 现有 core.transforms（补充音高 0–127 校验）
  store/      项目文件 + revision；候选库；生成日志 JSONL（只追加，按 run_id 分目录）
  jobs/       异步任务：取消、超时、幂等键
        ↑                  ↑                       ↑
  FastAPI（HTTP）     flux CLI（argparse）     MCP server（stdio；规范 2026-07-28，长任务用 Tasks 扩展）
        ↑
  浏览器：音频调度完全在本地，从不等待网络
```

最小工具集（HTTP、CLI、MCP 三者同名同 schema）：

| 工具 | 输入（摘要） | 输出 | 说明 |
|---|---|---|---|
| `project_inspect` | project、range? | revision、tempo、meter、key?、chords[]、tracks[]（id/name/role/program/isDrum/clips 摘要） | 只读；也可暴露为 MCP resource |
| `notes_read` | project、trackId、range | notes[]（有上限） | 只读 |
| `candidate_generate` | project、`expectedRevision`、task（add_role / vary / continue / transform）、reference（trackIds、range）、target（role、program、isDrum）、controls（style、density、register、chords?）、generator（name、version）、seed?、n≤4 | jobId | 异步 |
| `job_status` / `job_cancel` | jobId | 状态、候选、错误 | 迟到的结果会被标记为 stale |
| `candidate_validate` | candidateId | ok、errors[{code, where}]、metrics | 由程序检查 |
| `candidate_apply` / `candidate_reject` | candidateId、`expectedRevision`、幂等键 | newRevision | 原子操作，可撤销 |
| `edit_batch` | `expectedRevision`、ops[≤200]（move / resize / transpose / velocity / delete / quantize） | candidate | 编辑同样先形成候选，再 apply |
| `chords_estimate` / `chords_set` | trackId、range / chords[] | chords + 置信度 / candidate | 服务于和弦轨 |
| `project_undo` / `export_midi` | `expectedRevision` / path | newRevision / 文件 | — |

规则：

- 所有参数经 JSON Schema 校验；**不执行任何模型生成的代码或 shell**；
- 输出有上限；错误带错误码和位置；
- 使用 `expectedRevision` 做乐观并发，用幂等键防止重复提交；
- 每次生成都记录来源（generator、版本、权重 hash、seed、输入 hash）。

**先做 CLI 再包 MCP**，原因有三：实验运行器（E1/E2）本身就需要 CLI；编码代理已经会调用 CLI；等业务层稳定后，MCP 再补上工具发现和类型化 schema，供聊天客户端使用。

## 6. 更贴近流行乐的数据

### 6.1 数据集核验表（2026-09-26）

| 数据 | 风格 | 规模（口径） | 标注 | 来源 / 质量问题 | 访问门槛 | 发布者许可 | 适合 |
|---|---|---|---|---|---|---|---|
| POP909 | 中文流行 | 909 首（论文口径），每首有 MELODY / BRIDGE / PIANO 三轨 | 节拍 / 下拍、和弦、调 | 钢琴编配版本；仓库里还有多版本文件夹 | 公开 | 仓库 MIT（[repo](https://github.com/music-x-lab/POP909-Dataset)）；**底层作品版权未授权** | 流行钢琴伴奏、旋律→和弦任务的诊断和小规模适配（研究） |
| Pop1K7 | 西方 / 日本 / 韩国流行钢琴 | 1,747 段演奏，约 108 h（Zenodo） | 全部 4/4；提供 REMI / CP 表示；情绪版含调号 | Zenodo 页没写来源方法。原论文（Compound Word Transformer，AAAI 2021）描述为转录的钢琴翻弹，本轮未重读论文，待核；可能有转录与量化误差 | 公开（302.7 MB） | **CC BY 4.0**（Zenodo v1，2024-07-31，[record](https://zenodo.org/records/13143907)）；底层作品版权未授权 | 流行钢琴风格评估和适配（研究） |
| Lakh MIDI | 多风格，流行 / 摇滚多（推断） | full 176,581 个 unique；matched 45,129 个（对上 MSD） | 没有 genre 字段（要借 MSD 或 tagtraum 标签） | 网上收集；有几千个损坏文件；有 DTW 匹配错误和重复版本 | 公开 | CC-BY 4.0 分发（[site](https://colinraffel.com/projects/lmd/)）；底层版权未授权 | 清洗后的多轨流行子集；**AMT 训练用过它**（有污染风险） |
| MetaMIDI | 多风格 | 436,631 个 MIDI；143,868 个有 genre；168,032 个对上 MusicBrainz | genre / 艺人 / 标题 | 1.7 TB | **限制访问**：需研究者身份、机构验证、项目描述，并承诺不再分发 | 页面没写 | 流派筛选研究（需申请） |
| GigaMIDI v2.0.0 | 多风格 | 2,136,218 个 unique MIDI，6,891,738 条轨 | 策展风格标签；expressive / NOMML；loop 检测；GM 175 类 | 合并了 MetaMIDI、Lakh、XMIDI 等 | gated，需接受非商业研究条件 | **CC BY-NC 4.0**（[card](https://huggingface.co/datasets/Metacreation/GigaMIDI)） | 研究用的多轨流行筛选池；与 Lakh / MetaMIDI 有重叠；MIDI-GPT 和 RWKV 都用它训练过 |
| Slakh2100-redux | 由 LMD 渲染 | 2,100 首，145 h 音频 + 每个 stem 的 MIDI | 每首至少含钢琴、吉他、鼓、贝斯 | redux 版去掉了重复；FLAC 共 104 GB | 公开 | CC BY 4.0（[Zenodo](https://zenodo.org/records/4599666)） | 多轨功能测试、渲染、角色补全诊断（**不是新的人类编曲数据**） |
| MAESTRO v3 | 古典钢琴 | 1,276 段录音，198.7 h | 力度、踏板精确（约 3 ms 对齐） | 专业演奏 | 公开 | CC BY-NC-SA 4.0 | 钢琴表现力评估；不适合流行 |
| Aria-MIDI | 独奏钢琴（转录） | 1,186,253 个文件，约 100,629 h；子集 pruned 820,944 / deduped 371,053 / unique 32,522 | genre、作曲者（可能不准）、audio_score | 自动转录；文件数不等于作品数 | 公开 | CC-BY-NC-SA 4.0（[card](https://huggingface.co/datasets/loubb/aria-midi)） | 钢琴续写（研究） |
| MidiCaps | Lakh 衍生 | 约 168k 个文件 | 文本描述 + 调 / 拍号 / BPM / 和弦 / 乐器 / genre / mood 概率 | 描述由 LLM 根据特征生成，未经人工核验 | 公开 | CC BY-SA 4.0（[card](https://huggingface.co/datasets/amaai-lab/MidiCaps)） | 文本检索和风格条件；MIDI 的权利要追溯到 Lakh |
| PDMX | MuseScore 乐谱 | 25 万以上 MusicXML | genre、评分 | 12.29%（31,221 首）存在许可冲突；建议使用 `no_license_conflict` 子集 | 公开 | 仓库 MIT；作品按上传者标注为 PD / CC0（[repo](https://github.com/pnlong/PDMX)） | 权利相对清楚的乐谱来源；**上传者标“公共领域”不等于底层作品是公共领域**（流行改编尤其如此） |
| Chordonomicon | 当代音乐的和弦进行 | 666k 首 | 流派、年代、段落、Spotify ID | 来自 Ultimate Guitar | 公开 | CC BY-NC 4.0 | R0 / LLM 规划器的和弦先验（研究） |
| lmd_chords | Lakh 和弦 | 31,032 条 | Chordino 从渲染音频中提取 | 算法标注 | 公开 | CC BY-SA 4.0 | 和弦估计的抽检参照 |

### 6.2 不同用途对应的权利条件（不是法律意见）

| 用途 | Lakh | GigaMIDI | POP909 / Pop1K7 | Aria-MIDI / MAESTRO | 你的原创 |
|---|---|---|---|---|---|
| 研究使用 | 分发许可允许（需署名） | 在接受条款后允许 | 常见做法；按数据集许可操作 | 非商业可以 | 可以 |
| 微调 | 数据集许可层面允许；底层作品权利**未知** | 研究范围内允许 | 底层作品权利**未知** | 非商业；SA 条款是否延伸到权重**未知** | 可以 |
| 发布衍生权重 | **未知**（AMT 以 Apache-2.0 发布过权重，但这不能证明合法） | NC（MIDI-GPT 的权重就是 NC） | **未知** | NC | 可以 |
| 分发 MIDI | 可按 CC-BY 再分发数据集本身；底层权利**未知** | 仅非商业 | 按数据集许可；底层权利**未知** | NC-SA | 可以 |
| 商业产品 | **未知** | 禁止 | **未知** | 禁止 | 可以 |

原则：GitHub 上的 MIT 代码许可不等于授权了歌曲版权；条件未知的就写未知，不去推断有权或无权。我不是律师。正式对外发布前，请按学校或机构的要求咨询。

### 6.3 可执行的数据准备流程

1. **定义“流行”**：2000 年以后的主流 pop / pop-rock / R&B / ballad / dance-pop；70–130 BPM；以 4/4 为主，另收少量 6/8 和 3/4 作边界测试；有明确的主歌、副歌和和弦进行。把这些写成可以检查的元数据规则。
2. **候选池**：LMD-matched（配合 MSD / tagtraum 标签）加上 GigaMIDI 的策展风格标签（在研究条款范围内）；钢琴方向用 POP909 和 Pop1K7。
3. **过滤坏文件**：无法解析；超过 16 轨；速度低于 40 或高于 240 BPM，或频繁变速；时值为 0 或超过 8 小节；鼓不在 channel 10；密度异常；短于 8 小节。
4. **识别轨道角色**：
   - 鼓：channel 10；
   - 贝斯：program 32–39，或音域在 E1–G3 的最低单音线；
   - 旋律：最高的显著单音线；
   - 和弦 / 铺底：多音、持续；
   - 输出置信度，低置信度的样本进入人工确认。
5. **和声标注**：按拍或半小节做模板匹配（强拍和长音加权）；对照 lmd_chords 或 POP909 的标注抽检；记录置信度。
6. **去重**：三层——规范化音符内容后的精确 hash；移调不变的音程加 IOI n-gram 指纹（MinHash）；规范化后的曲名和艺人。把同一作品的不同编配和移调版聚成一个“作品簇”。
7. **先按作品簇划分**训练 / 验证 / 测试集，再切成 4 或 8 小节的片段。同一作品不得跨集合。
8. **检查污染**：对照各基座模型的训练语料做指纹比对（AMT 对 Lakh；MIDI-GPT 和 RWKV 对 GigaMIDI），报告重叠率；测试集优先使用你的原创。
9. **人工抽查**：每一步随机抽 50 个样本来听或看；错误率超过 10% 的规则要重新修改。
10. **写 manifest**：文件 hash、来源、许可、角色、和弦、作品簇、划分都记录进去；**不修改原始文件**。

### 6.4 你的原创和明确可用的音乐如何进入评估集

- 目录：`eval/originals/<piece_id>/`
  - `source.mid`：原始文件，不做任何修改；
  - `meta.json`：作者、权利声明（是否允许用于研究、**是否允许发送给第三方 API**）、BPM、拍号、调、和弦、段落、选段起止；
  - 4/8 小节切片由脚本生成。
- 这批材料**只用于测试**，不参与任何适配，以免泄漏。如果需要适配，另外建立“可训练”集合。
- 默认不外发。只有 `share_with_external_api=true` 的条目，才允许把代码抽取的特征发给 Jev 或其他 LLM，而且需要逐次运行时确认。
- 数量：开发诊断用 6 段；正式比较至少 20 段，覆盖 4–5 种流行子风格，另加 1–2 段非 4/4。

### 6.5 哪些问题靠条件和采样能解决，哪些要风格适配，哪些需要换模型

| 问题 | 预计的解决方式 |
|---|---|
| 终点截断、首音不可见、混轨、力度、超长延音 | 修管线（E0） |
| 乐器散乱 | 一次只生成一个角色，并在应用层明确目标轨 |
| 稀疏 / 空输出 | 修改终止条件，设最小密度，失败时重采样 |
| 与旋律的和声冲突 | 提供和弦轨；按强拍和弦音规则过滤；多候选重排 |
| 重复或过度模仿原旋律 | 相似度过滤，多候选 |
| 缺少现代流行的节奏惯用语（切分、16 分律动、trap hi-hat）、和弦词汇（add9 / sus / 借用和弦）、声部和音区习惯——**在管线修好、给了和弦之后仍然系统性缺失** | 风格适配（LoRA / state tuning）或 R0 的 pattern 库 |
| 任务本身无法表达（按小节 / 轨道补全、同 program 多轨、力度建模、拍号意识、全曲段落结构） | 换模型（AMT 的秒制表示和无力度是结构性限制） |

**LoRA / state tuning 值得做的条件**（需全部满足）：

1. E0 完成；
2. E2 已选出基座模型；
3. 在“不可用”的失败样本中，至少 50% 被标为“风格不符”，而不是时间或和声错误；
4. 有至少 100 首按作品隔离、允许研究使用的目标风格片段（state tuning 在论文中用 99 首就有效）；
5. 许可允许，并接受 NC 权重；
6. 事先写好指标和停止条件。

**停止条件**：

- 适配两轮后，在至少 40 对盲听中，相对基座的偏好率低于 55%，或者可用率提升不到 10 个百分点；
- 或训练集 n-gram 的记忆率上升；
- 或遇到许可阻塞。

**不建议从零开始大规模训练。**

## 7. 直接回答

**1. 当前最值得优先试的生成路线是什么，为什么？**

两条线并行：

- **(a) “和弦轨 + 角色 pattern”的确定性流行编曲器（R0）**，生成贝斯、鼓、和弦铺底和钢琴织体。它是第一版可用生成器，也是所有模型的基线。
- **(b) 修好的公平管线**上比较 AMT 与 MIDI-GPT yellow。每次只补一个角色的 4 小节，6 段 × 3 个种子。

原因：

- 你的首要问题是“不可用”。流行节奏组是高度惯用语化的，R0 能保证对拍、和弦一致、角色分离；它即时、可编辑、没有许可问题，并且有 Session Players 这一产品先例。
- 模型方面，MIDI-GPT 的接口（`TrackPrompt(id, bars)`、属性控制）与 FLUX 的交互最对齐，但权重是 NC，只能用于研究。
- 已有证据不支持“AMT 本身很差”（见 MIREX 2025）。要先把管线缺陷排除掉。

**2. Jev 是否值得接，接在哪一层，用什么小实验决定？**

- **现在不接入生成核心。** 它值得做一个很便宜的实验（费用不到 $1），位置是**候选排序层和意图路由层**，而且只接收代码抽取的类别特征。
- 决定用两个实验：
  - E3：固定候选池（约 20 段 × 6 个候选），与随机、规则打分、普通 LLM 比较 top-1 一致率和“全差拒绝”；打乱选项顺序、使用中性 ID；中英文分层；
  - E4：60 条中英命令的意图路由。
- 采用门槛：比规则打分高至少 10 个百分点，且置信区间不跨 0；交换顺序或名称后答案翻转率低于 10%；从英国发请求的 p95 低于 1 s；你同意外发特征。

**3. LLM + MCP / CLI 是主生成器、编曲规划器还是操作层？**

是**编曲规划器加操作层**，不是主生成器。LLM 输出类型化的计划（段落、和弦、角色、pattern、密度），调用工具产生候选，由校验器和用户决定是否保留。“直接输出音符 JSON”只作为短声部的实验对照。先做 CLI，再包 MCP，二者与 HTTP 共用 `flux_core`。

**4. 哪些数据适合流行钢琴，哪些适合多轨流行编曲？**

- **流行钢琴**：POP909（旋律、钢琴、和弦齐全）、Pop1K7（CC BY 4.0），以及 Aria-MIDI 中的流行子集（NC-SA）。
- **多轨流行编曲**：Lakh / GigaMIDI 经人工抽查的流行子集（GigaMIDI 限非商业研究）；MetaMIDI 需申请；Slakh 只用于功能测试和渲染。
- **和弦先验**：Chordonomicon（NC）、lmd_chords。
- **评估的核心**：你拥有权利的原创片段。

**5. core 六种变换应保留什么位置？**

保留为选区上的可选“变换”菜单，结果放进同音色的候选轨。同时让它们作为 LLM 可调用的精确工具，以及“同音色变奏”任务的无模型基线。需要补上音高范围和负时间校验。**不作为研究主线，也不是生成的前置步骤。**

**6. 接下来最先做的三件事是什么，怎样判断完成？**

1. **可听工作台 A 阶段**（DAW_REVIEW §0、§11）：tick 项目模型、SpessaSynth + 本地 GeneralUser GS、Musical Typing 键盘、运输控制 / 节拍器 / 倒数、多轨 M/S、候选轨、MIDI 导出。**完成标准**：DAW_REVIEW 中的 A 阶段验收用例（AT-01 至 AT-12、AT-16 至 AT-18）在 Chrome 中全部通过，Safari 的实际表现有书面记录；“新建 → 90 BPM 4/4 → 录 4 小节 → 生成同音色测试候选 → 对比 → 保留 → 导出 → 导回一致”这条流程不需要改代码就能完成。
2. **E0 管线修复与实验运行器**（EXPERIMENT_PLAN E0）：新的生成适配器单独返回候选；以小节为窗口；修复首音问题；设定 seed；结果写入独立的 run 目录。**完成标准**：每个已知缺陷都有回归测试——旧代码上失败、新适配器上通过；一次 dry-run 生成带 hash 的 manifest，并且不触碰 `pipeline_metrics.csv` 和已有 MIDI。
3. **R0 编曲器 + E1 诊断**：做出 R0 的最小版本（2 种风格 × 贝斯 / 鼓 / 和弦铺底），在 6 段 × 3 个种子上与修好后的 AMT（单角色）比较。**完成标准**：所有输出和失败都有记录；完成开发者盲听评分；写出书面的 go/no-go 决定，确定下一个接入的模型。

**7. 与现有报告最重要的三处一致和三处差异**：见 [CROSS_REVIEW.md 结尾](CROSS_REVIEW.md#三处最重要的一致与三处最重要的差异)。简述如下：

- **一致**：(1) 网页是 stub、没有训练过模型，先修管线再判断模型；(2) 由项目层掌握轨道身份，CLI → MCP 共用业务层，LLM 负责规划和操作，Jev 只处理代码抽取的特征；(3) 按任务选模型：MIDI-GPT 权重 NC，Aria 只做钢琴续写，数据许可要分开核验，暂不训练。
- **差异**：(1) 我把 R0 作为第一版生成器和强制基线，并补充了 CA2 和 AccoMontage2 两个遗漏的候选；(2) 我新增了源码级缺陷“首个 control 被 clip 掉”，以及“采样到越界 time 即终止导致稀疏”的假设，并引用 MIREX 2025 的证据修正“AMT 听感差”这一前提；(3) 交互上我主张“角色优先 + 和弦轨作为一等对象 + 盲听模式”，而不是默认生成同音色的“加一层”。

## 8. 仍未知或未验证

- Mac 的硬件规格；所有模型在 MPS 或 MLX 上的实测速度和内存。
- MIDI-GPT 各检查点的参数量；同 instrument 双轨能否完整 round-trip；HF 权重与 GitHub 文档的步数哪个是准的。
- CA2 的权重许可文本；它能否脱离 REAPER 使用。
- AccoMontage2 和 Structured Arrangement 检查点的许可。
- MIDI-RWKV 的 REMI+ 配置里有没有 tempo 和拍号 token。
- Jev 的上下文上限（64k 与 32k 冲突）；Jev 对中文音乐请求的准确率；你的账户能否拿到 early access；arXiv 2609.26758 的正文。
- 你所在学校对参与者研究的具体要求：本报告没有假设已经获批，正式的用户研究需要另走程序。
- 音源质量对“杂乱”感受的贡献，需要在统一音源下实测。
