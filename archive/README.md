# 历史归档与纠错索引

归档日期：2026-09-26。以下文件仅用于追溯项目历史，不是当前需求、选型结论或可直接执行的任务表。

当前文档从 [项目 README](../README.md) 进入。归档保留了用户原有的未提交修改。Markdown 仅增加归档提示，原正文未重写；二进制文件保持原样，并附 `.NOTICE.md`。原始 SHA-256 及迁移位置在 [manifest.json](2026-09-26/manifest.json)。

`plans/` 原本不入 Git，迁移后的同名 plans 目录继续受现有忽略规则保护。没有提交或推送任何内容。

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
