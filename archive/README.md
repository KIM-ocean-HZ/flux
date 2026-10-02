# 历史归档与纠错索引

归档批次：2026-09-26（见《文件与纠错》）与 2026-10-02（见《2026-10-02 存档》）。以下文件仅用于追溯项目历史，不是当前需求、选型结论或可直接执行的任务表。

当前文档从 [项目 README](../README.md) 进入。归档保留了用户原有的未提交修改。Markdown 仅增加归档提示，原正文未重写；二进制文件保持原样，并附 `.NOTICE.md`。原始 SHA-256 及迁移位置在 [manifest.json](2026-09-26/manifest.json)。

`plans/` 原本不入 Git，迁移后的同名 plans 目录继续受现有忽略规则保护。没有提交或推送任何内容。

## 2026-10-02 存档

2026-09-30 导师会谈后，研究方向改为[研究设计 2026-10-02](../docs/research/RESEARCH_DESIGN_2026-10-02.md)。以下文件的工作顺序、推荐或会谈安排已被取代，移入 `2026-10-02/` 并保持原有相对目录。处理方式与上一批相同：Markdown 只在开头加归档提示，原正文未改；其他文件原样保留并附 `.NOTICE.md`；原始 SHA-256 与位置见 [manifest.json](2026-10-02/manifest.json)。`docs/claude_research/.DS_Store` 随目录一并移动。没有提交或推送。

| 原位置 | 归档文件 | 状态或需要纠正的信息 |
|---|---|---|
| `docs/CLAUDE_RESEARCH_PROMPT.md` | [查看](2026-10-02/docs/CLAUDE_RESEARCH_PROMPT.md) | 2026-09-26 独立调研轮使用的提示词。该轮已完成，不是当前任务。 |
| `docs/HANDOFF_A_2026-09-27.md` | [查看](2026-10-02/docs/HANDOFF_A_2026-09-27.md) | 阶段 A 的执行交接（可听工作台与和弦输入）。A 阶段已交付，交付与跟进记录仍在 docs/；文中“当前计划”指已存档的 RESEARCH_RESET。当前执行交接见 HANDOFF_R1，顺序见工作计划 2026-10-02。文中三处链接已在 2026-10-02 改指存档位置。 |
| `docs/RESEARCH_RESET_2026-09-26.md` | [查看](2026-10-02/docs/RESEARCH_RESET_2026-09-26.md) | 2026-09-26 的工作顺序入口（A → B：R0 → E0 → 模型比较 → 适配）。A 阶段已交付；研究顺序已被 2026-10-02 研究设计取代，R0 不再作为研究基线，B 阶段范围待重定。文中 AMT 管线缺陷诊断（生成终点取最后 onset、首个 50 ms control 被裁、混轨后来源配对不唯一等）在重新使用 AMT 时仍然有效。 |
| `docs/claude_research/2026-09-26/CROSS_REVIEW.md` | [查看](2026-10-02/docs/claude_research/2026-09-26/CROSS_REVIEW.md) | 2026-09-26 独立调研与当时报告的逐项交叉核对；保留为证据，不是当前计划。 |
| `docs/claude_research/2026-09-26/DAW_REVIEW.md` | [查看](2026-10-02/docs/claude_research/2026-09-26/DAW_REVIEW.md) | 2026-09-26 的 DAW 交互审查；A 阶段已据当时规格交付，本文不是当前计划。 |
| `docs/claude_research/2026-09-26/EXPERIMENT_PLAN.md` | [查看](2026-10-02/docs/claude_research/2026-09-26/EXPERIMENT_PLAN.md) | 2026-09-26 的实验计划；已被 2026-10-02 研究设计中的 RQ1／RQ2 实验设计取代。 |
| `docs/claude_research/2026-09-26/INDEPENDENT_REPORT.md` | [查看](2026-10-02/docs/claude_research/2026-09-26/INDEPENDENT_REPORT.md) | 2026-09-26 独立调研原稿。其中 R0 先行、AMT／MIDI-GPT 比较顺序、Jev／LLM 路线等推荐已被 2026-10-02 研究设计取代，关键模型、许可与数据事实已转入新文档第 9 节；保留为证据。 |
| `docs/claude_research/2026-09-26/SOURCES.md` | [查看](2026-10-02/docs/claude_research/2026-09-26/SOURCES.md) | 2026-09-26 调研的来源与核查日期；版本与许可可能已变化，引用前重新核查。 |
| `docs/research/FLUX_RESEARCH_SCOPE_2026-09-30.md` | [查看](2026-10-02/docs/research/FLUX_RESEARCH_SCOPE_2026-09-30.md) | 2026-09-30 会后的范围候选报告（A 最小必要修订、B 和声控制、C 轻量适配、D HCI）。已被 2026-10-02 研究设计取代：主线改为“以 motif 为起点、意图可选的多轨补全”，“最小必要修订”降为测试任务之一。文中对 MIDI-GPT v0.3.4、许可与版本锁定的核查仍可参考。 |
| `docs/research/LLM_TOOLS_2026-09-26.md` | [查看](2026-10-02/docs/research/LLM_TOOLS_2026-09-26.md) | 2026-09-26 Jev、LLM、MCP、CLI 路线调研。均不在当前研究范围内，仅作长期产品参考。 |
| `docs/research/MODELS_DATASETS_2026-09-26.md` | [查看](2026-10-02/docs/research/MODELS_DATASETS_2026-09-26.md) | 2026-09-26 模型与数据集背景报告。“R0 先行、AMT 基线、MIDI-GPT 为新增候选”的顺序已被取代，现以 MIDI-GPT 为主模型。注意 POP909 只有旋律、bridge、钢琴三轨，没有 bass 和鼓。关键许可与版本事实已转入研究设计第 9 节。 |
| `docs/research/RESEARCH_REVIEW_2026-09-26.md` | [查看](2026-10-02/docs/research/RESEARCH_REVIEW_2026-09-26.md) | 2026-09-26 调研复评与 E0–E7 实验修订。实验顺序已被 2026-10-02 研究设计取代；来源边界与许可核查可作参考。 |
| `docs/supervision-2026-09-30/FLUX_SUPERVISOR_BRIEF.docx` | [查看](2026-10-02/docs/supervision-2026-09-30/FLUX_SUPERVISOR_BRIEF.docx) | 2026-09-30 导师简报的 Word 版本。会后研究方向已改，见 2026-10-02 研究设计。 |
| `docs/supervision-2026-09-30/FLUX_SUPERVISOR_BRIEF.md` | [查看](2026-10-02/docs/supervision-2026-09-30/FLUX_SUPERVISOR_BRIEF.md) | 2026-09-30 会谈前给导师的英文背景简报。会后研究方向已改：不再以“旋律＋确认和弦→bass，并与规则 R0 比较”为主线，R0 退出研究对比；当前方向见 2026-10-02 研究设计。文中对已实现工作台的描述仍可用于“已有工作”声明，测试数字是 2026-09-29 的记录。 |
| `docs/supervision-2026-09-30/FLUX_SUPERVISOR_BRIEF.pdf` | [查看](2026-10-02/docs/supervision-2026-09-30/FLUX_SUPERVISOR_BRIEF.pdf) | 2026-09-30 导师简报的 PDF 版本。会后研究方向已改，见 2026-10-02 研究设计。 |
| `docs/supervision-2026-09-30/Flux_Discussion_Brief_2026-09-30.docx` | [查看](2026-10-02/docs/supervision-2026-09-30/Flux_Discussion_Brief_2026-09-30.docx) | 2026-09-30 会谈讨论稿。会后结论（AI 或 HCI 方向均可、先定 scope 与 research goal、规则 bass 生成器本身是大项目）已写入 2026-10-02 研究设计。 |
| `docs/supervision-2026-09-30/MEETING_PREP_ZH.md` | [查看](2026-10-02/docs/supervision-2026-09-30/MEETING_PREP_ZH.md) | 2026-09-30 会谈的中文准备笔记。会议已举行，演示路线与讨论要点不再作为执行依据。 |
| `docs/supervision-2026-09-30/VERIFICATION_SMOKE.json` | [查看](2026-10-02/docs/supervision-2026-09-30/VERIFICATION_SMOKE.json) | 2026-09-29 简报所附的无头浏览器冒烟检查记录，只是当时的工程证据，不代表人工试听。 |
| `docs/supervision-2026-09-30/workbench.png` | [查看](2026-10-02/docs/supervision-2026-09-30/workbench.png) | 2026-09-29 简报所用的工作台截图。 |

仍然有效：

- RESEARCH_RESET 中的 AMT 管线缺陷诊断，在重新使用 AMT 时仍然有效。
- MIDI-GPT 代码为 MIT、权重为 CC-BY-NC-4.0；按名称加载会解析到最新快照，实验必须锁定具体文件。
- 导师简报中对已实现工作台的描述可用于“已有工作”声明；其中的测试数字是 2026-09-29 的记录。
- 2026-09-30 会谈结论：AI 或 HCI 方向均可；先定 scope 与 research goal；规则 bass 生成器本身就是一个大项目。

## 文件与纠错

| 原位置 | 归档文件 | 状态或需要纠正的信息 |
|---|---|---|
| `README.md` | [查看](2026-09-26/README.md) | 旧状态和排期已被 2026-09-26 用户需求取代。原文中的测试数量、MPS 速度属于历史记录；更换 tag 不会隔离 pipeline_metrics.csv。 |
| `docs/PHASE1_RESTART_2026-09.md` | [查看](2026-09-26/docs/PHASE1_RESTART_2026-09.md) | 旧里程碑和不做播放等范围限制已失效。随机再生成不保证每次不同；新 tag 只隔离 MIDI/PNG，不隔离 CSV。 |
| `docs/PROFESSOR_DEMO_RUNBOOK.md` | [查看](2026-09-26/docs/PROFESSOR_DEMO_RUNBOOK.md) | 旧版演示流程，不能作为当前产品能力或下一阶段计划。端口启动方式已有更新。 |
| `docs/SUPERVISOR_HANDOVER_2026-09.md` | [查看](2026-09-26/docs/SUPERVISOR_HANDOVER_2026-09.md) | 保留导师交接背景；状态、时间表和待讨论研究问题仅代表当时，当前技术路线重新评估。 |
| `docs/mgeval_decision.md` | [查看](2026-09-26/docs/mgeval_decision.md) | 保留历史选型理由；单曲 muspy 指标不等于音乐质量评分，也不能替代目标调性和轨道遵守率检查。 |
| `docs/representation_decision.md` | [查看](2026-09-26/docs/representation_decision.md) | “10 ms 编码无损覆盖网格”表述过强。秒制量化可能损失节奏精度，当前 AMT 转换还不能保留独立同音色轨道身份及全部 MIDI 表情。 |
| `docs/supervisor_email_draft.md` | [查看](2026-09-26/docs/supervisor_email_draft.md) | 已发送并于 2026-07-07 收到回复的通信归档，不是待发邮件。目标轨硬保证表述不成立，会议日期未作本轮核实，文中计划微调没有完成。 |
| `docs/vertical_slice_spec.md` | [查看](2026-09-26/docs/vertical_slice_spec.md) | 撤销 locked 状态。允许乐器集合不保证指定目标轨有输出；当时 API 无 target_instrument。新多轨与播放需求也需要更新协议和前端，不能承诺只替换后端。 |
| `docs/worklog_phase0_zh.md` | [查看](2026-09-26/docs/worklog_phase0_zh.md) | 历史记录中“约束解码硬保证目标轨”错误；medium 稀疏由分布外输入导致仅是未验证假设；试听描述不是系统评估。早期发邮件待办已被后文回复关闭。 |
| `docs/worklog_v3_zh.md` | [查看](2026-09-26/docs/worklog_v3_zh.md) | 任务 A 实现记录保留。精确有理数不意味着任意缩放均落在固定 48 ticks 网格；20 个测试覆盖案例而非对所有可能输入的证明。该任务不再是生成路径的必经步骤。 |
| `plans/FLUX_Project_Plan.md` | [查看](2026-09-26/plans/FLUX_Project_Plan.md) | 旧总计划和时序已失效。LoRA 未开展，端上/低延迟领域空白和目标轨保证等泛化表述不可直接引用；导师邮件已获回复。 |
| `plans/FLUX_Project_Plan_CN.md` | [查看](2026-09-26/plans/FLUX_Project_Plan_CN.md) | 旧总计划和时序已失效。LoRA 未开展，端上/低延迟领域空白和目标轨保证等泛化表述不可直接引用；导师邮件已获回复。 |
| `plans/FLUX_v3.md` | [查看](2026-09-26/plans/FLUX_v3.md) | 旧产品策略已被本轮需求重设。“0 延迟、不可能出错”、硬保证目标轨等绝对表述不成立；训练式修复层尚未实现。文献/竞品和申请日期需要独立核实。 |
| `plans/FLUX_research_overview.docx` | [查看](2026-09-26/plans/FLUX_research_overview.docx) | 2026 年 5 月研究构想，早于现有实现。用户研究、领域空白、实时性等是当时提案，不代表验证结果或当前路线。 |
| `plans/FLUX_research_overview.pdf` | [查看](2026-09-26/plans/FLUX_research_overview.pdf) | 2026 年 5 月研究构想的 PDF 版本，不代表当前实现或已证实研究结论。 |
| `plans/flux_phase0.xlsx` | [查看](2026-09-26/plans/flux_phase0.xlsx) | 旧任务表仍记 Python 3.11 和任务待开始；当前环境是 3.12，基础阶段已完成。不要按表内旧状态重新执行安装。 |
| `plans/flux_phase1.xlsx` | [查看](2026-09-26/plans/flux_phase1.xlsx) | 旧排期和训练任务不是完成记录。目标轨硬保证、分布外输入是稀疏原因、最佳听感等表述缺乏对应系统证据。 |
| `plans/~$flux_phase1.xlsx` | [查看](2026-09-26/plans/~$flux_phase1.xlsx) | Office 临时锁定文件，仅保留原始文件，不是项目任务表。 |

## 仍然有效的历史事实

- 当前研究代码使用 AMT 预训练权重；本项目没有训练或微调过模型。Essen 是候选测试旋律库。
- 四组 pilot 是单输入、无重复的概念验证，且 top_p 不一致；CSV 统计的是输入与混合结果。不能用来证明约束提高质量或 medium 更快。
- core 中六种变换是真实独立工具；已有测试不表示整套产品已经接通。
- 导师通信归档保留原有日期与内容；不根据旧文档推断新的导师决定或会议截止时间。
- 用户本轮反馈“生成音乐不可用、杂乱无章”应作为当前产品问题记录，不伪装成已完成的盲听实验。
