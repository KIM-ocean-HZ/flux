> **历史归档 · 2026-10-02 · 不作为当前执行指令。**
> 原位置：`docs/supervision-2026-09-30/MEETING_PREP_ZH.md`。2026-09-30 会谈的中文准备笔记。会议已举行，演示路线与讨论要点不再作为执行依据。
> 当前入口：[项目 README](../../../../README.md)；[当前研究设计](../../../../docs/research/RESEARCH_DESIGN_2026-10-02.md)；[归档纠错索引](../../../README.md)。正文保留历史原文，相对路径和旧命令按原位置解释。

<!-- ARCHIVED ORIGINAL BELOW -->
# FLUX 与 Paul 会谈准备

会议日期：2026-09-30。英文主文档是给导师阅读的背景说明，不是按课程字数限制提交的正式 proposal。本文供你自己准备。

## 这次要让 Paul 理解什么

FLUX 的长期目标是帮助创作者发展已有音乐：输入旋律，表达和声与声部意图，生成可以独立试听和修改的候选，最后由人决定作品的内容。个人 dissertation 应从这个产品愿景里切出一个能够完成、比较和解释的研究问题。

建议定位是：**AI／可控音乐生成作为主线，HCI 研究人怎样表达、检查和修正控制。** 两者用同一个任务连接，第一步是“短旋律＋确认的和弦 → 一条独立贝斯伴奏”。这个任务小，但需要真正解决条件编码、约束解码、生成来源、音乐质量、延迟和用户修正的问题，足够形成技术深度。

先收窄到贝斯是本次给 Paul 的范围建议。现有产品规划仍包含两种风格的贝斯／鼓／铺底；在导师讨论后，再决定是否收缩本学期的正式目标。这份材料没有替换当前 RESEARCH_RESET 或发布 B 阶段执行 handoff。

## 一分钟英文开场

“FLUX is a MIDI composition tool for developing music that a person has already started. I have built the browser workbench, including playback, recording, multitrack editing and explicit chord input. I also have a separate experimental pipeline using a pretrained music model, but it is not connected to the current web application yet.

“For the dissertation, I would like to focus on controllable music generation: whether explicit chords and role-specific controls can produce useful accompaniment while preserving the user's existing music. I also want to study how people express and revise those controls through the interface. My aim is to have a reproducible system and a meaningful evaluation by November or December. I would particularly value your advice on the research scope, what counts as convincing musical and HCI evidence, and how to separate the work already completed from the dissertation contribution.”

## 你可以准确地说已完成什么

- 网页已经能真实发声，有电脑键盘试弹、录音、步进、多轨、卷帘编辑、撤销、MIDI／项目保存与中英文界面。
- 和弦识别与手动确认已实现；调性和级数是规则推测，可以修正。它们不是训练出来的新模型，也不等于给任意单旋律自动配和声。
- 有独立的 AMT 预训练模型实验管线和六种精确音乐变换；都没有接入当前网页。FLUX 没有训练过模型，安装 `peft` 不等于已经做过 LoRA。
- “和弦轨转 MIDI”是固定柱式和弦展开。R0 角色节奏型、真实模型候选，以及保留／丢弃／重新生成的完整流程仍待实现。
- 本轮复跑前端 102 项、Python 25 项测试，构建成功。保留的四份浏览器报告各有 56/56 通过；它们是历史工程证据，不能证明音乐质量。

旧网页随机 `/api/suggest` 和历史 AMT 模型是不同路径。当前 UI 已没有生成按钮，不要说“网页演示的这些伴奏是 AMT 实时生成的”。现有用户项目中的四条轨也不能当作新的模型结果展示。

## 六分钟演示路线

演示前，保存自己当前工作的项目，在单独页面打开用于展示的副本。优先用已经熟悉且试过的浏览器、音源和音频输出设备，提前切换英文。现有样例是仓库根目录的 `a02_same_program.flux.json`：4 轨、76 音，已确认和弦为 C/E、Gm/D、F/C、F/C。

| 时间 | 操作 | 说明重点 |
| --- | --- | --- |
| 0:00–1:00 | 打开项目、启用声音、播放 | 这是当前真实工作台；音源在本机 |
| 1:00–2:00 | Mute／Solo 两条轨，查看不同音色 | 轨道身份独立，用户能分别检查声部 |
| 2:00–3:00 | 打开卷帘，移动一个音，试听后撤销 | 结果需要能编辑、恢复，而不只是播放 |
| 3:00–4:15 | 查看已确认和弦和级数；展示手动调性选择 | 同一进行可以有不同解释；推测与用户决定分开 |
| 4:15–5:15 | 选一个和弦区域，转成新 MIDI 轨，单独试听并撤销 | 明确说是确定性和弦展开，不是 AI 伴奏 |
| 5:15–6:00 | 展示项目保存与 MIDI 导出入口，解释下一阶段 | 模型将返回独立候选轨；目前尚未连接 |

这个例子在自动推测 F 大调时可以显示 V–ii–I；手动选 C 大调时可以解释为 I–v–IV，并涉及借用和弦。不要声称其中一个是唯一正确答案。单旋律样例不会自动识别出完整和弦进行；如果要展示即时和弦识别，实际同时弹出 C–E–G 等和弦。

如有时间，再单独展示 `data/generated/ab_small_constrained.mid` 等历史 AMT 产物，并注明是早期探索、有条件和采样设置混杂、并非本轮新结果。原始 MIDI 缺少部分表达信息，听感不宜作为模型胜负证明。

启动与复习命令：

```sh
cd /Users/hzjin/flux
npm --prefix frontend run build
# 若 8000 没有运行中的服务，再启动；不要与已有进程重复占用端口。
uv run uvicorn backend.main:app --port 8000
```

打开 `http://127.0.0.1:8000/`。可用音源位于 `data/phase_a/soundfonts/GeneralUser-GS.sf2`。本轮已确认现有 8000 页面可达。临场不要为了展示而运行 `research.pipeline`、`research.ab_test` 或 `scripts/demo_check.sh`；它们会写历史产物。可提前准备一段录屏或使用本次说明中的界面截图作为故障备用。

## 为什么建议这样做研究

产品路线回答“创作者能完成什么”，研究路线回答“哪一种方法在什么条件下有效”。网页可以是实验平台；但只有界面、接上模型和若干好听样例，还不足以支持模型改进的结论。

AI 方面，先让所有比较条件使用正确的时间与来源转换，然后分别改变和弦条件、目标角色约束和可选的和声约束。R0 是同一伴奏任务的规则基线。六种动机变换是另一个编辑任务，不能直接拿来当贝斯生成的公平对照。不能把“全都不生成”算作约束成功，也不能用整首混合 MIDI 的好指标掩盖候选为空。

HCI 方面，需要观察的不是有没有按钮，而是用户能否理解系统推测、修正和弦、比较候选、发现不符合意图之处并恢复操作。要声称界面更好，应尽量固定模型与输出条件；否则模型变化会混入界面评价。没有参与者研究时，仍可做设计论证、任务 walkthrough 和自己的创作过程记录，但结论要限定到这些证据。

## 从 Paul 那里争取的具体帮助

优先讨论三个决定：**研究问题与最低贡献、音乐／HCI 评价路线、未来两周的交付**。技术细节可以用英文说明的附页展开。

1. “Is this a sufficiently focused research contribution for the dissertation?” 请他判断一个可控伴奏方法加消融实验是否足够，是否需要更窄的算法创新。
2. “What evidence would you consider convincing for musical usefulness and user control?” 请他帮忙选择指标、盲听或形成性研究，以及各自能支持的结论。
3. “How should I declare the work I have already done?” 主动说明已有代码，确认作为起点使用与本课程新增工作的界限。
4. “Would a small musician study be feasible within the ethics timeline?” 旧材料排除了正式用户研究，那是历史决定；请他确认现在的条件。专家反馈、听评和访谈也不能自行假定不需要伦理流程。
5. “What should I have ready for our next meeting?” 把大方向落成一个可检查的成果，比如生成契约、R0 贝斯候选演示和实验设计页。

Paul 的公开研究背景涉及交互与创作实践，因此可以具体请教交互问题、研究方法和呈现方式；不能据此假设他一定提供音乐模型实现、参与者、GPU 或额外合作导师。音乐理论或音乐 AI 的专项建议，可请他判断是否需要引入相关同事。

## 十一月至十二月最终拿得出什么

建议争取的是一份互相支持的成果组合：能复现的原型、一个真实可控生成任务、一组有基线和失败样例的实验、HCI 设计与适当的评价证据、技术研究报告、2–3 分钟演示视频。研究生申请材料能据此说明你提出了什么问题、实现了什么、怎样证明，以及哪些问题还没解决。

不要把“必须训练大模型”“必须发论文”或“必须做成完整商业 DAW”设为十二月的成败标准。若模型不如 R0，诚实、可重复的失败分析仍有研究价值；但要明确它没有达到优质模型伴奏的产品目标。若实验支持一个小的控制方法改进，比继续堆功能更值得深入。

学校手册是 2023 年版。它要求 proposal、伦理清单、interim、dissertation 和 demo；当前年度日期要从 Moodle 核实。尤其要区分：十一月至十二月是你申请研究生需要的阶段成果时间，而正式 dissertation 在所给旧手册中安排于下一学期。正式 proposal 还需要在 Paul 给出意见后压缩到当年要求的篇幅。

会后记录：主 RQ ______；首个任务 ______；HCI／听评路线 ______；伦理事项 ______；新增 assessed contribution ______；两周交付 ______；下次会面 ______。
