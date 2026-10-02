> **历史归档 · 2026-10-02 · 不作为当前执行指令。**
> 原位置：`docs/claude_research/2026-09-26/EXPERIMENT_PLAN.md`。2026-09-26 的实验计划；已被 2026-10-02 研究设计中的 RQ1／RQ2 实验设计取代。
> 当前入口：[项目 README](../../../../../README.md)；[当前研究设计](../../../../../docs/research/RESEARCH_DESIGN_2026-10-02.md)；[归档纠错索引](../../../../README.md)。正文保留历史原文，相对路径和旧命令按原位置解释。

<!-- ARCHIVED ORIGINAL BELOW -->
# FLUX 实验计划（2026-09-26）

> 本计划**没有执行**任何下载、训练、付费调用或模型推理。每个实验都列出所需资源和成本估计，由你决定是否执行。所有估计值都已标注“估计”。

## 0. 原则

1. **不动已有产物**：不追加 `data/results/pipeline_metrics.csv`，不覆盖 `data/generated/*.mid` 和 `data/sample/sample_melody.mid`。所有新实验写入 `data/experiments/runs/<run_id>/`（`data/` 已在 `.gitignore` 中）。
2. **可复现**：固定并记录代码提交、依赖锁、权重文件 sha256、tokenizer 版本、seed、输入 hash、全部参数、设备和 dtype。模型不能“按名称取最新”（MIDI-GPT 的 `from_pretrained` 会解析到最新检查点）。
3. **保留全部结果**：失败、空输出、超时都要记录，不能只保留最好的一次。
4. **一次只改一个因素**：诊断阶段逐项加入修复。
5. **统一试听条件**：同一个 SoundFont、同样的增益和响度归一化、同样的片段长度；隐藏系统名称，随机播放顺序。
6. **区分两种评价**：开发者自评是工程诊断；如果邀请其他参与者，就属于正式研究，须按学校的实际要求与导师确认（**不预设已获审批**）。

## 1. 实验总览

| 编号 | 目的 | 依赖 | 需要下载 | 估计耗时 | 估计费用 | 决策 |
|---|---|---|---|---|---|---|
| E0 | 修管线、搭实验运行器、写回归测试 | 无 | 无 | 工程 2–4 天（估计） | 0 | 能否开始公平比较 |
| E1 | “杂乱”因素诊断（6 段 × 4 小节） | E0 | AMT small / medium（7 月运行过，**可能已在本机 HF 缓存中，未核验**） | 生成约 1 h；试听和评分约 1–1.5 h | 0 | AMT 修复后是否值得继续比较 |
| E2 | 生成器正式比较（约 20 段） | E0、R0、E1 | MIDI-GPT yellow（82.5 + 350.5 MB）；可选 CA2 / RWKV | 生成 2–4 h；试听 4–6 h，分次进行 | 0 | 每个任务的默认生成器 |
| E2b | 钢琴续写比较 | E0 | Aria medium（2.63 GB）、AMT large（约 3.1 GB，估计） | 生成 1–2 h；试听约 2 h | 0 | 钢琴续写选哪个模型 |
| E3 | 候选排序：Jev 与基线 | E2 的候选池和评分 | 无（需要 API key 或 early access） | 约 2 h | Jev 约 $0.05；普通 LLM $1–5（估计） | Jev 是否进入默认路径 |
| E4 | 中英意图路由 | E0（工具集） | 无 | 约 2 h | 不到 $1（估计） | 用规则、LLM 还是 Jev |
| E5 | 表示探针：能否读懂 MIDI 数字 | 无 | 无 | 约 1 h | 约 $0.02（Jev） | Jev / LLM 的输入形式 |
| E6 | LLM 规划 + R0 对比 LLM 直接写音符 | R0、工具集 | 无 | 约 3 h | $1–5（估计） | LLM 的定位 |
| E7 | 风格适配（有条件才做） | E2 结论 + 数据准备 | 视基座而定 | state tuning 分钟级；LoRA 小时级（估计） | 本地 0 | 是否保留适配 |

**所有外部 API 调用都需要你事先批准**。未批准时 E3–E6 只做离线准备，不做实际调用。

## 2. “杂乱”的假设表与最小证伪实验

| # | 假设 | 最小证伪实验 | 控制变量 | 如果成立，预期观察到 | 对应动作 |
|---|---|---|---|---|---|
| H1 | 把网页 stub 当成了模型 | 查代码路径；在网页上标出“测试生成器” | — | 已由源码证实：网页从未调用 AMT | 网页显示生成器名称；stub 只在测试模式下出现 |
| H2 | 音源和音量让正确的音符听起来也乱 | 同一批 MIDI 分别用 (a) GeneralUser GS 统一增益、(b) 旧播放方式渲染，盲听比较 | 同一批 MIDI，同样响度 | (a) 的“乱”评分明显更低 | 定下统一试听音源和混音 |
| H3 | 导出单位出错（输出固定 120 BPM，tpb 50） | 用 90 BPM 的输入生成；检查输出 MIDI 的拍网格与输入是否对齐 | 同一输入 | 输入不是 120 BPM 时，输出拍线错位 | 用源 tempo map 做秒到 tick 的映射（E0-T6） |
| H4 | 末音窗口被截断 | 对照 C0 与 C1（终点改为选区末尾） | 同样的 seed、输入、参数 | C1 在第 14–16 拍出现伴奏，终止感改善 | 以小节为窗口（E0-T1） |
| H5 | 首音对模型不可见 | 对照 C1 与 C2（自有采样循环不 clip 掉小于 50 ms 的 control） | 同上 | C2 在第 0–1 拍出现生成音；第 1 小节与和弦更一致 | E0-T2 |
| H6 | 缺少和弦上下文 | 对照 C4 与 C5（把和弦铺底作为额外的 controls） | 同上 | C5 强拍和弦音比例上升，冲突率下降 | 和弦轨作为条件 |
| H7 | 同时生成了太多乐器 | 对照自由模式与单角色（C3） | 同上 | 单角色时“乱”评分下降，各角色的密度可控 | 一次只生成一个角色 |
| H8 | 采样参数过于发散 | C6：top_p 取 0.90 / 0.95 / 0.98，seed 固定 | 只改 top_p | 调内比例和冲突率随 top_p 单调变化 | 选定稳定区间，并报告失败率 |
| H9 | 稀疏是因为提前终止 | 记录每次生成在哪一步因 `new_time ≥ end_time` 结束；C4a：生成到终点再加 2 s 余量后裁剪；C4b：屏蔽越界的 time token，并设事件上限 | 同上 | 早停比例高；C4a / C4b 的密度恢复，且质量不下降 | 改写停止条件 |
| H10 | 重复或模仿原旋律 | 计算候选与源旋律的音程 n-gram 重合率 | — | 重合率高的候选被评为“没新意” | 用相似度过滤，多出候选 |
| H11 | 按秒表示导致偏拍、没有小节意识 | 统计 onset 落在 1/16 网格上的比例，以及强拍命中率 | 对照 R0 和 MIDI-GPT | AMT 的网格命中率明显更低 | 量化后处理，或换成小节感知的模型 |
| H12 | 训练域与现代流行不符 | 同一系统分别用你的流行段落和 Essen 民歌生成，比较可用率 | 同样的修复和参数 | 流行输入的可用率明显更低 | 进入 E7 的条件之一 |
| H13 | 缺少力度表情 | 同一候选分别用平直 72 和按角色的力度 pattern 渲染，盲听 | 同一批音符 | pattern 版评分更高 | 采用力度策略（E0-T4） |
| H14 | 超长延音造成浑浊 | 同一候选裁剪时值（贝斯 ≤1 小节，铺底 ≤2 小节）与不裁剪对照 | 同一批音符 | 裁剪版的“浑浊”评分下降 | 采用时值策略（E0-T5） |
| H15 | 旋律与生成的钢琴混在同一轨，旋律被淹没 | 同一批音符分别以混轨和分轨方式渲染，旋律 +3 dB | 同一批音符 | 分轨版旋律更清楚 | 独立候选轨（E0-T3） |

## 3. E0：管线修复与实验运行器

这里提出的是新的**适配器和运行器**；旧的 `research/pipeline.py` 保留为历史基线，不改动。

| 编号 | 修改（作用于新模块） | 回归测试（在旧逻辑上应当失败，在新逻辑上应当通过） |
|---|---|---|
| T1 | 生成终点 = 选区末尾（按小节换算成秒），不再用 `ops.max_time` | `test_window_end_uses_range_end_not_last_onset`：Twinkle 的终点应为 8.0 s，而不是 7.0 s |
| T2 | 自有采样循环：去掉 `clip(controls, DELTA, …)`，或把输入整体右移并在输出时移回 | `test_first_control_visible`：14 个 control 全部进入 token 序列 |
| T3 | 适配器只返回新生成的事件和来源信息，不做 `ops.combine`；导出时由项目层分配轨道和通道 | `test_same_program_candidate_separate_track`：program 0 的候选导出后仍然是独立的轨和通道 |
| T4 | 源轨不经过模型往返；生成音的力度按角色设定 | `test_source_velocity_preserved`；`test_generated_velocity_policy` |
| T5 | 生成音的时值在范围末尾截断，并按角色设上限 | `test_duration_clipped_at_range_end` |
| T6 | 用源 tempo map 在秒与 tick 之间换算（支持非 120 BPM） | `test_tempo_mapping_90bpm_roundtrip` |
| T7 | 每次调用都设置 seed（`torch.manual_seed`），并记录 RNG 与设备 | `test_seed_reproducible_on_cpu`（MPS 可能存在不确定性，要单独注明） |
| T8 | 调用之后读取 `model.device`，如实记录是否回退到 CPU | `test_device_recorded_after_fallback` |
| T9 | 分阶段计时：冷加载（设 `HF_HUB_OFFLINE=1`）、预热、生成、后处理 | `test_timing_fields_present` |
| T10 | 结果写入 `runs/<run_id>/`，绝不追加全局 CSV | `test_no_write_to_pipeline_metrics_csv`（在临时目录中对全局 CSV 做 hash 比较） |
| T11 | `core` 校验音高 0–127 和时间 ≥0 | `test_transforms_reject_out_of_range_pitch` |
| T12 | 采样循环记录停止原因（越界 time、事件上限、异常） | `test_stop_reason_logged` |

**完成标准**：T1–T12 全部通过；一次 dry-run（可以不加载模型，用假采样器）生成完整的 manifest；运行前后对 `data/results/`、`data/generated/`、`data/sample/` 的 hash 快照完全一致。

### 3.1 运行目录与记录格式

```text
data/experiments/runs/20261001-101500_e1-amt-diag/
  manifest.json      # 代码 commit、uv.lock sha256、权重 sha256、系统/设备、开始结束时间
  inputs/            # 输入 MIDI 及 meta.json（BPM、拍号、调、和弦、选区、角色）
  candidates/        # <cand_id>.mid（只含生成轨）+ <cand_id>.mix.mid（试听用混合，不参与指标计算）
  renders/           # <cand_id>.wav（统一 SoundFont 和增益）
  records.jsonl      # 每个候选一行，失败也写
  ratings.jsonl      # 盲听评分（评分者、时间、候选、等级、成对偏好）
```

`records.jsonl` 单行示例：

```json
{"run_id":"20261001-101500_e1-amt-diag","cand_id":"c0137","input_id":"pop03","input_sha256":"…",
 "task":"add_role","role":"bass","range":{"start_bar":0,"end_bar":4},
 "system":"amt","condition":"C5","model":"stanford-crfm/music-small-800k","weights_sha256":"…",
 "tokenizer":"anticipation@af37397","seed":1,"params":{"top_p":0.95,"end_margin_s":2.0},
 "device_requested":"mps","device_used":"mps","dtype":"float32",
 "timing_ms":{"load":0,"warmup":0,"generate":1840,"post":12,"total":1852},
 "stop_reason":"range_end","n_notes":23,"status":"ok","error":null,
 "metrics":{"in_range":1.0,"source_unchanged":true,"illegal":0,"density_per_bar":5.75,
            "chord_tone_strong":0.83,"clash_strong":0.04,"grid16_hit":0.97,"long_sustain":0,
            "melody_ngram_overlap":0.05}}
```

## 4. E1：开发诊断（6 段 × 4 小节，AMT 为主）

**输入**：6 段由你创作或确有权利使用的 4 小节片段，每段附 meta.json（旋律、和弦、BPM、拍号、调、目标角色）：

| id | 风格 | BPM | 拍号 | 特点 |
|---|---|---|---|---|
| pop01 | 抒情钢琴 ballad | 72 | 4/4 | 长音、I–V–vi–IV |
| pop02 | 常见四和弦流行 | 100 | 4/4 | 八分音符旋律 |
| pop03 | 切分 R&B | 90 | 4/4 | 十六分切分、七和弦 |
| pop04 | 流行摇滚 | 120 | 4/4 | 强拍重音 |
| pop05 | 舞曲 | 124 | 4/4 | four-on-the-floor |
| pop06 | 6/8 ballad | 66 | 6/8 | 两拍一组的附点四分律动 |

**条件**（逐项累加；R0 作为参照）：

| 条件 | 内容 |
|---|---|
| C0 | 复刻旧行为：终点取最后一个 onset，首个 control 被丢，自由乐器，top_p 0.98 |
| C1 | C0 + 终点取选区末尾（T1） |
| C2 | C1 + 首音可见（T2） |
| C3 | C2 + 单角色（贝斯、鼓、键盘分别单独生成，通过乐器掩码）；空输出时最多重采样 2 次 |
| C4a / C4b | C3 + 修复提前终止（加余量后裁剪 / 屏蔽越界 time 并设上限） |
| C5 | C4 最优者 + 把和弦铺底作为 controls |
| C6 | C5 × top_p {0.90, 0.95, 0.98} |
| C7 | C5 + 力度策略 + 时值裁剪（后处理） |
| R0 | 规则编曲器（2 种风格 pattern） |

**规模**：客观指标覆盖全部组合（6 段 × 3 个角色 × 3 个 seed × 约 9 个条件 ≈ 486 次 AMT small 生成；medium 只跑 C0 / C5 / C7）。试听只比较“完整节奏组”这一种组合方式，共 3 个系统（C0 自由生成、C7 分三个角色合成、R0）× 6 段 × 3 个 seed = 54 段，每段约 10 s。

**记录**：停止原因分布、空输出率、角色覆盖率、第 2 节列出的全部指标，以及分阶段计时。

**go/no-go**：

- **继续用 AMT 进入 E2** 需同时满足：C7 的空输出或稀疏（每小节少于 1 个音）比例 ≤ 20%；角色覆盖率 ≥ 90%；开发者评为“可直接用或小改可用”的比例 ≥ 30%。
- 不满足时，AMT 只作为基线留在 E2，不作为主要候选。
- 如果 C0 到 C7 的评分改善明显（“乱”评分平均下降 ≥ 1 级，按 3 级量表），就说明“杂乱”主要来自管线问题，这个结论应当写进项目记录。

## 5. E2：生成器正式比较

- **输入**：约 20 段，覆盖 5 种流行子风格和 2 段非 4/4，全部来自你的原创或确有权利的材料。按作品隔离，**不参与任何适配**。
- **系统**：R0；AMT 修复版（small，时间允许再加 medium）；MIDI-GPT yellow_medium（研究用途，NC）；可选 CA2 或 MIDI-RWKV（二选一，取决于工程可行性）；钢琴织体任务加入 AccoMontage2。
- **任务**：T-bass、T-drums、T-keys（和弦铺底）、T-piano（钢琴织体）、T-vary（同音色重写 1–2 小节）。
- **种子**：每个条件 3 个（资源允许时 5 个），全部保留。
- **指标**：

| 层 | 指标 | 定义 |
|---|---|---|
| 工程正确性 | source_unchanged | 源轨序列化 hash 相等（必须 100%） |
| | in_range | onset 落在目标范围内的比例 |
| | target_obeyed | 音符全部落在目标轨、目标 program、目标角色上 |
| | illegal | 越界音高、零时值、同轨同音高重叠 |
| | empty / sparse | 0 个音 / 每小节少于 1 个音（贝斯、键盘）或少于 4 个音（鼓） |
| | failure / timeout | 异常、超时 |
| | stale / cancel | 在网页中由 AT-14 验证 |
| 音乐特征 | density、polyphony、register | 每小节音数、平均同时发声数、相对旋律的音区（伴奏角色高于当前旋律音的时间比例） |
| | onset 分布 | 1/16 网格命中率、强拍命中率、切分指数 |
| | 和弦关系 | 强拍上属于和弦音的比例（依据和弦轨）；与发声旋律构成小二度、大七度、三全音的强拍冲突率 |
| | 重复与变化 | 小节间自相似度；与源旋律的音程 n-gram 重合率 |
| | 时值与延音 | 超过 2 小节的长音数 |
| 实际可用性 | 开发者盲评 | 3 级：可直接用 / 小改可用 / 不可用；与 R0 的成对偏好；以后在 FLUX 中记录实际修改的音符数 |
| 效率 | 冷加载、热生成、整次请求、可听时间 | p50 / p95（每个系统至少 20 次）；峰值内存；设备和 dtype；API 费用 |

- **统计**：成对偏好用符号检验，并给 bootstrap 95% 置信区间；报告效应量和 n。小样本结论明确标为“探索性”。
- **go/no-go**：某模型成为某任务的默认生成器，须同时满足以下条件：
  1. 工程：source_unchanged 100%，in_range ≥ 99%，failure ≤ 2%，empty ≤ 5%；
  2. 可用性：“可直接用或小改可用” ≥ 60%，并且相对 R0 的成对偏好 ≥ 60%，95% CI 下界 > 50%（至少 40 对）；
  3. 效率：在你的 Mac 上，4 小节热生成 p95 ≤ 5 s（采用异步交互时可放宽到 ≤ 10 s）；
  4. 许可：满足你的使用目的（研究或演示可以接受 NC；产品化不可以）。

  **没有模型达标时，R0 继续作为默认生成器**，模型在界面上标为“实验性”。

### E2b：钢琴续写

- 10 段钢琴 prompt（4 小节）× 3 个 seed，比较 Aria（MLX，`aria-medium-gen`）、AMT large、RWKV-piano（mirex2025 仓库）。
- 盲评项：连贯、结构、音乐性、创造性（参照 MIREX 的 4 项）；另做与训练集的 n-gram **记忆检查**（Aria 模型卡明确提示了记忆风险）。
- 续写的胜负**不外推**到伴奏任务。

## 6. E3：候选排序（Jev 与基线，**不改动生成器**）

- **候选池**：从 E2 中取 20 段 × 6 个候选（来自多个系统和 seed），冻结。标签取 E2 的开发者盲评：最佳者，以及每个候选是否可用。池中至少要有 3 段“全部不可用”。
- **排序器**：
  - 随机；
  - 规则打分（E2 指标加权，权重在开发集上调）；
  - Jev Choice（选项为中性 ID A–F 加 `none_suitable`；state 是代码抽取的类别特征加用户要求）；
  - Jev Noul（每个候选单问“是否满足可用性 rubric”）；
  - 普通 LLM（使用相同特征，结构化输出）；
  - 可选：音乐嵌入相似度（Aria embedding，与参考片段比较）。
- **扰动**：打乱选项顺序；中性 ID 与语义名称互换（如 “A” 换成 “warm_bass”）；中文与英文请求分层。
- **指标**：
  - top-1 与盲选最佳的一致率；NDCG@3；
  - “全差”拒绝的精确率和召回率；
  - 在可用性标签上的 Brier / ECE（仅作探索）；
  - 扰动下的翻转率；
  - 从英国发出请求的 p50 / p95 延迟；每次决策的成本。
- **oracle 参照**：候选池中存在可用候选的比例，以及随机选择的基线。排序器收益 =（排序器 − 随机）/（oracle − 随机）。
- **采用门槛**（Jev 进入默认路径需全部满足）：
  1. top-1 一致率比规则打分高至少 10 个百分点，且置信区间不跨 0；
  2. 翻转率 < 10%；
  3. p95 < 1 s；
  4. 中文请求上不比普通 LLM 差 5 个百分点以上；
  5. 你书面同意外发特征（原始 MIDI 不外发）。
- **费用**（估计）：20 × 6 个候选 × 约 2k tokens × 4 种变体 ≈ 1M tokens ≈ $0.04。

## 7. E4：中英意图路由

- 60 条命令（中文、英文各 30 条），涵盖“简化贝斯 / 重新生成 / 移调 / 变奏 / 加鼓 / 撤销 / 不清楚目标”等封闭集合，每条都有人工标注的预期操作和参数，其中包括需要澄清的边界情况。
- 比较：手写规则、普通 LLM 工具调用、Jev Choice（以及“先把中文规范化成英文模板再交给 Jev”）。
- 指标：操作类别准确率、参数完整度、澄清率、p50 / p95 延迟、费用。参数最终都由代码校验。
- 门槛：采用 Jev 须满足准确率 ≥ 规则 + LLM，且中文准确率 ≥ 85%。

## 8. E5：表示探针（能否读懂 MIDI 数字）

- 约 200 个真值可自动判定的问题：调内判断、强拍根音、切分检测、音符计数、音程判断。
- 三种输入形式：原始 MIDI JSON、代码抽取的特征、两者一起。
- 分别对 Jev（Noul / Choice）和普通 LLM 测准确率与校准。
- 预期：抽取特征的形式明显优于原始 JSON；计数类题目在原始 JSON 形式下接近随机。费用约 $0.02（Jev）。

## 9. E6：LLM 规划 + R0，对比 LLM 直接写音符

- 10 条流行编曲需求 × 2 条路线：
  - (a) LLM 输出 JSON 计划（段落、和弦、角色、pattern ID、密度），由 R0 展开；
  - (b) LLM 直接输出 4 小节贝斯的音符 JSON，经校验器检查，最多修复 2 轮。
- 指标：计划或音符的合法率、修复轮数、开发者盲评、费用、延迟。
- 采用门槛（路线 a）：合法率 ≥ 95%；相对 R0 默认预设的偏好 ≥ 55%；每次计划 ≤ $0.01；p95 ≤ 5 s。

## 10. E7：风格适配（只在条件满足时做）

- 前提条件见 INDEPENDENT_REPORT §6.5：E0 完成、基座已选定、失败中 ≥50% 被标为“风格不符”、数据按作品隔离且权利允许、许可可接受。
- 顺序：
  1. 只调整采样；
  2. 候选重排；
  3. state tuning（MIDI-RWKV，约 20–100 段，分钟级）；
  4. LoRA（MIDI-GPT 或 AMT，需确认许可）。

  每一步都与上一步比较。
- 停止条件：两轮后相对基座的偏好 < 55%（至少 40 对），或可用率提升 < 10 个百分点，或记忆率上升，或许可受阻。

## 11. 硬件、时间与成本估计

| 项 | 估计 | 依据或说明 |
|---|---|---|
| 设备 | 你的 Mac（arm64；具体芯片和内存**未知**）；MPS、MLX、CPU | 先用 `system_profiler SPHardwareDataType` 记录硬件 |
| 下载体积 | AMT small 512 MB（HF 实测文件大小）；medium 约 1.4 GB、large 约 3.1 GB（按参数量推算）；MIDI-GPT yellow 82.5 MB + 350.5 MB；Aria gen 2.63 GB；GeneralUser GS 约 32 MB | HF API 文件列表 |
| 内存 | Aria 0.7B 在 fp32 下权重约 2.6 GB，加上运行开销；AMT large 约 3.1 GB | 推断 |
| 生成时间 | 本轮**没有实测**。旧 CSV 里的 0.27–4.77 s 受多种混杂因素影响，不能用来估计 | — |
| 开发者试听 | E1 约 54 段 × 10 s；E2 约 300 段；按每小时评 60–80 段计，共 5–7 h，分多次进行 | 估计 |
| API 费用 | Jev 合计不到 $0.1；普通 LLM $1–10，取决于供应商和模型 | 估计；执行前需批准 |

## 12. 伦理与参与者研究边界

- 开发者自评用于工程决策，记录为“dev”评分者。
- 邀请他人参与评分、收集偏好或访谈，属于正式参与者研究，须按学校的实际要求与导师确认后再做。本计划不假设已有审批，也不把历史上“排除用户研究”的记录当作永久限制。
- 你的原创只在 `share_with_external_api=true` 且逐次确认后，才把**特征**（不是 MIDI 原文）发送给外部服务。

---

## 附录 A：只读产物解析脚本

在项目根目录执行 `uv run python <脚本>`。脚本只读取 MIDI，不写入任何文件。它就是本轮 INDEPENDENT_REPORT §2.2 的统计方法。

```python
import collections, glob, mido

TW = [(60,0,1),(60,1,1),(67,2,1),(67,3,1),(69,4,1),(69,5,1),(67,6,2),
      (65,8,1),(65,9,1),(64,10,1),(64,11,1),(62,12,1),(62,13,1),(60,14,2)]
CMAJ = {0, 2, 4, 5, 7, 9, 11}

def notes_of(m):
    out = []
    for t in m.tracks:
        tabs, prog, open_ = 0, None, {}
        for msg in t:
            tabs += msg.time
            if msg.type == "program_change":
                prog = msg.program
            if msg.type == "note_on" and msg.velocity > 0:
                open_.setdefault((msg.channel, msg.note), []).append(tabs)
            elif msg.type == "note_off" or (msg.type == "note_on" and msg.velocity == 0):
                k = (msg.channel, msg.note)
                if open_.get(k):
                    out.append(dict(ch=msg.channel, prog=prog, pitch=msg.note,
                                    on=open_[k].pop(0), off=tabs))
    return out

for f in sorted(glob.glob("data/generated/*.mid")):
    m = mido.MidiFile(f); tpb = m.ticks_per_beat
    mel = {(p, round(t * tpb)) for p, t, d in TW}
    ns = notes_of(m); used = set(); gen = []
    for n in ns:
        key = (n["pitch"], n["on"])
        if n["ch"] == 0 and key in mel and key not in used:
            used.add(key); continue
        gen.append(n)
    pitched = [n for n in gen if n["ch"] != 9]
    clash = sum(any(n["on"] < (t+d)*tpb and n["off"] > t*tpb and (n["pitch"]-p) % 12 in (1, 11)
                    for p, t, d in TW) for n in pitched)
    print(f, "melody", len(used), "gen", len(gen),
          "programs", sorted(collections.Counter(n["prog"] for n in pitched)),
          "out_of_key", sum(n["pitch"] % 12 not in CMAJ for n in pitched),
          "clash", clash,
          "onsets", (min((n["on"] for n in gen), default=0)/tpb, max((n["on"] for n in gen), default=0)/tpb),
          "ring_past_16", sum(n["off"] > 16*tpb for n in gen))
```

注意：`transforms_demo.mid` 和 `amt_from_scratch.mid` 不是 Twinkle 的伴奏输出，它们的统计没有意义，可以忽略。本轮在 VM 中用仓库 `.venv` 里 mido 的副本运行过这个脚本，结果与 INDEPENDENT_REPORT §2.2 一致。

## 附录 B：源码级复算（不加载模型）

```python
from anticipation import ops
from anticipation.config import DELTA
from anticipation.convert import midi_to_events
from anticipation.vocab import CONTROL_OFFSET

ev = midi_to_events("data/sample/sample_melody.mid")
controls = [CONTROL_OFFSET + tok for tok in ev]
print(ops.max_time(controls, seconds=True))  # 7.0：最后一个 onset，而旋律结束于 8.0 s
kept = ops.clip(controls, DELTA, ops.max_time(controls, seconds=False),
                clip_duration=False, seconds=False)
print(len(kept) // 3, "of", len(controls) // 3)  # 13 of 14：第 0.0 s 的音被丢掉
```
