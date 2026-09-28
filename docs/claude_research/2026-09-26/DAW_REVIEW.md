# FLUX 网页 DAW：交互与音源审查（2026-09-26）

> 本文件在读过 `docs/DAW_SPEC_2026-09-26.md` 之后写成。现有规格的大部分设计我同意（逐条见 §12）。这里只给出**可执行规格**和**改进点**，不重复叙述相同内容。所有外部事实都在 2026-09-26 核验，来源见 [SOURCES.md](SOURCES.md)。

## 0. 分阶段范围

| 阶段 | 目标 | 包含 | 明确不做 |
|---|---|---|---|
| **A 首轮可听工作台** | 能弹、能录、能听、能改、能存 | tick 项目模型；SpessaSynth + 完整 GM；Musical Typing；运输控制、节拍器、倒数、循环；多轨 M/S/R；钢琴卷帘编辑；项目 JSON；MIDI 导入导出；测试用生成器（确定性，用来验收候选轨流程） | 真实模型；外接 MIDI；弯音和调制录制 |
| **B 生成集成** | 在同一界面上比较真实生成器 | 和弦轨；角色优先的生成面板；R0 规则编曲器；异步生成任务、取消、迟到响应处理；候选对比和盲听模式；core 变换菜单 | 插件宿主；混音台；自动化曲线 |
| **C 以后** | 扩展 | Web MIDI 外接键盘；CC64 录制；弯音和调制；多片段编排；变速图；候选历史；音频导出 | 账号；云协作；移动端完整编曲；音频录音 |

## 1. 电脑键盘：Logic Musical Typing 映射与浏览器调整

### 1.1 能从 Apple 文字中核验到的内容

- **Logic Pro 用户指南**（[Play software instruments](https://support.apple.com/guide/logicpro/play-software-instruments-lgcpb19cbd34/mac)）：`Window > Show Musical Typing` 或 **Command-K** 打开窗口；**Z / X** 按八度降 / 升；**C / V** 降 / 升力度；**1 / 2** 弯音下 / 上，按住期间持续弯音；**3** 关闭调制，**4–8** 设定调制值；**Tab** 开关延音（“similar to using a sustain pedal”）；录音时用 Musical Typing 弹奏即可录入。
- **GarageBand '09 用户手册**（Apple 手册，[镜像页](https://www.manualsdir.com/manuals/547630/apple-garageband-09.html?page=60)）：中排按键弹“白键”，范围一个半八度，从 C 到 F；**W E T Y U O P** 弹“黑键”。
- Apple 当前页面的完整键位只出现在图片里，文字没有给出。本轮没有抓取那张图片，所以下表的顺序依据是上面两段文字，以及现有 DAW_SPEC 已核对过的官方截图。

### 1.2 映射表（用 `KeyboardEvent.code`，与键盘布局无关）

| `code` | 键 | 相对半音 | 默认 MIDI（A=60） | 音名（FLUX 显示 C4=60） |
|---|---|---:|---:|---|
| KeyA | A | 0 | 60 | C4 |
| KeyW | W | 1 | 61 | C#4 |
| KeyS | S | 2 | 62 | D4 |
| KeyE | E | 3 | 63 | D#4 |
| KeyD | D | 4 | 64 | E4 |
| KeyF | F | 5 | 65 | F4 |
| KeyT | T | 6 | 66 | F#4 |
| KeyG | G | 7 | 67 | G4 |
| KeyY | Y | 8 | 68 | G#4 |
| KeyH | H | 9 | 69 | A4 |
| KeyU | U | 10 | 70 | A#4 |
| KeyJ | J | 11 | 71 | B4 |
| KeyK | K | 12 | 72 | C5 |
| KeyO | O | 13 | 73 | C#5 |
| KeyL | L | 14 | 74 | D5 |
| KeyP | P | 15 | 75 | D#5 |
| Semicolon | ; | 16 | 76 | E5 |
| Quote | ' | 17 | 77 | F5 |

Logic 以 C3 表示 MIDI 60。界面应同时显示 “C4 · MIDI 60”，以免八度编号不同造成误会。

### 1.3 哪些照搬，哪些调整

| 功能 | Logic | FLUX 首轮 | 原因 |
|---|---|---|---|
| 音符键 | 同上 | **照搬** | 与肌肉记忆一致 |
| Z / X 八度 | 照搬 | **照搬**；限制在所有键都落在 0–127 的范围内 | — |
| C / V 力度 | 照搬（官方文字未给步长） | **照搬**；默认 100，每次 ±10，范围 1–127，屏幕上显示当前值 | 步长是 FLUX 自己的选择 |
| Tab 延音（开关） | 照搬 | **默认不截获 Tab**。只有在“演奏模式”下且打开“Logic 兼容：Tab 延音”选项时才截获；屏幕上始终有延音按钮 | Tab 是网页焦点导航键，关系到可访问性 |
| 1 / 2 弯音、3–8 调制 | 有 | **A 阶段不做**；C 阶段再做，并且要能保存成 CC 或弯音事件 | 生成器和当前转换器都会忽略这些事件；只能试听而存不下来，会让用户困惑 |
| Command-K 打开窗口 | 有 | **不截获**；用可见的“电脑键盘”按钮进入演奏模式，按 Esc 退出 | 可能与浏览器快捷键冲突 |
| Space | 非 Musical Typing 功能 | 播放 / 停止（焦点不在文本输入框时） | DAW 惯例 |
| Esc | — | 退出演奏模式，并释放所有声音 | 应急出口 |

### 1.4 焦点、输入法、自动重复、复音与释放

1. **只在演奏模式下捕获按键**，并且焦点不在 `input`、`textarea`、`[contenteditable]`、下拉框或对话框中。
2. **中文输入法**：`event.isComposing === true` 或 `event.key === 'Process'`（组字中）时一律忽略；如果连续检测到组字，提示“请切换到英文输入法”。
3. **自动重复**：`event.repeat === true` 直接忽略。
4. **修饰键**：按着 Meta、Ctrl 或 Alt 时不当作音符处理，以免抢走系统或浏览器快捷键。
5. **声部表**：以 `code` 为键，记录 `{trackId, pitch, voiceId, startAudioTime}`。keyup 时按记录的 pitch 发 noteOff。所以**按住音符时切八度，旧音按旧音高释放**。
6. **统一释放**：`blur`、`visibilitychange`（hidden）、`pagehide`、退出演奏模式、换预备轨、停止录音、组件卸载，都要统一 noteOff 并清掉延音。另设“停止全部声音”按钮（`synth.stopAll()`）。
7. **复音**：允许多键同按。电脑键盘的硬件键位冲突（ghosting）会限制能同时按下的键，需在你自己的键盘上测试，不要承诺任意和弦都能弹出。

## 2. 三种输入：什么时候写入音符

| 模式 | 写入时机 | 时间来源 | 目标轨 | 撤销 |
|---|---|---|---|---|
| 试听（默认） | 不写入 | 立即发声 | 有预备轨时发到预备轨，否则发到选中轨；键盘标题上显示目标轨名 | — |
| 实时录音 | 录音进行中：按下记起点，松开记终点；停止录音时仍按着的音在停止点截断 | 音频时钟（见下） | **只写预备轨**，同一时间只允许一条预备轨 | 整次录音算一个撤销步骤 |
| 步进输入 | 当前按下的键全部松开后，一起写入光标处，然后光标前进一个步长；“休止”只前进不写入 | 编辑光标 + 选定时值（1/4、1/8、1/16、三连音） | 选中轨 | 每一步算一个撤销步骤 |

**录音时间戳与延迟补偿**：

```text
t_press    = audioContext.currentTime（keydown 时读取）
t_compens  = t_press − L          # L = 输出延迟
tick       = round((t_compens − transportStartAudioTime) × quarterBpm / 60 × ppq)
```

- 用户是跟着**听到的**节拍器弹的。而节拍器声音实际送到耳朵要晚 L，所以不做补偿的话，录进来的音整体偏晚 L。
- L 的来源有两个：优先用 `audioContext.outputLatency`（浏览器支持时），否则做一次**敲拍校准**：跟着节拍器敲 8 拍，取中位偏差。按设备（浏览器 + 输出设备）保存 L；蓝牙耳机要单独校准。
- 录音默认不量化，保存原始 tick。量化作为独立操作，可以撤销。

## 3. 时间：tick、拍、小节、秒、BPM、拍号

```text
ppq                 = 960（整数 tick / 四分音符）
小节长度（tick）      = ppq × numerator × 4 / denominator
秒（固定速度）        = tick / ppq × 60 / quarterBpm
```

| 拍号 | 每小节 tick | 重音 | 节拍器 | 倒数 |
|---|---|---|---|---|
| 4/4 | 3840 | 第 1 拍强，第 3 拍次强 | 4 个四分音符，第 1 个重读 | 1 小节（4 下） |
| 3/4 | 2880 | 第 1 拍 | 3 个四分音符 | 1 小节（3 下） |
| 6/8 | 2880 | 第 1 和第 4 个八分音符（两个附点四分音符的脉冲） | 默认每小节 2 下附点四分脉冲，可切换为 6 下八分音符 | 1 小节 |

- **BPM 一律指四分音符每分钟**，界面写作 `♩ = 120`。6/8 下另外显示辅助值 `♩. = 80`，但不改变存储的语义。
- **改速度**：音符 tick 不变，秒随之变化。播放中改速度时，已调度的事件从下一个 lookahead 窗口起重排。
- **改拍号**：音符 tick 不变，只重算小节线。用“小节”定义的循环或生成范围要按新小节线重新映射；无法对齐时给出提示。
- **量化**：网格 1/4、1/8、1/16、1/8T、1/16T，强度 0–100%。swing 放到 C 阶段。
- **循环**：范围用 tick 表示。第一版中跨过循环终点的音在终点截断，下一圈重新触发；循环录音到终点即停止。
- **调度**：音频事件用 AudioContext 的绝对时间提前调度（25 ms 定时器，100 ms lookahead，参考 [web.dev](https://web.dev/articles/audio-scheduling)），或者用 Tone.Transport。播放头的视觉位置由 `requestAnimationFrame` 读音频时钟计算，React 渲染绝不决定发声时刻。

## 4. 最小数据模型（与现有规格的差异加粗）

```jsonc
Project {
  schemaVersion: 1, id, revision,               // revision 用于乐观并发
  ppq: 960, tempo: { quarterBpm: 120 },
  timeSignature: { numerator: 4, denominator: 4 },
  key?: { tonic: 0-11, mode: "major"|"minor" },  // 可选；供生成与校验参考
  chordTrack: [ { startTick, durationTick, symbol: "Am7", root: 9, quality: "m7", bass?: 7 } ],   // **新增：和弦轨**
  sections?: [ { startTick, label: "Verse" } ],
  soundSources: [ { id, kind: "sf2"|"sf3"|"sampler", ref, license, sha256, sizeBytes } ],
  tracks: [ Track ],
  generations: [ Generation ]                    // **新增：生成来源记录**
}
Track {
  id, name,
  role: "melody"|"bass"|"drums"|"chords"|"pad"|"piano"|"counter"|"other",   // **新增：角色**
  instrument: { gmProgram: 0-127, isDrum: false, bankMSB?: 0 },
  soundSourceId,
  mix: { volume: 0-1, pan: -1..1, mute: false, solo: false },
  status: "normal"|"candidate",
  origin: { type: "user"|"generated"|"transformed"|"imported", generationId?, sourceTrackIds? },
  clips: [ { id, startTick, lengthTick, notes: [ { id, pitch, startTick, durationTick, velocity } ], cc?: [ ... ] } ]
}
Generation {                                     // **新增**
  id, requestId, createdAt, projectRevision,
  task: "add_role"|"vary"|"continue"|"transform",
  generator: { name, version, weightsSha256? }, params, seed, inputHash,
  status: "pending"|"ready"|"stale"|"failed"|"cancelled",
  timings: { queuedMs, loadMs, generateMs, totalMs }, diagnostics,
  ratings?: [ { rater: "dev", usable: "as_is"|"light_edit"|"unusable", preferredOver?: [genId] } ]  // 盲听结果
}
```

四种身份必须分开：

- `trackId`：用户的组织单位；
- `gmProgram`：乐器类别；
- `soundSourceId`：发声资源；
- **MIDI channel**：播放和导出时由分配器临时决定，**不存进项目**。

通道分配规则：

- **播放**：每条非鼓轨独占一个合成器通道，跳过 channel 9（第 10 通道）。超过 15 条时，用 SpessaSynth 的 `addNewChannel` 扩展。每条鼓轨也各自占一个设为鼓模式的通道，从而能独立 M/S 和调音量。
- **导出（SMF type 1）**：每条轨写一个 MTrk，通道 0–15（channel 9 给第一条鼓轨）。音高轨超过 15 条或鼓轨多于 1 条时，**明确提示**，由用户选择合并或放弃，不静默合并。
- 由此可以保证两条同音色轨在播放和导出时都分属两个通道，各自独立 Mute、Solo 和音量。

会话状态不写进项目：`selectedTrackId`、`armedTrackId`、播放状态、演奏模式。

## 5. 完整 GM 目录：编号、预设、搜索与加载

- **编号**：内部存 0–127，界面显示 1–128 和名称。共 16 个家族，每族 8 个（钢琴、半音打击、风琴、吉他、贝斯、弦乐、合奏、铜管、簧管、笛类、合成主音、合成铺底、合成效果、民族、打击、音效）。鼓不是第 129 个 program：鼓轨设 `isDrum: true`，导出到第 10 通道；GM 打击乐键位为 **35（Acoustic Bass Drum）到 81（Open Triangle）**（[CMU 表](https://www.cs.cmu.edu/~music/cmp/archives/cmsip/readings/GMSpecs_PercMap.htm)）。
- **流行常用预设**（首屏）：Acoustic Grand（0）、Bright Acoustic（1）、Electric Piano 1（4）、Nylon Guitar（24）、Steel Guitar（25）、Clean Electric Guitar（27）、Fingered Bass（33）、Picked Bass（34）、Synth Bass 1（38）、String Ensemble 1（48）、Pad 2 warm（89）、Lead 1 square（80）、标准鼓组。
- **全部乐器**：列出 128 个 program 和全部鼓组，支持家族筛选和中英文搜索，每项可短试听。鼓轨列出鼓件名和音符号，不对鼓应用音阶过滤。
- **生成器能力标签**分三档：“已验证 / 实验性 / 不支持”。用实验结果标注，不能把“词表里有这个编号”说成“能生成好这个乐器”。
- **加载**：一个完整 GM SoundFont 只下载一次，存进 Cache Storage 或 IndexedDB，并显示“未加载 / 加载中 / 就绪 / 失败”。不要为 128 个乐器逐个下载采样。

## 6. 浏览器音频方案比较

| 方案 | 类别 | 许可 | GM 全覆盖 | 同音色独立通道 | Safari | 结论 |
|---|---|---|---|---|---|---|
| 原生 Web Audio | 时钟 + 底层节点 | 平台 | 需要自己实现采样器 | 自己实现 | 支持 | 用作基础；自写 25 ms / 100 ms 调度器也不难 |
| [Tone.js](https://github.com/Tonejs/Tone.js)（npm 15.1.22） | **时钟**（Transport）+ 合成器 + 效果 + Sampler | MIT | 否（没有 GM 库） | 可以 | 支持 | 可选：用于 Transport 和节拍器；不负责 GM 音色 |
| [SpessaSynth](https://github.com/spessasus/SpessaSynth)（`spessasynth_lib` 4.3.x） | **SoundFont 合成器** + MIDI 读写 + 播放器 | lib/core 为 Apache-2.0（npm 字段写 MIT AND Apache-2.0） | 是（SF2 / SF3 / DLS，GS / XG / GM2） | 是：每通道 `programChange`、`controllerChange`，可用 `addNewChannel` 扩展，`noteOn(channel, note, vel, {time})` | **官方兼容列表没有写 Safari**（2026-09-26） | **首选合成器**；A 阶段第一周就要测 Safari |
| [smplr](https://github.com/danigb/smplr)（npm 1.0.0） | 采样播放器（Soundfont、SplendidGrandPiano、DrumMachine、SF2…） | MIT（代码） | Soundfont 类走 gleitz 的 MP3 渲染（MusyngKite / FluidR3） | 按实例 | 基本可用（需自测） | Safari 的备选；高质量钢琴的可选音源 |
| [js-synthesizer](https://github.com/jet2jet/js-synthesizer) | FluidSynth WASM | BSD-3（封装）+ **LGPL-2.1**（libfluidsynth） | 是 | 是 | 需自测 | 备选；要注意 LGPL 的分发义务 |
| [WebAudioFont](https://github.com/surikov/webaudiofont) | 预渲染乐器 | **GPL-3.0**（代码） | 是 | 按实例 | 需自测 | 如果代码不开源则不宜采用 |
| soundfont-player | 老式采样播放 | MIT；已归档 | 部分 | — | — | 不用 |
| [@tonejs/midi](https://github.com/Tonejs/Midi)（npm 2.0.28） | **MIDI 文件解析与写入** | MIT | — | — | — | 浏览器侧 MIDI I/O；后端用 Symusic |

推荐组合：**SpessaSynth（全局一个 WorkletSynthesizer 实例）+ 自写调度器或 Tone.Transport + @tonejs/midi**。如果 Safari 下 SpessaSynth 不可用，降级为 smplr 的 Soundfont 子集，并在界面上说明“Safari 下音色有限”。

## 7. 音色资源：引擎许可不等于资源许可

| 资源 | 许可（发布者表述） | 体积 | 加载方式 | 再分发条件 | 未知或风险 |
|---|---|---|---|---|---|
| **GeneralUser GS v2.0.3**（S. Christian Collins） | 自定义许可：可用于个人或商业音乐创作；“feel free to use it in your software projects, and to modify”；不强制署名；请勿直链作者的下载地址 | 现有规格记录 SF2 为 32,319,396 bytes（本轮未能独立核对大小）；261 个预设、13 套鼓 | 一次下载 SF2 或 SF3 | 可以打包进软件；保留许可文件 | 作者承认部分采样来源无法完全确认 |
| FluidR3_GM（Frank Wen） | **MIT**（Debian 版权文件） | 约 140 MB（SF2，未核验） | 一次下载 | 保留 MIT 声明 | gleitz 渲染版标注为 **CC BY 3.0**，与原作的 MIT 表述冲突；引用时两者都署名 |
| MuseScore_General v0.2（2020） | **MIT** | SF3 较小（未核验） | 一次下载 | 保留声明 | — |
| MusyngKite（gleitz 渲染） | **CC BY-SA 3.0** | 1.75 GB（全部，未压缩） | 按乐器懒加载 | 署名 + 相同方式共享 | SA 条款对产品的影响需评估 |
| FatBoy（gleitz 渲染） | CC BY-SA 3.0 | 320 MB | 按乐器懒加载 | 同上 | — |
| Splendid Grand Piano（sfzinstruments） | 发布方称 AKAI 采样于 2000 年起已进入**公共领域**；衍生作品请注明出处 | 256 MB 版 | 单独加载 | 请注明来源 | “公共领域”是发布方的说法 |
| Salamander Grand Piano v3 | **CC BY 3.0**（Alexander Holm） | 大（48k / 24bit，未核验） | 单独加载 | 署名 | — |

建议 A 阶段先用你本地合法持有的 GeneralUser GS 做功能验证。确定要内置分发前，在仓库中记录资源的版本、sha256、许可原文和来源。

## 8. Web MIDI（外接键盘，C 阶段，可选）

- [caniuse](https://caniuse.com/midi)（2026-09-26）：Chrome 43+、Edge 79+、Firefox 108+ 支持；**Safari（macOS 和 iOS）不支持**。
- [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API)：只能在安全上下文中使用，需要用户授权，受 `midi` Permissions Policy 约束；sysex 需另行授权。
- 电脑键盘输入只依赖 KeyboardEvent 和 Web Audio，**与 Web MIDI 无关**。检测不到 `requestMIDIAccess` 或权限被拒时，界面只隐藏“外接设备”入口，其他功能不受影响。

## 9. 轨道与候选状态规则

| 状态 / 操作 | 规则 |
|---|---|
| 选中 | 决定编辑对象，不影响播放 |
| R 预备 | 决定录音目标。同一时间最多一条。候选轨必须先“保留”才能预备 |
| M 静音 | 停止这条轨的播放；数据和生成参考都不变 |
| S 独奏 | 只要有任一轨处于 Solo，就只播放 Solo 且未 Mute 的轨；可多轨同时 Solo |
| M 与 S 同时开启 | Mute 优先 |
| 生成参考 | 在生成面板中显式勾选，**不受临时 M/S 影响** |
| 生成目标默认（**改进**） | **按角色决定**：贝斯 → Fingered Bass（33）；鼓 → 标准鼓组；和弦铺底 → Pad 2 warm（89）；钢琴伴奏 → Acoustic Grand（0）；**同音色变奏、接着写 → 与源轨相同** |
| 生成音的力度默认值（**改进**） | 按角色给出 pattern 力度（例如鼓的强拍重音、贝斯 90、铺底 70），不再统一写 72 |
| 候选生命周期 | pending（显示已用时，可取消）→ ready（虚线、“候选”字样、颜色三重标识）→ kept（变为普通轨）/ discarded / stale / failed |
| 比较 | “叠加 / 只听原轨 / 只听候选”三键，只是临时改变监听组合，退出后恢复原 M/S；一次生成多个候选时互斥试听 |
| **盲听模式（新增）** | 隐藏生成器名称，随机把候选标为 A/B/C；评分（可直接用 / 小改可用 / 不可用）和偏好写入 `Generation.ratings`，可导出为 EXPERIMENT_PLAN 所需的 JSONL |
| 重新生成 | 在同一候选位置生成新版本；旧版本留在历史里，可以撤销 |
| 并发 | 每条目标轨同一时间只允许一个进行中的请求；再次点击会提示“取消当前生成？” |
| 迟到响应 | 响应中的 `projectRevision` 与当前不一致时，候选标为“基于旧版本”，**不会自动放入**；用户可以选择“仍放入新轨”或“重新生成”。已取消任务的响应一律丢弃 |
| 撤销 | 录音、编辑、保留、丢弃、应用变换都进入撤销栈。M/S 和音量属于监听状态，不进撤销栈（但随项目保存） |

## 10. 首次使用的布局与最短流程

```text
┌ FLUX · 未命名项目                    撤销 重做   保存  导入MIDI  导出MIDI ┐
│ ⏮ ▶/⏸ ■ ●录音   ♩=120   4/4 ▾   循环  节拍器  倒数1小节   001.1.000       │
├──────────────────┬─────────────────────────────────────┬──────────────────┤
│ 轨道              │ 小节   1      2      3      4        │ 生成              │
│ + 添加轨道        │ 和弦  │ C    │ G    │ Am   │ F    │ │ 参考：旋律1 1–4小节 │
│ 旋律1 · 钢琴      │ [我的旋律片段                     ] │ [+贝斯] [+鼓]      │
│  M S R  ▮▮▮▯      │                                     │ [+和弦铺底][+钢琴伴奏]│
│ 贝斯（候选）      │ [┈┈┈┈┈┈┈┈ 候选片段 ┈┈┈┈┈┈┈┈┈┈┈]     │ [同音色变奏][接着写]│
│  M S    ▮▮▯▯      │                                     │ 风格 流行抒情 ▾     │
│                   │                                     │ 生成器 规则（默认）▾ │
│                   │                                     │ [生成1个][生成3个比较]│
│                   │                                     │ 保留 · 换一个 · 丢弃 │
├──────────────────┴─────────────────────────────────────┴──────────────────┤
│ 钢琴卷帘（选中轨）  网格1/16  量化[关]  变换▾   显示参考轨[开]            │
├──────────────────────────────────────────────────────────────────────────┤
│ 电脑键盘[开] 模式:试听/录音/步进  目标:旋律1  八度C4  力度100  延音[ ]  Esc退出 │
│        W E   T Y U   O P                                                 │
│       A S D F G H J K L ; '                                              │
└──────────────────────────────────────────────────────────────────────────┘
```

最短主流程（7 步）：

1. 点“启用声音”；
2. 默认轨是“旋律 1 · 钢琴”，可以换音色；
3. 点 R 预备，再点 ● 录音，倒数一小节后弹 4 小节；
4. 停止，片段自动成为生成范围；
5. 在和弦行点“从旋律估计”，确认或修改和弦；
6. 点“+贝斯”（或“同音色变奏”）；
7. 叠加试听，然后保留。

错误与空状态：

| 情形 | 提示 | 可做的操作 |
|---|---|---|
| 声音未启用或被浏览器阻止 | “点击启用声音” | 按钮直接触发 `resume()` |
| 音色加载失败 | “音色资源加载失败（xx）” | 重试，或选择本地 SF2 |
| 输入法组字中 | “请切换到英文输入法以弹奏” | — |
| 没有预备轨就录音 | “请先点某条轨的 R” | 一键预备当前轨 |
| 后端未启动或超时 | “生成服务不可用，作品未改变” | 重试；改用规则生成器 |
| 生成结果为空或无效 | “没有生成有效音符”，**不创建候选轨** | 换一个种子或调高密度 |
| 响应已过期 | “基于旧版本生成” | 仍放入新轨 / 重新生成 |
| 生成器不支持该乐器 | “该生成器未验证此乐器” | 换角色或换生成器 |

## 11. 验收用例（可执行）

A 阶段：AT-01 到 AT-12，外加 AT-16 到 AT-18。B 阶段：AT-13 到 AT-15，以及 AT-19、AT-20。C 阶段：AT-21。AT-22 是贯穿各阶段的性能门槛。“自动化”一栏说明验证手段：事件日志指对合成器调用做 spy；离线渲染指 SpessaSynth 的 `startOfflineRender` 或 OfflineAudioContext。

| 编号 | 步骤 | 通过标准 | 自动化 |
|---|---|---|---|
| AT-01 | 点“启用声音”，按 A | AudioContext 为 running；发出 `noteOn(ch, 60, 100)` | 事件日志 |
| AT-02 | 按住 A 1 秒再松开 | noteOn 1 次，noteOff 1 次 | 事件日志 |
| AT-03 | 同时按 A、D、G 再松开 | 3 个 noteOn，对应 3 个 noteOff | 事件日志 |
| AT-04 | 按住 A，按 X，松开 A；再按 A | 先 noteOff(60)，之后 noteOn(72) | 事件日志 |
| AT-05 | 在轨名框输入 “asdf”；中文输入法组字时按键 | 没有 noteOn | 事件日志 |
| AT-06 | 按住 A 时切换标签页或让窗口失焦 | 自动 noteOff，没有悬挂音 | 事件日志 |
| AT-07 | 120 BPM、4/4，倒数后跟节拍器每拍弹 8 次 | 录入 8 个音；做过校准后，与拍网格偏差的中位数小于 30 ms；停止时还按着的音在停止点截断 | 半自动（人弹，脚本分析） |
| AT-08 | 步进 1/8：按住 A+D+G 后全部松开，再点“休止” | 3 个音写在同一个 startTick，光标前进 480；休止前进 480、不写音 | 单元测试 |
| AT-09 | 同一片段分别用 120 BPM 和 60 BPM 渲染 | 渲染时长翻倍（±1 个渲染块）；tick 不变 | 离线渲染 |
| AT-10 | 4/4 改为 3/4；再改为 6/8 并开节拍器 | 音符 tick 不变，小节线改变；6/8 每小节 2 个重音脉冲（可切换为 6 下） | 单元测试 + 事件日志 |
| AT-11 | 遍历 128 个 program 和鼓组 | 全部可以选择；每族抽 1 个加鼓件 35–81 能发声；资源缺失的项显示为“缺失” | 离线渲染（RMS > 阈值） |
| AT-12 | 两条 program 0 轨同时弹同音高的重叠音；对轨 1 Mute，并把轨 1 音量调到 0.2 | 轨 2 不被截断，音量不变 | 离线渲染 |
| AT-13 | 对源轨做序列化 hash；依次生成候选、保留、丢弃、重新生成 | 源轨 hash 始终不变；丢弃后没有残留的可播放事件 | 单元测试 |
| AT-14 | 发起生成后修改源轨；另起一次生成并取消 | 前者的响应标为 stale，不会自动放入；后者被取消后到达的响应被丢弃 | 集成测试（模拟延迟） |
| AT-15 | 生成器返回 0 个音；后端未启动 | 显示明确提示，不创建候选轨，作品不变 | 集成测试 |
| AT-16 | 录音、移动、改长、删除、保留、丢弃 | 都能撤销和重做 | 单元测试 |
| AT-17 | 保存 JSON → 刷新页面 → 打开 | 速度、拍号、轨道、音符、乐器、音色来源、和弦轨与保存前深度一致 | 单元测试 |
| AT-18 | 导出 SMF type 1，用 Symusic 或 mido 读回 | tempo、拍号、program、tick、音高、时值、力度一致；同音色两轨仍是两条轨、两个通道 | 自动 |
| AT-19 | 和弦轨写 C / G / Am / F，生成 R0 贝斯 | 每小节第 1 拍是该小节和弦的根音 | 单元测试 |
| AT-20 | 开启盲听模式，一次生成 3 个候选 | 不显示生成器名；顺序随机；评分写进 `Generation.ratings`，可导出 | 单元测试 |
| AT-21 | Chrome 授权外接 MIDI 键盘；在 Safari 中打开 | Chrome 下可以录音；拒绝授权后电脑键盘照常可用；Safari 显示“不支持外接 MIDI” | 手工 |
| AT-22 | 暖启动后测 keydown 到 `noteOn` 调用的耗时；8 轨循环播放 5 分钟 | p95 小于 10 ms（JS 侧）；没有掉音或累积漂移。记录浏览器、声卡、采样率、是否蓝牙。**这是调度延迟，不是听到声音的延迟** | 半自动 |

## 12. 与现有 `DAW_SPEC_2026-09-26.md` 的对照

**同意的部分**（有独立依据）：

- Musical Typing 键位；A 键 = MIDI 60；用 `code` 映射；默认不劫持 Tab 和 Cmd-K；输入法和文本框期间不发声；忽略 `repeat`；按键声部表与统一释放。
- ppq 整数 tick；BPM 指四分音符；改速度或拍号时 tick 不变；AudioContext 负责调度。
- 区分 program、音源和轨道；GM 编号用 0–127；鼓用 `isDrum` 并导出到第 10 通道；首选 SpessaSynth；GeneralUser GS 作为本地验证音源；引擎许可与资源许可分开。
- 候选轨复制的是音色设置，而不是源音符；生成结果在合并之前就分离；M/S/R 规则；迟到响应的处理；P0 验收思路；性能门槛要区分“调度延迟”和“实际听到的延迟”。

**改进点**：

1. **生成面板改为角色优先。** 现有规格默认“同音色加一层”，需要贝斯或鼓时要改目标乐器。改进后：**“+贝斯 / +鼓 / +和弦铺底 / +钢琴伴奏 / 同音色变奏 / 接着写”**各自带默认音色；只有变奏和续写默认使用同音色。流行编曲最常见的需求就是补节奏组。
2. **和弦轨作为一等对象**（数据 + 界面 + “从旋律估计”生成的候选）。所有生成器（R0、模型、LLM 规划）读取同一条和弦轨。这与 Logic Session Players 的设计一致，也方便诊断和声问题。
3. **盲听模式**直接为研究评估服务（`Generation.ratings`）。
4. **录音延迟补偿**给出具体公式和敲拍校准流程，而不只是“另行测量”。
5. **Safari 风险前置**：SpessaSynth 官方兼容列表没有 Safari，A 阶段第一周就测，并预留 smplr 降级方案。
6. **通道分配器**：写明播放与导出的具体规则（`addNewChannel`，多条鼓轨的处理，超限时提示）。
7. **生成音力度**：按角色给出 pattern，不再沿用 AMT 的 72。
8. **音色许可表补全**：FluidR3 的 MIT 与 gleitz 渲染版 CC BY 3.0 的冲突；MusyngKite / FatBoy 为 CC BY-SA；Splendid 被发布方称为公共领域；Salamander 为 CC BY 3.0；MuseScore_General 为 MIT。
9. **6/8 节拍器和倒数**有了具体行为定义。
10. **候选生命周期与并发策略**写明：每条目标轨一个请求，以及 stale / failed / cancelled 状态。
11. **验收用例可自动化**（事件日志、离线渲染、round-trip）。
