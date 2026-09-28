> **历史归档 · 2026-09-26 · 不作为当前执行指令。**
> 原位置：`docs/worklog_v3_zh.md`。任务 A 实现记录保留。精确有理数不意味着任意缩放均落在固定 48 ticks 网格；20 个测试覆盖案例而非对所有可能输入的证明。该任务不再是生成路径的必经步骤。
> 当前入口：[项目 README](../../../README.md)；[归档纠错索引](../../README.md)。正文保留历史原文，相对路径和旧命令按原位置解释。

<!-- ARCHIVED ORIGINAL BELOW -->
# v3 开发工作日志（中文复盘版）

> 对应 `plans/FLUX_v3.md` 的开发任务。延续 Phase 0 日志的格式:
> 做了什么、关键决策、gate 怎么验证的、踩过的坑。

---

## 任务 A — 确定性变换层（2026-07-29 开工,当日完成)

### 产出

| 文件 | 内容 |
|------|------|
| `core/transforms.py` | 变换层本体:`Note` / `TimeSignature` / `Key` + 六种变换 + 放置与验证辅助 |
| `tests/test_transforms.py` | 20 个性质测试,逐条钉死任务 A 的硬性要求 |
| `data/generated/transforms_demo.mid` | 试听文件:原动机 + 六种变换按小节排开(每段之间空一小节) |

### 关键决策(复习重点)

1. **时间用 `Fraction`(拍),边界上直接拒绝 float。**
   "不允许浮点飘移"最干净的实现不是"生成后量化",而是让漂移在类型上不可能发生。
   `Note(time=0.5, ...)` 会直接 `TypeError`,必须写 `Fraction(1, 2)`。
   增值 ×3/2、减值 ×3/4 之后时值仍是精确有理数,`on_grid()` 可验证任意结果
   在 48 ticks/拍分辨率下是否整点落格。

2. **时间约定:t=0 = 动机首小节的小节线。**
   所有变换输出归一化到 t=0 起,由 `place_in_bars(notes, start_bar, ts)`
   平移到目标小节。这样"落在小节边界"是构造保证,不是事后检查。

3. **sequence 步长 = 动机时长向上取整到整小节**(fragmentation 取整到整拍)。
   5 拍的动机在 4/4 里模进,下一次重复从第 8 拍开始,不是第 5 拍——
   保证每次重复都踩在小节线上。6/8 的小节长按四分音符拍算(= 3 拍)。

4. **inversion / sequence 双模式:chromatic 与 diatonic。**
   v3 §4.1 验收要求倒影"音程关系精确取反"**且**"在调内"。半音倒影做不到
   两者兼得(C 大调绕 C4 倒影,A→E♭ 出调);**级数(scale degree)倒影**
   可以:度数间隔精确取反,且输出必然在音阶内。所以 diatonic 模式下音程
   单位是"级数",chromatic 模式下是半音,两种"精确"各自可验证
   (`interval_sequence` / `degree_interval_sequence`)。产品端默认应给 diatonic。

5. **调外输入音的处理:先吸附(snap)最近调内音再做级数运算**,平手向下取。
   写进了 docstring,测试里有 F#→(F)→G 的用例。

6. **新开 `core/` 包,不放 `research/`。**
   变换层无模型、无 IO、纯 stdlib(muspy 只在 `__main__` demo 里局部 import),
   是产品的地基;任务 B 的约束层之后也进 `core/`。

### Gate 验证

任务 A 硬性要求逐条对照:

1. bar-aligned / 不允许浮点飘移 → `Fraction` + `on_grid()` + 步长取整,
   `test_all_transforms_stay_on_grid_and_never_mutate_input` 等
2. 变换关系精确可验证 → 倒影音程取反、逆行对合(retrograde∘retrograde=id)、
   增减值比例逐音符断言、模进逐次移位断言
3. 调内模式全部落在音阶内 → `in_key()` 断言(sequence/inversion 的 diatonic 用例)
4. 纯函数无副作用 → `Note` 是 frozen dataclass,测试对比调用前后快照
5. 每种变换配单元测试 → `uv run pytest -q` = **20 passed**

v3 §4.1 的验收标准(2 小节动机 + Inversion → 小节边界 / 精确倒影 / 调内)
单独写成 `test_acceptance_two_bar_motif_inversion`;第四条"只出现在选中轨"
属于任务 B 约束层,到时候补进这条测试。

### 试听

`uv run python -m core.transforms` 会打印小节图并写
`data/generated/transforms_demo.mid`(110 BPM,单轨钢琴,58 音符,24 小节):

```
bar  1: 原动机(小星星前两小节 C C G G A A G)
bar  4: sequence  级数下行模进 ×2
bar  9: inversion 级数倒影(绕 C4)→ C C F F E E F
bar 12: retrograde 逆行
bar 15: augmentation ×2
bar 20: diminution ×1/2
bar 22: fragmentation(A A G 片段 ×3)
```

已用 muspy 往返读取验证(58 音符、结束于第 96 拍,与小节图一致)。
**⚠️ 待办:请试听一遍**——结构我能验证,听感只能靠你。

### 踩坑

8. **pytest 找不到 `core` 包**:项目不是 installed package,`uv run pytest`
   的 sys.path 里没有项目根。解决:`pyproject.toml` 加
   `[tool.pytest.ini_options] pythonpath = ["."]`(顺带 `testpaths = ["tests"]`)。

### 复现命令

```sh
uv run pytest -q                  # 20 passed
uv run python -m core.transforms  # 小节图 + data/generated/transforms_demo.mid
```
