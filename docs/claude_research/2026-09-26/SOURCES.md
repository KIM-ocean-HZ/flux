# 来源、核验日期与未解决问题

所有外部来源的核验日期都是 **2026-09-26**（BST），获取方式是网页抓取或搜索。“版本 / 日期”一列记录的是来源页面自己写的版本或日期。“访问状态”一列的取值：

- **OK**：内容已读；
- **仅搜索**：只在搜索结果中确认存在；
- **冲突**：多个页面给出的内容互相矛盾；
- **受阻**：因 robots、403 或 429 读不到。

证据等级沿用 INDEPENDENT_REPORT §0。

## 1. 本地仓库（只读）

| 对象 | 用途 | 状态 |
|---|---|---|
| `backend/main.py`、`frontend/src/*.jsx`、`frontend/package.json`、`vite.config.js` | 核实网页现状 | OK（源码确认） |
| `research/{generate,pipeline,ab_test,dataset,metrics,sample_data}.py` | 核实研究管线 | OK |
| `core/transforms.py`、`tests/*.py` | 核实变换层和测试 | OK；云端副本 20/20 通过 |
| `.venv/.../anticipation/{config,vocab,ops,sample,convert,tokenize}.py`（提交 `af37397`） | 核实 AMT 的词表、采样和转换 | OK（源码确认 + 纯 Python 复算） |
| `data/generated/*.mid`、`data/sample/sample_melody.mid`、`data/results/pipeline_metrics.csv` | 分析七月产物 | OK（产物确认） |
| `pyproject.toml`、`uv.lock` | 核对依赖版本 | OK |
| `README.md`、`AGENTS.md` 及同内容的本地约定文件、`archive/README.md` | 了解开发约定和历史 | OK |

## 2. DAW 与浏览器音频

| 来源 | 主张 | 版本 / 日期 | 状态 |
|---|---|---|---|
| [Apple：Play software instruments in Logic Pro](https://support.apple.com/guide/logicpro/play-software-instruments-lgcpb19cbd34/mac) | Cmd-K；Z/X 八度；C/V 力度；1/2 弯音；3–8 调制；Tab 延音 | 页面没写日期 | OK（文字）；键位图片没有抓取 |
| [Apple GarageBand '09 手册镜像，p.60](https://www.manualsdir.com/manuals/547630/apple-garageband-09.html?page=60) | 中排按键为白键，范围 C 到 F，一个半八度；W E T Y U O P 为黑键 | 2009 年手册 | OK（镜像站） |
| [Apple：Scripter](https://support.apple.com/guide/logicpro/use-scripter-lgce728c68f6/mac) | 实时处理 MIDI 的 JS 插件；需开启完整功能 | — | OK |
| [Apple：Chords and Session Players](https://support.apple.com/guide/logicpro/chords-and-session-players-lgcp70dd5af3/mac) | Session Players 跟随和弦轨；没有和弦时弹主和弦 | — | OK |
| [MDN Web MIDI](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API) | 需要安全上下文、用户授权，受 Permissions Policy 约束 | 页面修改于 2026-05-15 | OK |
| [caniuse：MIDI](https://caniuse.com/midi) | Chrome 43+、Edge 79+、Firefox 108+；Safari 不支持 | 抓取当日 | OK |
| [MDN isComposing](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing) | 输入法组字状态 | — | OK |
| [web.dev：A tale of two clocks](https://web.dev/articles/audio-scheduling) | 25 ms 定时器 + 100 ms lookahead | — | OK |
| [Tone.js](https://github.com/Tonejs/Tone.js)；[npm tone](https://registry.npmjs.org/tone/latest) | MIT；Transport；需要用户手势才能启动音频 | npm 最新版 15.1.22 | OK |
| [SpessaSynth](https://github.com/spessasus/SpessaSynth)；[spessasynth_lib](https://github.com/spessasus/spessasynth_lib)；[BasicSynthesizer API](https://spessasus.github.io/spessasynth_lib/synthesizer/basic-synthesizer/) | Apache-2.0（npm 字段写 MIT AND Apache-2.0）；支持 SF2/SF3/DLS；提供 `noteOn`、`controllerChange`、`addNewChannel`；兼容列表里没有 Safari | v4.3.0（2026-05-18）；npm 4.3.9 | OK |
| [smplr](https://github.com/danigb/smplr) | MIT；Soundfont 走 gleitz 的 MusyngKite / FluidR3 | npm 1.0.0 | OK |
| [@tonejs/midi](https://github.com/Tonejs/Midi) | MIT；MIDI 解析和写入 | npm 2.0.28 | OK |
| [js-synthesizer](https://github.com/jet2jet/js-synthesizer) | 封装层 BSD-3；libfluidsynth 为 LGPL-2.1 | libfluidsynth 2.4.6 | OK |
| [WebAudioFont](https://github.com/surikov/webaudiofont) | 代码 GPL-3.0 | — | OK |
| [GeneralUser GS 许可](https://raw.githubusercontent.com/mrbumpy409/GeneralUser-GS/main/documentation/LICENSE.txt) | 可用于软件项目，可修改，不强制署名；采样来源无法完全确认 | v2.0.3 | OK；文件大小**未能核验**（仓库目录页被 robots 拒绝） |
| [Debian fluid-soundfont 版权文件](https://metadata.ftp-master.debian.org/changelogs//main/f/fluid-soundfont/fluid-soundfont_3.1-5.3_copyright) | FluidR3：MIT（Frank Wen、Toby Smithe） | 3.1-5.3 | OK |
| [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) | FluidR3 渲染版标 CC BY 3.0；MusyngKite 与 FatBoy 为 CC BY-SA 3.0；体积 148 MB / 1.75 GB / 320 MB | — | OK；**与 Debian 对 FluidR3 的 MIT 表述冲突** |
| [MuseScore_General 许可](https://ftp.osuosl.org/pub/musescore/soundfont/MuseScore_General/MuseScore_General_License.md) | MIT | v0.2（2020-05-13） | OK |
| [Splendid Grand Piano](https://github.com/sfzinstruments/SplendidGrandPiano) | 发布方称是 AKAI 于 2000 年起进入公共领域的采样 | 256 MB 版 | OK（发布方声称） |
| [Salamander Grand Piano](https://github.com/sfzinstruments/SalamanderGrandPiano) | CC BY 3.0（Alexander Holm） | v3 | OK |
| [GM 打击乐键位表（CMU）](https://www.cs.cmu.edu/~music/cmp/archives/cmsip/readings/GMSpecs_PercMap.htm) | 键位 35–81 | — | 仅搜索（常见参考，正文未抓取）；[midi.org GM1](https://midi.org/general-midi-level-1) 只有落地页 |

## 3. 符号音乐模型与工具

| 来源 | 主张 | 版本 / 日期 | 状态 |
|---|---|---|---|
| [AMT 论文 arXiv 2306.08620](https://arxiv.org/abs/2306.08620) | TMLR；人评称伴奏音乐性与人类作品相近 | v1 2023-06-14；v2 2024-07-25 | OK |
| [anticipation 仓库](https://github.com/jthickstun/anticipation)；[提交列表 API](https://api.github.com/repos/jthickstun/anticipation/commits?per_page=8)；[PR #8](https://github.com/jthickstun/anticipation/pull/8) | Apache-2.0；最新提交 `af37397`（2024-03-18）；PR #8 修正了 clip 的单位 | — | OK（commits 网页被 robots 拒绝，改用 API） |
| [stanford-crfm 模型列表 API](https://huggingface.co/api/models?author=stanford-crfm&search=music)；[small](https://huggingface.co/stanford-crfm/music-small-800k)；[medium](https://huggingface.co/stanford-crfm/music-medium-800k) | 128M / 360M（large 为 780M，据 MIREX 论文）；Apache-2.0；训练数据 Lakh；small 为 512,433,185 bytes | large 修改于 2024-03-13 | OK |
| [MIREX 2025 Symbolic Music Generation](https://music-ir.org/mirex/wiki/2025:Symbolic_Music_Generation)；[arXiv 2509.12267](https://arxiv.org/html/2509.12267) | 钢琴续写任务；4 个系统的盲听分数（14 人） | 2025 | OK |
| [MIDI-GPT 仓库](https://github.com/Metacreation-Lab/MIDI-GPT)；[README（raw）](https://raw.githubusercontent.com/Metacreation-Lab/MIDI-GPT/main/README.md)；[docs/models.md](https://raw.githubusercontent.com/Metacreation-Lab/MIDI-GPT/main/docs/models.md)；[HF 卡](https://huggingface.co/Metacreation/MIDI-GPT)；[HF API](https://huggingface.co/api/models/Metacreation/MIDI-GPT?blobs=true)；[arXiv 2501.17011](https://arxiv.org/abs/2501.17011) | 代码 MIT；权重 CC-BY-NC-4.0；训练数据 GigaMIDI；`TrackPrompt`；有 macOS arm64 wheel；prism 有 18 个 genre 组 | HF 创建于 2026-06-01，修改于 2026-07-28 | OK；**docs 与 HF 的检查点步数冲突** |
| [Composer's Assistant 2（arXiv 2407.14700）](https://arxiv.org/html/2407.14700v1)；[仓库](https://github.com/m-malandro/composers-assistant-REAPER)；[releases](https://github.com/m-malandro/composers-assistant-REAPER/releases) | MIT；只用公共领域和宽松许可数据训练；track-measure 补全；28 人听测 | v2.1.0（2024-10-09）；仓库最后推送 2025-06-16 | OK |
| [MIDI-RWKV 仓库](https://github.com/christianazinn/MIDI-RWKV)；[arXiv 2506.13001 v2](https://arxiv.org/html/2506.13001v2) | MIT；约 35M 参数；训练数据 GigaMIDI；用 POP909 做 state tuning | v1 2025-06-16；v2 2026-01-26 | OK |
| [Aria 仓库](https://github.com/EleutherAI/aria)；[aria-medium-base](https://huggingface.co/loubb/aria-medium-base)；[HF API](https://huggingface.co/api/models/loubb/aria-medium-base?blobs=true) | Apache-2.0；0.7B；有 MLX 后端；存在记忆风险 | 修改于 2026-04-13；2.63 GB | OK |
| [music2music 代码](https://github.com/Sonata165/music2music_code)；[arXiv 2408.15176](https://arxiv.org/abs/2408.15176)；[m2m_arranger API](https://huggingface.co/api/models/LongshenOu/m2m_arranger?blobs=true) | NeurIPS 2025；权重约 175 MB；**没有许可** | v5 2025-11-05 | OK |
| [GETMusic README（raw）](https://raw.githubusercontent.com/microsoft/muzic/main/getmusic/README.md)；[issue #203](https://github.com/microsoft/muzic/issues/203) | 用爬取的流行音乐训练；权重链接失效，issue 未关闭 | issue 开于 2024-09-23 | OK（tree 网页被 robots 拒绝） |
| [AccoMontage2](https://github.com/billyblu2000/AccoMontage2)；[Structured Arrangement](https://github.com/zhaojw1998/Structured-Arrangement-Code)；[arXiv 2310.16334](https://arxiv.org/abs/2310.16334v1) | 代码 MIT；限 4/4；需要乐句标注；Structured Arrangement 需要 GPU | Structured Arrangement 更新于 2024-10-28 | OK |
| [MIDI-LLM 仓库](https://github.com/slSeanWU/MIDI-LLM)；[HF](https://huggingface.co/slseanwu/MIDI-LLM_Llama-3.2-1B) | Llama 3.2 1B 加 AMT 词表；Llama 3.2 Community License | 论文 2025-11；GitHub 描述写 ISMIR '26 | OK |
| [Text2midi](https://huggingface.co/amaai-lab/text2midi) | Apache-2.0；训练数据 MidiCaps；支持 MPS 和 CPU | 2024-12 | OK |
| [SkyTNT midi-model](https://huggingface.co/skytnt/midi-model) | Apache-2.0；约 0.2B；训练数据 LAMD | — | OK |
| [MuPT 1.97B](https://huggingface.co/m-a-p/MuPT-v1-8192-1.97B) | Apache-2.0；ABC 记谱 | 2024-09-01 | OK |
| [NotaGen](https://github.com/ElectricAlexis/NotaGen) | MIT；古典 ABC | 2025-02 | OK |
| [MusicLang v2](https://huggingface.co/musiclang/musiclang-v2) | GPL-3.0，商用需联系；支持和弦条件 | — | OK（GitHub API 返回 403） |
| [Moonbeam](https://github.com/guozixunnicolas/moonbeam-midi-foundation-model) | Apache-2.0；81.6K 小时 | arXiv 2505.15559 | OK |
| [YuE README（raw）](https://raw.githubusercontent.com/multimodal-art-projection/YuE/main/README.md)；[releases](https://github.com/multimodal-art-projection/YuE/releases) | YuE2；代码 Apache-2.0；权重 CC BY-NC 4.0 | WildSongBench 日期 2026-09-12 | **冲突**：GitHub 首页抓取仍是旧版 YuE；releases 页显示没有 release；raw README 为 YuE2 |
| [MuScriptor](https://github.com/muscriptor/muscriptor) | 多乐器转录；代码 MIT，权重 CC BY-NC 4.0；不保留力度 | arXiv 2607.08168（2026） | OK |
| [Basic Pitch](https://github.com/spotify/basic-pitch) | Apache-2.0；单乐器效果最好 | — | OK |
| [MidiTok](https://github.com/Natooz/MidiTok)；[Symusic](https://github.com/Yikai-Liao/symusic) | 都是 MIT；提供多种 tokenization；支持 tick/quarter/second；有 macOS arm64 wheel | Symusic 0.6.0 仍在开发中 | OK |
| [ABC-Eval arXiv 2509.23350](https://arxiv.org/abs/2509.23350) | LLM 在符号音乐理解和指令遵循上有明显局限 | 2025-09-27 | OK |
| [CoComposer arXiv 2509.00132](https://arxiv.org/abs/2509.00132) | 多代理 LLM 系统的音质不如 MusicLM，但可编辑性更好 | 2025 | OK |
| [Midra](https://github.com/XIAODUOLU/Midra) | Apache-2.0；prompt → 计划 → 音符 → MIDI | — | OK |

## 4. Jev、MCP、DAW 接口

| 来源 | 主张 | 版本 / 日期 | 状态 |
|---|---|---|---|
| [TypeSafe 发布博客](https://typesafe.ai/blog/introducing-system-one-models-and-jev) | 2026-09-15 发布；延迟 70–500 ms（美国西海岸测量）；$0.042/M | 2026-09-15 | OK |
| [docs llms.txt](https://docs.typesafe.ai/llms.txt)；[models](https://docs.typesafe.ai/models.md)；[api](https://docs.typesafe.ai/api.md)；[choice](https://docs.typesafe.ai/primitives/choice.md)；[score](https://docs.typesafe.ai/primitives/score.md)；[noul](https://docs.typesafe.ai/primitives/noul.md)；[confidence](https://docs.typesafe.ai/confidence.md)；[jaggedness 1.13](https://docs.typesafe.ai/model-jaggedness/jev-1.13.md)；[legal](https://docs.typesafe.ai/legal.md)；[coding agents](https://docs.typesafe.ai/introduction/coding-agents.md)；[rerank cookbook](https://docs.typesafe.ai/cookbooks/rerank_typesafe.md) | `jev-1.13.0`；仅文本；64k / 32k；三种原语的语义；官方限制；不用客户数据微调 | 抓取当日 | OK |
| [OpenRouter Jev 指南](https://openrouter.ai/docs/guides/community/jev) | `typesafe/jev-1.13`；上下文 32k | — | OK；**与 TypeSafe 文档的 64k 冲突** |
| [LiteLLM 透传](https://docs.litellm.ai/docs/pass_through/typesafe) | 提供 pass-through 接入 | — | OK |
| [MarkTechPost 报道](https://www.marktechpost.com/2026/09/19/typesafe-ai-releases-jev/) | 用于发现（写的发布日期是 09-19，与官方的 09-15 不同） | 2026-09-19 | OK（二手） |
| [scienthoon/jev-ood-calibration](https://github.com/scienthoon/jev-ood-calibration) | 独立校准测试：ECE、温度拟合 | 2026-09-19 | OK（社区，可复现） |
| [DEV：8 天独立测试](https://dev.to/aws-builders/jev-after-eight-days-of-independent-tests-level-with-mid-price-llms-behind-the-frontier-1c60) | 换选项名 32.5% 翻转；非英语准确率下降 | 2026-09-24 | OK（社区） |
| [arXiv 2609.26758](https://arxiv.org/abs/2609.26758) | “Type-Safe Is Not Error-Free…” | v1 / v2（2026-09） | **受阻（429）**，仅搜索确认存在 |
| [MCP 规范（latest）](https://modelcontextprotocol.io/specification/latest)；[2026-07-28 RC 博客](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/) | 当前最新版本为 2026-07-28；stateless 请求；Tasks 扩展 | RC 于 2026-05-21 | OK |
| [REAPER ReaScript API](https://www.reaper.fm/sdk/reascript/reascripthelp.html) | `MIDI_InsertNote` / `GetNote`、撤销块、TimeMap | — | OK |
| [Ableton LOM Clip](https://docs.cycling74.com/apiref/lom/clip/) | `add_new_notes` 等接口（Live 11.0+） | — | OK |
| [ahujasid/ableton-mcp README（raw）](https://raw.githubusercontent.com/ahujasid/ableton-mcp/main/README.md) | 第三方；遥测默认开启；Python 3.8+ | — | OK |
| [koltyj/logic-pro-mcp](https://github.com/koltyj/logic-pro-mcp) | 明确写 “Logic Pro does not expose a programmatic API” | — | OK |
| [MongLong0214/logic-pro-mcp](https://github.com/MongLong0214/logic-pro-mcp)；[releases](https://github.com/MongLong0214/logic-pro-mcp/releases) | 先生成 SMF 再自动化导入；MIDI 读回推迟；返回三态结果 | **冲突**：v3.13.0 的日期先后显示为 2026-07-22 和 2025-07-22；现有报告写的是 v3.17.0（2026-09-25） | 冲突 |

## 5. 数据集

| 来源 | 主张 | 版本 / 日期 | 状态 |
|---|---|---|---|
| [POP909](https://github.com/music-x-lab/POP909-Dataset) | 仓库 MIT；三条轨；节拍、和弦、调 | ISMIR 2020 | OK |
| [Pop1K7（Zenodo）](https://zenodo.org/records/13143907) | CC BY 4.0；1,747 段；约 108 h | v1，2024-07-31 | OK |
| [Lakh MIDI](https://colinraffel.com/projects/lmd/) | 176,581 / 45,129 个文件；CC-BY 4.0 | — | OK |
| [MetaMIDI（Zenodo）](https://zenodo.org/records/5142664) | 436,631 个文件；限制访问及其条件 | v1.0.1，2021-07-28 | OK |
| [GigaMIDI](https://huggingface.co/datasets/Metacreation/GigaMIDI) | v2.0.0；2,136,218 个文件；CC BY-NC 4.0；gated | — | OK |
| [Slakh2100（Zenodo）](https://zenodo.org/records/4599666) | 2,100 首；145 h；CC BY 4.0；redux 版去掉了重复 | 2019-10-20 | OK |
| [MAESTRO](https://magenta.tensorflow.org/datasets/maestro) | v3.0.0；198.7 h；CC BY-NC-SA 4.0 | — | OK |
| [Aria-MIDI](https://huggingface.co/datasets/loubb/aria-midi) | 1,186,253 个文件；CC-BY-NC-SA 4.0 | — | OK |
| [MidiCaps](https://huggingface.co/datasets/amaai-lab/MidiCaps) | 约 168k 个文件；CC BY-SA 4.0 | — | OK |
| [PDMX](https://github.com/pnlong/PDMX/) | 25 万以上；12.29% 存在许可冲突 | Zenodo 15571083 | OK |
| [Chordonomicon](https://huggingface.co/datasets/ailsntua/Chordonomicon/blob/main/README.md) | 666k 首；CC BY-NC 4.0 | arXiv 2410.22046 | OK |
| [lmd_chords](https://huggingface.co/datasets/ohollo/lmd_chords/blob/main/README.md) | 31,032 条；用 Chordino 提取；CC BY-SA 4.0 | 2025 | OK |

## 6. 方法说明与访问问题

- 云端工作区的 `curl` 访问 `support.apple.com` 和 `registry.npmjs.org` 时，被组织的出站策略拒绝（403）。这些内容改用网页抓取工具读取，没有绕过限制。
- 部分 GitHub 网页被 robots 拒绝或返回过时的缓存。关键事实优先采用 raw README、Hugging Face API 和 GitHub API；它们之间有冲突时，在上表中标为“冲突”。
- GitHub API 对部分仓库返回 403（频率限制），相关的推送日期没有写进报告。

## 7. 尚未解决的问题

1. **本机硬件**：Mac 的芯片和内存；各模型在 MPS 或 MLX 上的实测速度。可用 `system_profiler SPHardwareDataType` 记录。
2. **Jev**：上下文上限（64k 还是 32k）；中文音乐请求的准确率；你的账户能否获得 early access；arXiv 2609.26758 正文的具体结论。
3. **MIDI-GPT**：参数量；同 instrument 双轨的 round-trip；`ignore=True` 的语义；docs 与 HF 检查点步数哪一方正确。
4. **CA2 / AccoMontage2 / Structured Arrangement**：权重或检查点的许可文本；CA2 脱离 REAPER 的成本。
5. **音色资源**：GeneralUser GS 和 MuseScore_General SF3 的准确文件大小；FluidR3 的 MIT 与 gleitz 渲染版 CC BY 3.0 的表述冲突。
6. **YuE2 的发布形态**，以及“个人创作者补充条款”；MongLong logic-pro-mcp 的真实最新版本。这两项都不影响主线决策。
7. **研究伦理**：学校对参与者研究的具体要求，需要与导师确认。
