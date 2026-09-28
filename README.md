# FLUX

FLUX 是面向音乐创作者的 MIDI 编曲工作台：输入自己的旋律，在独立轨道上试听生成建议，通过叠加、Mute/Solo 和保留／丢弃控制作品。

**状态更新：2026-09-27。** 阶段 A 已实施，状态为 **DELIVERED / 待复核**（[交付记录](docs/PHASE_A_DELIVERY_2026-09-27.md)）：网页可启用 SpessaSynth 音频（本地 SF2/SF3），完整 GM 128 乐器与鼓组，电脑键盘试弹／实时录音／步进，多轨 Mute/Solo/音量，速度／拍号，卷帘编辑与撤销，项目 JSON 与 MIDI 导入导出；和弦自动识别、手选根音＋类型＋低音、调性候选与级数／进行分析（CH-01–CH-08）。Safari.app 人工测试已由用户报告通过；2026-09-28 按试用反馈加入 Logic 式多轨行、空格键播放、卷帘框选、点音试听、独立播放头栏、“和弦轨 → 新 MIDI 轨”和中英文界面，并修复了“和弦进行不显示”（[跟进记录](docs/PHASE_A_FOLLOWUP_2026-09-28.md)）。生成（R0／模型）属于 B 阶段，网页上没有生成按钮；`/api/suggest` 随机接口只为兼容保留。真实 AMT 研究管线和六种确定性变换仍独立于网页。

## 启动现有网页

在项目根目录先安装环境并构建前端（已有依赖时可跳过安装）：

```sh
uv sync --frozen
npm --prefix frontend ci
npm --prefix frontend run build
uv run uvicorn backend.main:app --reload --port 8000
```

打开 **http://127.0.0.1:8000/**。后端现在直接提供构建后的网页和 `/api/suggest`；没有前端构建时，根页面会显示构建说明。`/docs` 是 API 文档。

使用时先点“启用声音”，再用“选择音源文件”载入本地 SF2／SF3（项目只记录文件名、大小和 SHA-256，不写本机路径；同一浏览器刷新后会从浏览器缓存自动载入）。验证用的是 GeneralUser GS v2.0.3，来源与许可见交付记录；音色文件不随仓库分发。前端测试：`npm --prefix frontend test`。

修改前端时可以使用两个终端：

```sh
# 终端 1，项目根目录
uv run uvicorn backend.main:app --reload --port 8000

# 终端 2，项目根目录
npm --prefix frontend run dev
```

开发模式打开 **http://localhost:5173/**，Vite 将 `/api` 转发到 8000。8000 提供上次构建版本，前端源码更新后需重新 build；5173 支持开发热更新。旧日志里的 `GET / 404` 是因为原后端只有 API 路由；`favicon.ico 404` 与模型和音符功能无关。

## 当前文档

**阶段 A：**[handoff](docs/HANDOFF_A_2026-09-27.md) → [交付记录](docs/PHASE_A_DELIVERY_2026-09-27.md)（2026-09-27，DELIVERED／待复核）→ [跟进记录](docs/PHASE_A_FOLLOWUP_2026-09-28.md)（2026-09-28）：可听工作台与和弦输入，CH-01–CH-08。B 阶段尚未开工。

| 文档 | 用途 |
|---|---|
| [当前计划与工作顺序](docs/RESEARCH_RESET_2026-09-26.md) | 唯一工作顺序入口：可听工作台与和弦输入 → R0 → 模型比较 → 按证据适配 |
| [网页 DAW 规格](docs/DAW_SPEC_2026-09-26.md) | 键盘、多轨、完整 GM；和弦识别、手选 add／sus、级数／进行、生成合同及验收 |
| [独立调研复评与采纳](docs/research/RESEARCH_REVIEW_2026-09-26.md) | 采纳／修正／待验证项、本机复核、E0–E7 实验修订 |
| [音乐模型与数据集](docs/research/MODELS_DATASETS_2026-09-26.md) | 模型与 R0 候选、数据资源、许可与可用性、比较实验 |
| [Jev、LLM、MCP、CLI](docs/research/LLM_TOOLS_2026-09-26.md) | 概率选择、工具编曲、现有 DAW 桥接和验证路线 |
| [给 Claude 的独立调研提示词](docs/CLAUDE_RESEARCH_PROMPT.md) | 可整份复制；先独立调研，再与本轮结论逐项交叉核验 |
| [Claude 原始调研](docs/claude_research/2026-09-26/INDEPENDENT_REPORT.md) | 保留原稿及配套交叉核对、DAW 审查、实验计划、来源；采纳结果以上方当前计划为准 |
| [历史归档与纠错](archive/README.md) | 旧计划、工作日志、导师材料及被纠正的说法，不作为当前执行要求 |

外部模型的性能、音乐质量及兼容性以报告中的证据级别为准。本轮完成源码／文献／官方发布核查，没有训练模型、调用付费服务或完成新模型听感比较。

## 代码分工

| 位置 | 作用与边界 |
|---|---|
| `frontend/` | React + Vite 工作台：`src/music/` 纯函数（时间、GM 目录、和弦字典／识别、调性与级数分析、项目模型、MIDI 交换、键盘映射），`src/audio/` 音频引擎与调度，`src/components/` 界面；`tests/` 为 vitest，`e2e/` 为浏览器验证脚本 |
| `backend/main.py` | FastAPI 网页入口及随机建议接口；没有加载音乐模型 |
| `research/generate.py` | 加载外部 AMT 预训练权重，调用生成，输出 MIDI／图片 |
| `research/pipeline.py` | MIDI → controls → 生成 → 混合输出 → muspy 指标；属于离线实验 |
| `research/ab_test.py` | 历史四组 pilot；不是正式质量 benchmark |
| `research/metrics.py` | 八项单曲音乐特征，目前 groove 默认 4/4；不是审美总分 |
| `research/dataset.py` | 加载 Essen 作为测试输入池；本项目没有用它训练模型 |
| `core/transforms.py` | 六种独立、确定性的音乐编辑操作；不必先调用它们才能使用生成器 |
| `tests/` | 变换性质测试，以及网页入口、静态资源和 API 回归检查 |
| `scripts/demo_check.sh` | 检查现有原型；会重写确定性的变换演示 MIDI，不运行模型 |

## 本地复现与实验边界

```sh
uv run pytest -q
uv run python -m research.metrics data/sample/sample_melody.mid
uv run python -m core.transforms
```

模型路径仍保留供基线研究使用：`uv run python -m research.generate`、`uv run python -m research.pipeline`、`uv run python -m research.ab_test`。

注意：后两条命令会追加 `data/results/pipeline_metrics.csv`，并覆盖对应 tag 的 MIDI／PNG。**新 tag 不会创建新 CSV。**开展新实验前应使用独立结果文件／工作副本，保留旧 pilot。新比较需保存输入、权重版本、种子、采样参数、设备、耗时与全部候选，不能只保留最好的一次。

`data/`、模型缓存和历史 `plans/` 为本地材料，不随克隆自动恢复。旧文档已按原目录移到 `archive/2026-09-26/`；该处的 `plans/` 继续受忽略规则保护。未提交代码仍在工作区，本轮没有执行 Git 提交或推送。
