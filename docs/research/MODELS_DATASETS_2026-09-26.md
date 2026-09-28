# FLUX 音乐模型、表示与数据集调研

调研日期：2026-09-26。范围：能帮助用户在简易 DAW 中输入旋律、生成可编辑 MIDI 伴奏／变奏、试听并保留控制权的技术。

这是联网文献与公开实现核验，加上本地代码检查；没有下载新权重、训练新模型，也没有完成候选模型试听。下文的优先级是选型建议，不是已经测得的质量排名。“官方支持 MPS／MLX”与“在本机达到交互速度”分开记录。

**复评后顺序：先以和弦轨＋角色 pattern 的 R0 跑通生成闭环，保留 AMT 基线，MIDI-GPT 为首个新增多轨模型候选；Aria 钢琴续写独立比较。** CA2、AccoMontage2 补入可选候选池。模型尚无本机质量胜负；最新采纳条件、证据纠正和实验顺序见 [调研复评](RESEARCH_REVIEW_2026-09-26.md)，本文提供选型背景。网页乐器目录可以覆盖 GM，不能因此声称每个模型都能可靠生成全部 GM 乐器。

## 1. 先纠正当前项目的三个事实

1. **Essen 没有训练过当前模型。** [research/dataset.py](../../research/dataset.py) 只是加载单声部民歌曲目，作为输入旋律池；[research/generate.py](../../research/generate.py) 直接加载外部预训练检查点。用户听到的混乱输出不能归因于“用 Essen 训练坏了”。Essen 对现代流行乐目标风格的代表性不足，应该降为边界测试材料。
2. **AMT 已经接受过大规模预训练。** 当前 small 检查点为 128M 参数、在 Lakh 上训练 800k steps；FLUX 尚未做的是自己的风格适配和系统质量验证。增加训练量能否改善当前输出，要由对照实验判断。[官方模型卡](https://huggingface.co/stanford-crfm/music-small-800k)
3. **完整 pipeline 只表示输入、生成、导出和测量能够串起来。** 它不证明生成结果可用于作品。`core/` 的六种变换是精确的编辑工具，可以作为用户显式动作或可控基线；它们不是模型训练的前置条件，也不应为了保留旧研究设计而强迫用户使用。

当前本地代码中还发现这些明确限制：

| 检查点 | 当前证据 | 对下一步的影响 |
|---|---|---|
| 生成窗口末尾 | `melody_to_controls()` 用 `ops.max_time()` 作为终点；当前安装的 `anticipation/ops.py` 中该函数只取最大音符 onset，不加 duration | 最后一音的持续部分不在请求窗口内；应改为明确的选区／小节边界，并保留音尾策略。影响大小尚未实测 |
| 输入要求 | 只提取 program 0，随后断言没有剩余事件 | 多音源输入尚不支持，需要明确条件轨和目标轨 |
| 轨道身份 | AMT note token 编码 instrument 与 pitch；同 program 不是独立 track ID | 项目层必须保存原轨、候选轨、来源标记；模型返回后不能只按 program 分离 |
| 乐器限制 | 当前只禁止不在允许集合内的乐器，没有规定每条目标轨必须产生内容 | “只允许贝斯”也可能输出空、太少、节奏不合适 |
| 对照条件 | `ab_test.py` 同时改变模型尺寸、乐器限制和 `top_p`；没有固定种子 | 旧四组结果不能分离因果，不是正式质量比较 |
| 输出测量 | `pipeline.py` 先把原旋律加回，再对混合文件计算指标 | 不能把混合音符数当生成量，也不能由混合指标判断伴奏质量 |
| 规则指标 | `metrics.py` 将小节长度固定为四拍；没有参考指定调性／和弦的专门检查 | 新拍号界面需要同步修订评价，不应仅修改前端数字 |

以上来自 [pipeline.py](../../research/pipeline.py)、[ab_test.py](../../research/ab_test.py)、[metrics.py](../../research/metrics.py) 及当前安装依赖的函数实现。报告没有擅自改变这些生成逻辑。

## 2. 候选模型的优先级与能力边界

表中的“待核验”表示现有证据不足，不能解释成“不支持”。“可下载”指公开文件列表／官方链接存在，本次没有实际下载和校验大型权重。

| 候选 | 最合适的任务 | 对 FLUX 的位置 | 主要障碍 |
|---|---|---|---|
| R0（待实现） | 确认和弦下的贝斯／鼓／铺底 | **首个生成闭环与强制基线** | 原创 pattern 的质量、变化和可用性须试听验收 |
| AMT | 已有事件条件下的续写、补全、伴奏 | 保留基线，先修正实验和接口 | 节拍／轨道语义需应用层补足；现有 pilot 不能归因为模型能力差 |
| MIDI-GPT | 按轨、按小节生成和补全 | **首个新增多轨模型候选** | 权重非商业许可；部分新检查点仍训练中 |
| Composer's Assistant 2 | track-measure 补全 | 可选对照 | 脱离 REAPER 的适配成本；下载包权重条款尚未核验 |
| AccoMontage2 | 旋律到和弦／钢琴伴奏织体 | 4/4 钢琴伴奏的可选对照 | 乐句长度／标注约束，检查点条款待核 |
| MIDI-RWKV | 长上下文多轨补全、个性化适配 | 第二轮编曲对照 | 工程路径更偏研究，权重许可需确认范围 |
| music2music／REMI-z | 乐队编曲、钢琴缩编、鼓编配 | 高匹配度研究候选 | 模型卡／许可信息缺口 |
| GETMusic | 旋律／和弦条件下生成指定乐器角色 | 任务匹配的参考系统 | 旧 CUDA 环境、权重下载及许可待核验、固定角色集合 |
| Aria | 表现力钢琴续写、钢琴嵌入 | **钢琴模式独立试验** | 不是通用流行乐多轨伴奏器 |
| MIDI-LLM | 自由文本生成多轨 MIDI | 风格与文本控制探索 | 文本控制不等于保留用户旋律，官方偏 CUDA |
| Text2midi | 描述到多乐器 MIDI | 文本路线对照 | 精确条件保留和逐轨编辑需另外验证 |
| SkyTNT Midi-Model | MIDI 续写、参数化创作 | 轻量实用对照 | 目标轨补全契约与质量证据不充分 |
| MuPT | ABC／乐谱符号生成 | 结构规划研究参考 | 到 DAW 多轨 MIDI 的完整适配成本较高 |
| MusicLang | 和弦条件下的符号生成 | 和声表示参考 | 模型许可和依赖边界需澄清 |
| YuE2 | 可编辑旋律／和弦计划到完整歌曲音频 | 最新跨模态方向观察 | 输出音频与完整逐轨 MIDI 不是同一产品 |

### AMT：基线应保留，但要换掉“允许集合就完成了轨道控制”的假设

2023 年预印本、TMLR 2024 的 AMT 使用 anticipation 表达已知未来音乐事件，可条件生成和 infill；官方代码与当前 small 模型卡均标 Apache-2.0。FLUX 已经能运行它，是排查接口、表示和渲染问题的最低迁移成本基线。[论文](https://arxiv.org/abs/2306.08620)、[代码](https://github.com/jthickstun/anticipation)、[权重](https://huggingface.co/stanford-crfm/music-small-800k)

**判断：**在 AMT 上先测试“整齐的 4／8 小节流行旋律＋指定一种伴奏角色”，比立刻自由生成十多种乐器更有诊断价值。原旋律保留在应用工程里，生成事件单独返回；仅合成导出时按需混合。音色相同也要保留两个 `trackId`。这解决来源和试听控制，不保证新音符不会模仿原旋律。

### MIDI-GPT：当前与简易 DAW 需求最直接匹配

官方当前提供 `TrackPrompt(id, bars)`、小节 infill、密度／复音／时值控制和 HTTP 服务；包列出 macOS arm64 wheels，设备参数包括 MPS。稳定的 yellow 系列支持 4／8 小节；较新的 prism／expressive 扩展控制和上下文，但仍是训练中的检查点。[代码与 API](https://github.com/Metacreation-Lab/MIDI-GPT)、[模型说明](https://github.com/Metacreation-Lab/MIDI-GPT/blob/main/docs/models.md)

**许可要分开：代码 MIT；官方权重 CC-BY-NC-4.0。** 模型卡列 GigaMIDI 为训练集。HF 与 GitHub 文档显示的新检查点步数不一致，而且按名称加载会解析最新检查点，正式实验必须锁定文件和 revision。[权重卡](https://huggingface.co/Metacreation/MIDI-GPT)

**判断：**先测 `yellow_small/medium`，再单独测 prism 的 genre 控制。项目已有轨道可作为上下文，新增候选轨作为目标；验证同音色双轨能否完整 round-trip。官方 MPS 参数不构成本机速度证明。注意 API 的 `ignore=True` 会把轨道从模型上下文排除，不能拿它代表“保留并让模型听见原旋律”。

### MIDI-RWKV：长上下文补全和小规模适配具有研究价值

2025-06 论文提出多轨长上下文 infilling，官方仓库提供基础权重、推理、评估以及 state tuning／LoRA 脚本；预训练使用 GigaMIDI，适配试验涉及 POP909。作者用于论文的已调优权重没有全部发布。[论文](https://arxiv.org/abs/2506.13001)、[代码和复现说明](https://github.com/christianazinn/MIDI-RWKV)

仓库许可证为 MIT，但没有单独完整的权重模型卡，不能顺带宣称训练数据和所有衍生物拥有相同许可。其 `rwkv.cpp` 推理路径值得测试 CPU／本地运行；本次没有测过 Apple 设备吞吐量。[许可证](https://github.com/christianazinn/MIDI-RWKV/blob/main/LICENSE)

**判断：**放在 MIDI-GPT 之后，用于检验“更长上下文／个性化”是否带来实际听感收益。不要把 state tuning 参数量小等同于任意数据上都会成功。

### 复评补充：Composer's Assistant 2 与 AccoMontage2

CA2 将目标表达为轨道与小节的补全。作者 README 声称模型仅用公共领域与宽松许可 MIDI 训练，代码仓库 MIT，但要求读取发布包内的许可和免责声明。本轮没有下载检查发布包，改称“数据来源声明较清晰”，不采用“许可最干净”的定论；适配成本核清后进入可选对照。[官方仓库](https://github.com/m-malandro/composers-assistant-REAPER)

AccoMontage2 面向旋律配和声与钢琴伴奏，支持 4/4、4／8 小节乐句；与本项目钢琴织体任务相关，不能据此覆盖非 4/4 或全部 GM 角色。代码 MIT，检查点使用条件仍待核验；Structured Arrangement 留作后续多轨观察，不扩大首轮必跑集合。[官方仓库](https://github.com/billyblu2000/AccoMontage2)

### music2music／REMI-z：任务很合适，发布材料尚需补齐

NeurIPS 2025 的 track-aware reconstruction 研究明确覆盖 additive arrangement、重新配器和简化。官方仓库列出基础、乐队编曲、钢琴缩编、鼓编配四类权重，并提供教程。[论文](https://openreview.net/pdf?id=FNYFSolinQ)、[官方代码](https://github.com/Sonata165/music2music_code)

本次通过 HF API 确認 `LongshenOu/m2m_arranger` 有 `model.safetensors`，但模型卡仍是模板、license 未填；代码仓库也未找到明确许可声明。REMI-z 工具本身的 MIT 许可不能自动应用于这些模型。[权重卡](https://huggingface.co/LongshenOu/m2m_arranger)、[权重文件元数据](https://huggingface.co/api/models/LongshenOu/m2m_arranger)

**判断：**在取得清晰使用条件后，它比泛化文本作曲模型更值得做旋律到乐队伴奏试验。先核验教程能否执行，再谈替换。

### GETMusic：流行乐、多轨条件生成贴合，但不是全 GM 乐器模型

2023 年研究以扩散和统一多轨表示进行生成／补全。官方说明支持 lead、bass、drums、guitar、piano、strings 角色，推荐和弦引导，并承认输入轨道角色和训练域差异会影响结果；训练用爬取的流行音乐，但数据和完整清洗脚本未开放。[论文](https://arxiv.org/abs/2305.10841)、[官方使用文档](https://microsoft.github.io/muzic/getmusic/)

代码所在 Muzic 仓库为 MIT；本次未验证可用的官方检查点下载，官方 issue 中有未关闭的下载失效报告，故不能列为“已可直接部署”。安装说明使用较旧 CUDA／PyTorch 组合，Mac 兼容性未测。[代码](https://github.com/microsoft/muzic)、[权重下载问题](https://github.com/microsoft/muzic/issues/203)

**判断：**借鉴其“先明确和声与轨道角色，再生成伴奏”的任务设计；不能把固定角色表说成 128 种乐器可分别控制。

### Aria：有真实 Apple MLX 路径，但优先解决钢琴续写

ISMIR 2025 的 Aria 为约 1B 架构，训练重点是表现力钢琴。官方提供 CUDA 与 MLX 实现以及实时钢琴演示，并明确建议钢琴输入；工具可以表达多轨不等于模型擅长多乐器编曲。官方称模型与工具 Apache-2.0。[官方仓库](https://github.com/EleutherAI/aria)、[基础模型卡](https://huggingface.co/loubb/aria-medium-base)

本次基础仓库文件列表可访问且有 `model.safetensors`、`model-gen.safetensors`、`model-demo.safetensors`；README 指向的独立 `aria-medium-gen` endpoint 本次返回 401，不能把它写成已下载验证。[基础权重 API](https://huggingface.co/api/models/loubb/aria-medium-base)

**判断：**用来测试“用户弹 4 小节，系统续写钢琴”很有价值。不能拿优美钢琴续写直接证明其更适合贝斯、鼓、吉他伴奏。`Aria-AMT` 是自动钢琴转录工具，缩写 AMT 在那里是 automatic music transcription，与 FLUX 的 Anticipatory Music Transformer 不同。

### MIDI-LLM：LLM 可以学会 MIDI，但通用聊天模型和音乐专用训练不能混为一谈

当前官方版本基于 Llama 3.2 1B 扩充音乐词表，最终约 1.4B，采用 AMT 的 onset／duration／instrument-pitch 事件。训练涉及 MusicPile、GigaMIDI，以及 Lakh＋MidiCaps；开源推理脚本支持 Transformers 和 vLLM。主入口是文本到 MIDI，完整训练管线只给高层指导。[模型卡](https://huggingface.co/slseanwu/MIDI-LLM_Llama-3.2-1B)、[代码](https://github.com/slSeanWU/MIDI-LLM)

仓库和权重采用 Llama 3.2 Community License；官方建议 CUDA 12.x、16GB 以上显存。本次未验证 MPS。项目当前标 ISMIR 2026，论文编号为 2511.03942，说明初版先于会议，不能只用会议年份判断技术发布时间。[论文](https://arxiv.org/abs/2511.03942)、[许可](https://github.com/slSeanWU/MIDI-LLM/blob/main/LICENSE.md)

**判断：**适合验证文本风格控制；精确保留现有旋律、同 program 双轨身份和补全 API 都需要另做试验。使用 AMT 词表并不意味着能直接替换 FLUX 的 `generate()`。

### Text2midi：已有文本生成实现，可作为独立任务基线

AAAI 2025 的系统使用文本编码器条件化音乐解码器，训练涉及 SymphonyNet 与 MidiCaps；官方给出 MIDI 导出、MPS／CPU／CUDA 路径。代码 MIT，HF 权重卡 Apache-2.0。[官方代码](https://github.com/AMAAI-Lab/Text2midi)、[权重卡](https://huggingface.co/amaai-lab/text2midi)

**判断：**“输入流行乐风格描述，生成候选伴奏素材”可试；它公开的主任务不是“给定用户音符，严格只补目标轨”。不能把文本里的调性／和弦描述当成硬约束，也不能凭其他论文中的听感分数与 AMT 作跨实验排名。本机延迟未测。

### SkyTNT Midi-Model：低成本实用对照

官方有 app、训练和 ONNX 导出；当前 tv2o-medium 模型卡列约 0.2B、LAMD／Monster MIDI／SymphonyNet 数据及 Apache-2.0 权重许可。代码也为 Apache-2.0。[代码](https://github.com/SkyTNT/midi-model)、[权重卡](https://huggingface.co/skytnt/midi-model-tv2o-medium)

官方 app 提供乐器、BPM、拍号等输入，ONNX 路径列 CUDA 与 CPU provider。但选项存在不代表输出严格遵守；逐轨 infill、输入保留以及同音色多轨需要单测。[app 实现](https://github.com/SkyTNT/midi-model/blob/main/app_onnx.py)

**判断：**作为可快速比较的第三方 MIDI 创作基线，优先级高于自建大模型。其社区风格 LoRA 不能直接当作经过数据授权与质量验证的生产资产。

### MuPT：大规模符号预训练参考，ABC 到 DAW 的适配仍需工作

2024 年研究面向符号音乐预训练，公开模型使用 ABC 文本输入／输出；已访问卡标 Apache-2.0。ABC 能表达拍号、速度、和弦和声部，但模型卡中的潜在 downstream accompaniment 不等于现成目标轨补全接口。[论文](https://arxiv.org/abs/2404.06393)、[已核验模型卡](https://huggingface.co/m-a-p/MuPT-v1-8192-1.97B)

该卡的仓库名、参数表和示例 model ID 存在不一致，部分示例 endpoint 本次不可访问；不能照抄 README 就宣称能运行。代码仓库包含另外的第三方许可文本，需要按实际采用文件核验。[代码与许可](https://github.com/multimodal-art-projection/MuPT)

**判断：**暂不优先；除非实验显示乐谱结构规划比事件级生成更适合目标任务。

### MusicLang：值得借鉴和弦表示，模型部署条件要单独核实

官方提供和弦控制、MIDI prompt 与 MIDI 导出，但也说明和弦遵守不是绝对保证。Predict 包 GPL-3.0，基础语言包 BSD-3-Clause，模型产品使用要求联系作者，不能把代码许可当权重许可。[代码](https://github.com/MusicLang/musiclang_predict)、[权重说明](https://huggingface.co/musiclang/musiclang-v2)

其 README 将 Lakh 写为 CC0，与 Lakh 作者官网的 CC-BY 4.0 不一致；本报告采用数据原发布者说明。[Lakh 原站](https://colinraffel.com/projects/lmd/)

**判断：**借鉴“和弦／调式为第一类对象”，暂不作为 FLUX 默认模型。

### YuE2：2026 年 9 月的相关新方向，不能替代 MIDI 能力验收

当前官方发布将旋律与和弦计划显式化，再生成 48kHz 立体声歌曲；接口支持 ABC 计划和 agent editing。官方快速开始要求 Linux、Python 3.12、支持 BF16 的 NVIDIA GPU 与 24GB 显存。这是公开硬件建议，不是本机测试。[官方仓库](https://github.com/multimodal-art-projection/YuE)、[2026-09 发布](https://github.com/multimodal-art-projection/YuE/releases)

代码 Apache-2.0；权重为 CC-BY-NC-4.0 加单独的个人创作者使用补充条款，公司商业用途另议。旧 YuE 的许可不能直接套在 YuE2 上。[模型许可](https://github.com/multimodal-art-projection/YuE/blob/main/MODEL_LICENSE)

**判断：**其“先规划、再实现”的结构值得参考；可编辑主旋律／和弦计划并不保证音频里每个贝斯、鼓、吉他音符都有可编辑 MIDI。作者的音频榜单也不能证明 FLUX 的目标轨补全更好。暂作研究观察，避免把浏览器 MIDI 工具扩成音频大模型项目。

## 3. 表示与工具：值得采用，但不是新的音乐模型

- **MidiTok** 是分词工具：支持 REMI、CPWord、MMM 等表示及训练数据工具，并用 Symusic 读写；更换 tokenizer 不会让现有 AMT 权重自动变聪明，训练好的权重必须使用匹配词表和编码。[官方仓库](https://github.com/Natooz/MidiTok)
- **Symusic** 是符号音乐处理层，可用于 MIDI 读写和变换；它与 muspy 的研究指标层可以共存。是否迁移应以保留拍号、速度、轨道和事件的 round-trip 测试决定，而不是再造一套数据结构。[官方仓库](https://github.com/Yikai-Liao/symusic)
- **REMI-z** 为小节／轨道结构提供操作工具。当前文档明确：MIDI 读写支持同 program 的多轨，但从 REMI-z sequence 创建 `MultiTrack` 仍有同 program 多轨限制。这与用户的“双钢琴轨”设想直接相关，应作为候选适配测试。[官方限制与更新](https://github.com/Sonata165/REMI-z)

建议 FLUX 的项目对象保持独立：`Project(tempo, timeSignature) → Track(id, instrument, mute, solo) → Clip → Note`。模型适配器负责转换，不能以某个模型的 program 编码替代项目 `trackId`。拍为编辑基准；播放和绝对秒模型经过统一 tempo map 换算。未知的 CC、踏板、弯音、速度变化不能默默丢弃，应明确首版支持范围。

## 4. 训练／评估数据：流行乐方向需要按任务选，不是只按规模选

下表记录发布者给出的许可与访问条件，不将其扩写成对曲作者、编曲、演奏和录音全部权利的保证。尤其是网页抓取语料，仓库软件许可证不能证明收集者有权授权所有底层曲目。研究、部署权重、分发 MIDI、商业产品是不同用途，需要分别记录来源和条件。

| 数据 | 类型与适合任务 | 访问／许可核验 | 对 FLUX 的建议 |
|---|---|---|---|
| **POP909** | 909 首流行歌曲的钢琴编配，MELODY／BRIDGE／PIANO 三角色，附节拍、和弦、调性信息；不是鼓贝斯吉他的原始乐队分轨 | 官方仓库可下载、仓库为 MIT；该软件条款不能据此证明所有歌曲作曲权已获商业授权。论文 CC-BY 也不等于数据版权 | 优先用于流行旋律→钢琴伴奏的小规模质量诊断、role 条件任务。[仓库](https://github.com/music-x-lab/POP909-Dataset)、[论文](https://arxiv.org/abs/2008.07142) |
| **Ailabs.tw Pop1K7** | 1,747 段转录流行钢琴，约 108h，均 4/4；不是通用多轨乐队 | 复评核验 Zenodo 元数据为 CC BY 4.0，2024-07-31；不等于底层作品全部权利已核实 | 钢琴风格候选，核查转录与去重质量，不能覆盖非 4/4 评估。[数据页](https://zenodo.org/records/13143907) |
| **Lakh MIDI** | 176,581 个唯一 MIDI；含多种风格和编配，45,129 匹配 Million Song Dataset | 原站 CC-BY 4.0；承认网页收集、作者归属不全、存在损坏文件 | 做清洗后的流行乐／乐队子集；AMT 已见过相关域，评估需注意污染。[作者原站](https://colinraffel.com/projects/lmd/) |
| **MetaMIDI** | 436,631 个 MIDI，部分带曲名、作者和 genre metadata，利于筛选流派 | 2021-07-28 v1.0.1 Zenodo 页面显示 Restricted；本次未取得数据许可完整条件 | 用于发现与元数据研究，不能写成已可自由下载训练。[作者数据页](https://zenodo.org/records/5142664) |
| **GigaMIDI v2** | 官方卡称 210 万以上 unique MIDI、覆盖 GM，合并包括 Lakh／MetaMIDI 的多个来源，有 loop 与风格元数据 | 登录并接受条件；CC-BY-NC-4.0；非商业研究／教育 | 最有希望的多轨流行乐筛选池之一；不是现成纯流行乐精品库，且不能与 Lakh 简单拼接后当额外独立数据。[官方卡](https://huggingface.co/datasets/Metacreation/GigaMIDI) |
| **Slakh2100** | 2,100 首由 Lakh MIDI 渲染的多轨音频＋对齐 MIDI；筛选含钢琴、贝斯、吉他、鼓 | CC-BY 4.0；原站提示有重复 MIDI 问题 | 优先做多轨播放、渲染、轨道屏蔽与条件补全诊断。它提供更好的音源渲染，不代表新增真人流行乐编曲。[官方页](https://www.slakh.com/) |
| **MAESTRO v3** | 约 199 小时精确 MIDI／音频钢琴演奏，主要古典；保留力度与踏板 | CC-BY-NC-SA 4.0，可只下载 MIDI | 用于钢琴表现和转录，不适合作为流行乐乐队主训练集。[官方页](https://magenta.tensorflow.org/datasets/maestro) |
| **Aria-MIDI** | 118 万余转录钢琴片段，约 10 万小时；提供 pruned／deduped／unique 子集 | CC-BY-NC-SA 4.0，另有 disclaimer；元数据和自动转录可能有误 | 钢琴风格与续写资源；不是多轨流行乐。文件数不能当独立作品数。[官方卡](https://huggingface.co/datasets/loubb/aria-midi) |
| **MidiCaps** | 约 168k Lakh MIDI 的描述和音乐属性，包含 genre、mood、chord 等 | 说明数据 CC-BY-SA 4.0；关联 MIDI 仍需追溯原来源 | 用于文本风格检索／条件，标签不是逐曲人工核验的真值。[官方卡](https://huggingface.co/datasets/amaai-lab/MidiCaps) |
| **PDMX** | MusicXML／乐谱数据，包含可用 MIDI 转换；作品类型需筛选 | 官方后来标记网页与文件内部许可冲突，建议 `no_license_conflict` 子集 | 当作更清晰来源筛选的候选；不能因名称包含 Public Domain 就忽略冲突字段，也不能默认它是当代流行乐。[官方项目](https://github.com/pnlong/PDMX) |

**建议组合：**用户自己拥有权利的流行乐 MIDI／原创素材作为最贴近目标的核心测试集；POP909 负责钢琴伴奏；Slakh 的 MIDI 负责多轨功能与编配实验；GigaMIDI／Lakh 的人工抽查子集负责较大规模风格适配。Essen 留少量曲目测跨域稳定性即可。

数据准备必须先做：按作品／作者／近似旋律去重；先分训练验证测试再切小节；保留 genre 来源和置信度；检查拍号／速度、轨道角色、音符重叠、异常时值、稀疏片段和鼓 program。不能把同一首歌的不同 MIDI、移调版、演奏版或不同小节分散到训练和测试后宣称泛化。

## 5. “杂乱无章”应该怎样定位

目前能确认的是用户试听不满意，以及现有少量试验缺少控制变量。以下是**待验证原因**，不能先认定是哪一个：

| 假设 | 最小诊断 | 如果成立，优先动作 |
|---|---|---|
| 音源和配器让正确音符听起来混乱 | 同一 MIDI 用统一高质量钢琴音色、再用固定 GM 音源分别渲染；固定音量 | 先修渲染、轨道音量和乐器映射 |
| 输入时间／小节边界错误 | 生成前后打印拍／秒／ticks 与末音 offset，做确定性 MIDI round-trip | 修转换和选择范围 |
| 条件太弱 | 比较旋律、旋律＋明确和弦、旋律＋伴奏前缀 | 增加和声和上下文条件 |
| 角色不明确／同时生成过多乐器 | 只生成 bass，再仅 drums，再加 chordal accompaniment | 先按角色生成，最后测试联合生成 |
| 采样过散 | 固定输入、种子和窗口，只改变温度／top-p 中一个变量 | 找稳定采样区间，保留失败率 |
| 乐器硬限制导致分布异常或稀疏 | 相同条件比较自由生成、单角色约束、模型原生目标轨接口 | 优先使用原生条件模型／明确空结果反馈 |
| 数据域与流行乐任务不符 | 同一系统比较用户流行乐、POP909、古典／民歌输入 | 筛选风格数据或适配，而不是盲目增加总数据 |
| 模型缺少短句结构能力 | 检查 4／8 小节重复、变化、终止、和弦转折 | 尝试结构／和弦规划、候选重排或新模型 |

不能把“符合调性”定义为全部音符必须落自然音阶：流行乐允许借用和弦、经过音、蓝调音。调性硬掩码应是用户选择的严格模式，默认质量评价应结合时值、重拍、和弦和声部作用。

## 6. 两阶段短期比较方案

本节保留比较框架；实际执行以 [复评 §3](RESEARCH_REVIEW_2026-09-26.md#3-实验计划的执行修订) 为准：R0 为必需对照，先完成 E0，再做分离变量的 E1 小诊断，按作品隔离统计，之后才扩到 E2。原始输出和重试分别记录；和弦条件加入请求并核验实际使用。

### 阶段 A：验证可用性和故障来源，不训练

先准备 6 段 4 小节原创／可使用的流行乐材料：抒情钢琴、常见和弦流行、切分 R&B、流行摇滚、舞曲、一个 6/8 例子。各附明确的速度、拍号、旋律、和弦及目标角色。

1. 修正 AMT 时间窗口和输出来源记录，以当前模型做基线。
2. MIDI-GPT yellow_small 与 yellow_medium 跑相同 4／8 小节任务，记录本机冷加载、热请求、总耗时、峰值内存、失败／空结果率。每个条件 3 个种子，不挑最好的一次。
3. 钢琴续写单独比较 AMT 与 Aria MLX，不把续写胜出直接算作伴奏胜出。
4. 在明确可用性和许可后，从 MIDI-RWKV、music2music、GETMusic 中选一个任务匹配对照；资源有限时可先用 SkyTNT 实用基线。

完成标准：所有原始音符和轨道可复原；同音色双轨不会混成一轨；候选只落目标选区；导出后 tempo／meter 仍对；有可听到的有效生成，而不是靠空列表满足限制。

### 阶段 B：有意义的质量比较，再决定训练

扩成约 20 段、每条件 3–5 种子。分开评分：和声合适度、节奏稳定性、动机延续、声部可演奏性、配器关系、重复与变化、用户需要编辑的程度。使用统一音源、响度策略和播放长度，隐藏模型名，随机播放顺序，保留全部结果。作者自评可以作为工程诊断；未经相应程序的主观评价不能包装成正式用户研究。

自动指标分三层：

- **正确性：**原轨改动率、非法音符、越界、轨道／乐器错误、空输出、请求失败。
- **音乐描述：**按轨音域／密度／复音／时值分布、节奏位置、重复片段和持续静默；多种拍号使用正确的小节定义。
- **任务质量：**相对和弦的重拍适配、与输入动机关系、盲听选择率、编辑成本；不能把 pitch entropy 最大化当作好听。

若稳定预训练候选已能产生可用结果，先不训练。如果有明确而重复的风格缺口，再用筛选过的流行乐子集做 LoRA／state tuning 小实验，比较“基础模型／仅采样调整／仅候选重排／风格适配”；评价集必须按作品隔离。允许早停：验证听感和失败率未改善时，增加 epochs 不是默认答案。

## 7. 证据时效、未解决事项与复现要求

所有外链本次查阅日期均为 2026-09-26。官网、仓库、论文、模型卡优先；搜索摘要只用于发现，没有以论坛传言确认模型能力。报告未把任何作者自报 benchmark 转述成 FLUX 实测优越性。

仍需补证：GETMusic 官方可下载权重及使用条件；music2music 代码／权重许可；RWKV、CA2、AccoMontage2 权重的明确许可范围；MetaMIDI 访问条件；Aria 独立 gen 仓库的可访问性；MuPT 当前正确模型 ID。Pop1K7 发布元数据许可已补证，底层作品权利仍按用途核验。官方文档之间也会不同步，不能把“现在网页这样写”当稳定版本保证。

正式比较每条产物应记录：输入／选区／原轨 hash、模型 repository＋revision、权重 hash、tokenizer 版本、提示词／结构条件、种子、采样参数、设备与 dtype、分阶段耗时、生成 MIDI、混合试听、约束检查、主观评分。特别是 MIDI-GPT 的按名称最新加载，必须固定具体文件，否则隔周重跑已经不是同一个模型。

本报告没有足够证据宣布某个模型全面超过 AMT；已足够支持的决策是：**停止把 AMT 视为唯一前提，按 FLUX 的实际操作任务做小规模、多候选、公平对照，再选择模型与训练路线。**
