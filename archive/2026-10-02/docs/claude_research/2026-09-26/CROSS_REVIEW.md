> **历史归档 · 2026-10-02 · 不作为当前执行指令。**
> 原位置：`docs/claude_research/2026-09-26/CROSS_REVIEW.md`。2026-09-26 独立调研与当时报告的逐项交叉核对；保留为证据，不是当前计划。
> 当前入口：[项目 README](../../../../../README.md)；[当前研究设计](../../../../../docs/research/RESEARCH_DESIGN_2026-10-02.md)；[归档纠错索引](../../../../README.md)。正文保留历史原文，相对路径和旧命令按原位置解释。

<!-- ARCHIVED ORIGINAL BELOW -->
# 交叉核对：现有结论与独立判断（2026-09-26）

对照对象：

- `docs/RESEARCH_RESET_2026-09-26.md`（下文简称 RESET）
- `docs/DAW_SPEC_2026-09-26.md`（DAW_SPEC）
- `docs/research/MODELS_DATASETS_2026-09-26.md`（MODELS）
- `docs/research/LLM_TOOLS_2026-09-26.md`（TOOLS）

我的独立判断在读这些报告之前就已写成，见 [INDEPENDENT_REPORT §1](INDEPENDENT_REPORT.md#1-初步判断写于阅读现有报告之前)。“一致或分歧”一列的取值：**一致**；**一致（补充）**，指结论相同、我有新增证据；**分歧**；**未决**，指双方都没有足够证据。

## A. 代码与现状

| 争议主张 | 现有结论 | 我的独立判断 | 支持与反证 | 一致或分歧 | 最小解决实验 |
|---|---|---|---|---|---|
| 网页 Suggest 是随机 stub，没有调用 AMT | RESET：代码确认，网页听感不能算作 AMT 失败 | 同意 | `backend/main.py:66-83` 是随机的低八度音和三度音；后端不 import `research.*` | 一致 | 不需要 |
| FLUX 没有训练过模型；Essen 只是输入池 | RESET / MODELS：原先的假设是错的 | 同意，而且事实更弱：`pipeline` / `ab_test` **根本没读 Essen**，所有有记录的运行只用了 Twinkle；`peft` 没有被 import | 在代码中 grep 不到任何训练代码或 Essen 调用 | 一致（补充） | 不需要 |
| 生成终点取的是最后一个 onset | RESET / MODELS：源码确认 7 s 对 8 s，“影响大小未实测” | 同意 | 纯 Python 复算得 7.0；**5/5 个伴奏产物在第 14 拍（最后旋律 onset）之后没有任何生成 onset** | 一致（补充产物证据） | E1 的 C0 对 C1 |
| **首个 control 被 `sample.generate` 裁掉** | 未提及 | 源码确认：`clip(controls, DELTA=5 ticks, …)` 会丢掉 onset <50 ms 的 control；Twinkle 只剩 13/14 | 复算结果 13/14；**5/5 个产物在第 0–1 拍都没有生成音**（因果待验）。上游 main 至今仍是这行代码 | **分歧（新发现）** | E0-T2；E1 的 C1 对 C2 |
| medium 输出稀疏、接近空的原因 | 归档记录：“分布外输入导致”只是未验证假设。MODELS：列为“乐器硬限制导致分布异常或稀疏”假设 | 另提一个具体机制：采样循环一旦抽到 onset ≥ end_time 的 time token 就 `break`，即**提前终止** | medium 两组在第 4 拍之后都没有任何音；源码第 176–179 行 | **分歧（新的可证伪假设）** | E0-T12 记录停止原因；E1 的 C4a / C4b |
| 采样器已经把生成和 controls 分开，聚轨发生在 combine 和写 MIDI 两步 | RESET / DAW_SPEC 7.2：同意 | 同意 | 产物 `ab_small_constrained` 的 track0 = 14 + 49 个音 | 一致 | E0-T3 |
| AMT 丢失力度、CC、弯音、拍号 | DAW_SPEC §8、RESET：同意 | 同意，并把原因拆成“词表层”和“转换层”；另外补充：**输出固定按 120 BPM 解释（tpb 50，无 set_tempo）**；**原旋律的力度也被改写成 72** | `convert.py` 源码；产物力度全是 {72}，没有 tempo 事件 | 一致（补充） | E0-T4 / T6 |
| pilot 不可归因 | RESET / MODELS / 归档：同意 | 同意；补充两点：回退 CPU 后 CSV 的 device 列仍写 `mps`；参考采样器没有 KV cache | `generate.py:51-58`；`sample.py:add_token` | 一致（补充） | E0-T8 / T9 |
| 约束集合不保证目标轨非空 | RESET：两组约束 pilot 的贝斯都是 0 | 同意（贝斯 0，鼓最多 1） | 产物解析 | 一致 | E1 的 C3，外加重采样 |
| 测试通过数 | RESET：23 passed | 云端副本上 20/20 个变换测试通过；3 个 web 测试因缺 fastapi 没有运行 | 部分复现 | 一致（部分） | 在本机执行 `uv run pytest -q` |
| core 六种变换的位置 | 可选的“变换”菜单和研究对照，不是必经步骤 | 同意；另外应补上音高和负时间校验，并作为 LLM 的工具 | 能构造出 `Note(pitch=200)` | 一致（补充） | E0-T11 |

## B. 模型

| 争议主张 | 现有结论 | 我的独立判断 | 支持与反证 | 一致或分歧 | 最小解决实验 |
|---|---|---|---|---|---|
| AMT 的定位，“现有听感差” | MODELS：保留为基线，“现有听感差”是主要障碍 | 保留基线，同意。但“听感差”的依据是一次 n=1、受多个缺陷影响的 pilot，**不能当作模型能力的结论** | **MIREX 2025 钢琴续写盲听**：Anticipatory 780M 的 coherency 3.70、structure 3.69、creativity 3.30 为四个系统中最高，musicality 3.45 接近最高（14 名评分者，第三方）。反证：那是钢琴续写，不是流行伴奏，而且规则允许挑选输出 | **部分分歧** | E1（C0→C7）、E2b |
| 多轨生成的首选路线 | MODELS / RESET：**MIDI-GPT 是首选多轨候选**；规则或 LLM 计划只作对照 | **R0“和弦轨 + 角色 pattern”是第一版生成器，也是强制基线**；MIDI-GPT 是第一个模型候选（仅研究用，NC） | 支持：流行节奏组高度惯用语化；Logic Session Players 以和弦轨驱动；R0 即时、可控、没有许可问题。反证：R0 可能有模板感，可以在 E2 盲听中检验 | **分歧（排序与定位）** | E2：模型相对 R0 的 go/no-go |
| Composer's Assistant 2 | 未列入 | 应当入选：track-measure 补全，只用公共领域和宽松许可数据训练，**许可最干净** | arXiv 2407.14700；MIT 仓库，v2.1.0。反证：与 REAPER 绑定，流行风格覆盖可能偏弱 | **分歧（遗漏）** | E2 可选系统；先评估脱离 REAPER 的成本 |
| AccoMontage2 / Structured Arrangement | 未列入 | 入选作为流行钢琴织体的对照（织体来自 POP909，代码 MIT，限 4/4） | 仓库 README；反证：需要乐句标注，检查点许可没写 | **分歧（遗漏）** | E2 的 T-piano |
| MIDI-GPT 的许可与检查点 | 代码 MIT、权重 CC-BY-NC；检查点步数不一致；必须锁定 | 同意；HF API 显示 yellow 为 82.5 / 350.5 MB；docs 写 step 58000，HF 上是 376000 | HF API 与 `docs/models.md` | 一致 | 锁定 sha256 |
| MIDI-GPT 的 `ignore=True` 会把轨道排除出上下文；支持 MPS 参数；有 HTTP 服务 | MODELS 提到 | 没有独立核验 | — | **未决** | 读源码并写单测 |
| MIDI-RWKV | 第二轮对照；许可范围需确认 | 同意；补充：约 35M 参数，CPU 上 8 小节约 3 s；state tuning 用 99 首 POP909，只训练 294K 参数、约 4 分钟，显著优于 LoRA | arXiv v2 正文 | 一致（补充） | E2 可选；E7 |
| Aria | 独立做钢琴续写试验；`aria-medium-gen` endpoint 返回 401 | 同意；base 仓库里已经有 `model-gen.safetensors`（2.63 GB） | HF API | 一致（补充） | E2b |
| music2music 许可空缺；GETMusic 权重链接失效 | 同意 | 同意（`m2m_arranger` 没有 license 字段；issue #203 自 2024-09 起一直未关） | HF API、GitHub issue | 一致 | 等许可或权重可用后再考虑 |
| YuE2 | 2026-09 发布；权重 CC-BY-NC-4.0，另附个人创作者补充条款 | README 确认了 YuE2 与 CC BY-NC 4.0 权重（WildSongBench 的日期写 2026-09-12）；抓取 releases 页显示“没有 release”；**补充条款未核验** | 不同页面给出的版本入口不一致 | 一致（版本入口未决） | 不需要（不是主线） |
| MIDI-LLM 的会议 | 标注为 ISMIR 2026 | GitHub 描述写 ISMIR '26；HF 与论文页写 NeurIPS 2025 AI4Music workshop，两者可以同时成立 | — | 一致（补充） | 不需要 |
| SkyTNT midi-model 的优先级 | 作为实用对照，优先级高于自建大模型 | 不进决赛：训练数据 LAMD 的权利不清楚，也没有目标轨补全的接口约定 | 模型卡 | 轻度分歧 | 资源有余时加进 E2 |
| 新系统：MuScriptor（2026 多乐器转录）、RWKV-piano（MIREX 2025） | 未列入 | MuScriptor 只作旁路（NC 许可，不保留力度）；RWKV-piano 作为钢琴续写的第三个候选 | GitHub、arXiv | 补充 | E2b |

## C. 数据

| 争议主张 | 现有结论 | 我的独立判断 | 支持与反证 | 一致或分歧 | 最小解决实验 |
|---|---|---|---|---|---|
| Pop1K7 的许可 | “本次未核验压缩包内的数据许可” | Zenodo v1（2024-07-31）为 **CC BY 4.0**，1,747 段、约 108 h；底层作品版权未授权 | Zenodo record 13143907 | **分歧（补上了缺口）** | 不需要 |
| MetaMIDI 的访问方式 | Restricted，没拿到完整条件 | 条件是：研究者身份、机构验证、项目描述、承诺不再分发；页面没写许可 | Zenodo 页面 | 一致（补充） | 如果要用，提交申请 |
| GigaMIDI | 210 万以上文件；CC-BY-NC；非商业研究 | 同意（v2.0.0：2,136,218 个文件、6.89M 条轨） | HF 数据卡 | 一致 | — |
| 推荐的数据组合 | 原创 + POP909 + Slakh MIDI + GigaMIDI / Lakh 抽查子集 | 同意；补充：和弦先验（Chordonomicon 为 NC；lmd_chords 为 CC BY-SA）、“作品簇”去重、对基座训练语料做污染检查 | — | 一致（补充） | 按 INDEPENDENT_REPORT §6.3 执行 |
| 不把调性当硬掩码 | 同意（流行乐有借用和弦、蓝调音） | 同意 | — | 一致 | — |

## D. DAW

| 争议主张 | 现有结论 | 我的独立判断 | 支持与反证 | 一致或分歧 | 最小解决实验 |
|---|---|---|---|---|---|
| Musical Typing 键位、Tab / Cmd-K / 输入法处理 | 已给出规格 | 同意（依据 Apple 文字和 GarageBand 手册核验） | — | 一致 | AT-01 至 AT-06 |
| 音频引擎 | SpessaSynth 优先；Tone.js 视情况 | 同意；补充：**SpessaSynth 官方兼容列表里没有 Safari**，需要尽早测试，并准备 smplr 作为降级方案 | SpessaSynth README | 一致（补充） | A 阶段第一周在 Safari 上测试 |
| 生成默认 | 默认新建同音色候选轨，任务是“加一层” | **角色优先**（+贝斯、+鼓、+和弦铺底、+钢琴伴奏各带默认音色）；只有“变奏 / 续写”默认同音色 | 流行编曲最常见的需求是补节奏组；同音色叠加容易变厚变乱 | **分歧（UX）** | 可用性走查：5 个任务，统计步骤数和误操作 |
| 和弦 | RESET 提到“可选和弦”；DAW_SPEC 的数据模型里没有和弦轨 | **和弦轨作为一等对象**（数据、界面、“从旋律估计”） | Logic Session Players 以和弦轨驱动；能让和声问题可诊断 | **分歧（补充）** | E1 的 H6（C4 对 C5） |
| 录音延迟 | 另行测量，不按猜测减固定毫秒 | 同意；补充公式和敲拍校准流程 | — | 一致（补充） | AT-07 |
| 盲听比较 | 未作为 UI 功能 | 加入盲听模式，用来积累 E2 / E3 的标签 | — | 补充 | AT-20 |

## E. Jev、LLM、MCP

| 争议主张 | 现有结论 | 我的独立判断 | 支持与反证 | 一致或分歧 | 最小解决实验 |
|---|---|---|---|---|---|
| Jev 的身份、版本、价格、限制 | TypeSafe AI；2026-09-15；`jev-1.13.0`；$0.042/M；仅文本；限制列表 | 同意（均直接核对了官方页面） | docs.typesafe.ai | 一致 | — |
| Jev 的上下文上限 | 64k；state 加最长问题 32k | TypeSafe 文档写 64k / state 32k；**OpenRouter 文档写总共 32k** | 两份文档冲突 | 未决 | 在实际账户上测试 |
| Jev 的独立证据 | 引用 arXiv 2609.26758（选项名的语义会干扰决策） | 补充社区可复现测试：Score 的 ECE 为 0.325 且过度自信；换选项名导致 32.5% 答案翻转；非英语准确率下降。**arXiv 正文因 429 没读到**，只确认了它存在 | GitHub 测试仓库、DEV 文章 | 一致（补充） | E3 的扰动测试 |
| Jev 的用途 | 意图路由、候选排序可以试；不逐音符使用；数值计算交给代码 | 同意；另外给出可推翻的条件和采用门槛 | 官方 jaggedness 页 | 一致 | E3 / E4 / E5 |
| Jev 不用客户数据微调 | 现有报告称官方已明确 | 已核实原句：“Jev is not fine-tuned or LoRA-adapted with customer data” | Models 页 | 一致 | — |
| LLM 的角色，以及先 CLI 后 MCP | LLM 负责计划、参数和批量编辑；共享函数先包 CLI，再按需包 MCP | 同意（规划器 + 操作层） | ABC-Eval、CoComposer 的证据 | 一致 | E6 |
| MCP 规范版本 | 引用 2025-11-25 | **当前最新版本为 2026-07-28**（stateless 请求、Tasks 扩展） | modelcontextprotocol.io | 轻度分歧（引用版本过时） | 实现时对照最新规范 |
| 各 DAW 接口的基本事实 | Logic 只有 Scripter 加社区 MCP；REAPER 的 ReaScript 最完整；Ableton 有社区 MCP | 同意；补充 Ableton 官方 LOM 的具体 Clip 接口；Logic 社区 MCP 自己也写明“没有编程 API”，MIDI 读回推迟 | 官方文档与 README | 一致（补充） | — |
| DAW MCP 的版本号 | ableton-mcp HEAD 为 2026-09-22；MongLong v3.17.0（2026-09-25） | 抓取结果互相矛盾（MongLong 的页面显示 v3.13.0，日期也不一致），**无法核验** | 页面缓存可能过时 | 未决 | 使用前在本机 `git log` 确认 |
| ableton-mcp 的遥测 | 默认开启；README 写 3.8+，pyproject 写 3.10+ | README 确认遥测默认开启、写的是 3.8+；pyproject 没有核验 | README | 一致（部分核验） | 安装前查看 pyproject |
| Midra | 存在，Apache-2.0，可借鉴分层设计 | 确认：prompt → 计划 → 音符（LLM 或规则两种模式）→ MIDI；使用 OpenAI 模型；没有质量基准 | GitHub README | 一致 | — |

## 三处最重要的一致与三处最重要的差异

**一致**

1. **先修管线、公平比较，再评判模型。** 网页是随机 stub，FLUX 没有训练过模型，七月的 pilot 不可归因。我另外从产物中找到了截断和混轨的直接证据。
2. **由项目层掌握轨道身份。** `trackId`、program、通道分开；生成结果在合并之前就分离，放进候选轨。业务层由 CLI → MCP / HTTP 共用；LLM 负责规划和操作；Jev 只处理代码抽取的特征，不逐音符使用。
3. **按任务选模型，注意许可。** MIDI-GPT 权重为 NC，只作研究候选；Aria 只做钢琴续写；数据许可要逐项区分；在有证据之前不训练；不宣称任何模型“全面超过 AMT”。

**差异**

1. **生成路线的优先级。** 我把 R0“和弦轨 + 角色 pattern”编曲器作为第一版生成器和强制基线，并补上了现有报告遗漏的 Composer's Assistant 2（许可最干净）和 AccoMontage2（流行钢琴织体）。现有报告以 MIDI-GPT 为首选，规则方法只作对照。
2. **“杂乱”的诊断。** 我新增了源码级缺陷“首个 control 被 clip 掉”，以及可证伪的假设“采样到越界 time 就终止，导致稀疏”。同时引用 MIREX 2025 的第三方同任务证据，说明“AMT 听感差”不能作为既定前提。现有报告没有提到这两个机制，并把“现有听感差”列为 AMT 的主要障碍。
3. **生成交互。** 我主张“角色优先 + 和弦轨作为一等对象 + 盲听模式”。现有规格默认“同音色加一层”，数据模型里也没有和弦轨。

我没有为了凑出差异而硬找分歧：上面三处都有具体证据，而且都能用最小实验检验（E1 的 C2 / C4、E2 相对 R0 的 go/no-go、UX 走查）。
