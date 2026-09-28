// General MIDI Level 1 catalog. Programs are stored 0–127 and shown to people as 1–128;
// drums are a separate isDrum kit, never "program 129".

const PROGRAMS = [
  ['Acoustic Grand Piano', '原声大钢琴'], ['Bright Acoustic Piano', '明亮原声钢琴'],
  ['Electric Grand Piano', '电大钢琴'], ['Honky-tonk Piano', '酒吧钢琴'],
  ['Electric Piano 1', '电钢琴 1'], ['Electric Piano 2', '电钢琴 2'],
  ['Harpsichord', '羽管键琴'], ['Clavinet', '击弦古钢琴'],
  ['Celesta', '钢片琴'], ['Glockenspiel', '钟琴'], ['Music Box', '八音盒'], ['Vibraphone', '颤音琴'],
  ['Marimba', '马林巴'], ['Xylophone', '木琴'], ['Tubular Bells', '管钟'], ['Dulcimer', '扬琴'],
  ['Drawbar Organ', '拉杆风琴'], ['Percussive Organ', '打击风琴'], ['Rock Organ', '摇滚风琴'],
  ['Church Organ', '教堂管风琴'], ['Reed Organ', '簧风琴'], ['Accordion', '手风琴'],
  ['Harmonica', '口琴'], ['Tango Accordion', '探戈手风琴'],
  ['Acoustic Guitar (nylon)', '尼龙弦吉他'], ['Acoustic Guitar (steel)', '钢弦吉他'],
  ['Electric Guitar (jazz)', '爵士电吉他'], ['Electric Guitar (clean)', '清音电吉他'],
  ['Electric Guitar (muted)', '闷音电吉他'], ['Overdriven Guitar', '过载吉他'],
  ['Distortion Guitar', '失真吉他'], ['Guitar Harmonics', '吉他泛音'],
  ['Acoustic Bass', '原声贝斯'], ['Electric Bass (finger)', '指弹贝斯'],
  ['Electric Bass (pick)', '拨片贝斯'], ['Fretless Bass', '无品贝斯'],
  ['Slap Bass 1', '击勾贝斯 1'], ['Slap Bass 2', '击勾贝斯 2'],
  ['Synth Bass 1', '合成贝斯 1'], ['Synth Bass 2', '合成贝斯 2'],
  ['Violin', '小提琴'], ['Viola', '中提琴'], ['Cello', '大提琴'], ['Contrabass', '低音提琴'],
  ['Tremolo Strings', '弦乐震音'], ['Pizzicato Strings', '弦乐拨奏'],
  ['Orchestral Harp', '竖琴'], ['Timpani', '定音鼓'],
  ['String Ensemble 1', '弦乐合奏 1'], ['String Ensemble 2', '弦乐合奏 2'],
  ['Synth Strings 1', '合成弦乐 1'], ['Synth Strings 2', '合成弦乐 2'],
  ['Choir Aahs', '合唱“啊”'], ['Voice Oohs', '人声“哦”'], ['Synth Voice', '合成人声'],
  ['Orchestra Hit', '管弦齐奏'],
  ['Trumpet', '小号'], ['Trombone', '长号'], ['Tuba', '大号'], ['Muted Trumpet', '弱音小号'],
  ['French Horn', '圆号'], ['Brass Section', '铜管组'], ['Synth Brass 1', '合成铜管 1'],
  ['Synth Brass 2', '合成铜管 2'],
  ['Soprano Sax', '高音萨克斯'], ['Alto Sax', '中音萨克斯'], ['Tenor Sax', '次中音萨克斯'],
  ['Baritone Sax', '上低音萨克斯'], ['Oboe', '双簧管'], ['English Horn', '英国管'],
  ['Bassoon', '大管'], ['Clarinet', '单簧管'],
  ['Piccolo', '短笛'], ['Flute', '长笛'], ['Recorder', '竖笛'], ['Pan Flute', '排箫'],
  ['Blown Bottle', '吹瓶'], ['Shakuhachi', '尺八'], ['Whistle', '口哨'], ['Ocarina', '陶笛'],
  ['Lead 1 (square)', '方波主音'], ['Lead 2 (sawtooth)', '锯齿波主音'],
  ['Lead 3 (calliope)', '汽笛风琴主音'], ['Lead 4 (chiff)', '吹管主音'],
  ['Lead 5 (charang)', '沙朗主音'], ['Lead 6 (voice)', '人声主音'],
  ['Lead 7 (fifths)', '五度主音'], ['Lead 8 (bass + lead)', '贝斯加主音'],
  ['Pad 1 (new age)', '新世纪铺底'], ['Pad 2 (warm)', '温暖铺底'],
  ['Pad 3 (polysynth)', '复音合成铺底'], ['Pad 4 (choir)', '合唱铺底'],
  ['Pad 5 (bowed)', '弓弦铺底'], ['Pad 6 (metallic)', '金属铺底'],
  ['Pad 7 (halo)', '光环铺底'], ['Pad 8 (sweep)', '扫频铺底'],
  ['FX 1 (rain)', '雨声效果'], ['FX 2 (soundtrack)', '配乐效果'], ['FX 3 (crystal)', '水晶效果'],
  ['FX 4 (atmosphere)', '氛围效果'], ['FX 5 (brightness)', '明亮效果'],
  ['FX 6 (goblins)', '魅影效果'], ['FX 7 (echoes)', '回声效果'], ['FX 8 (sci-fi)', '科幻效果'],
  ['Sitar', '西塔琴'], ['Banjo', '班卓琴'], ['Shamisen', '三味线'], ['Koto', '日本筝'],
  ['Kalimba', '卡林巴'], ['Bagpipe', '风笛'], ['Fiddle', '民间提琴'], ['Shanai', '沙奈管'],
  ['Tinkle Bell', '叮当铃'], ['Agogo', '阿哥哥铃'], ['Steel Drums', '钢鼓'],
  ['Woodblock', '木鱼'], ['Taiko Drum', '太鼓'], ['Melodic Tom', '旋律通鼓'],
  ['Synth Drum', '合成鼓'], ['Reverse Cymbal', '反向镲'],
  ['Guitar Fret Noise', '吉他换把噪音'], ['Breath Noise', '呼吸声'], ['Seashore', '海浪'],
  ['Bird Tweet', '鸟鸣'], ['Telephone Ring', '电话铃'], ['Helicopter', '直升机'],
  ['Applause', '掌声'], ['Gunshot', '枪声'],
]

const FAMILIES = [
  ['Piano', '钢琴'], ['Chromatic Percussion', '半音打击乐'], ['Organ', '风琴'],
  ['Guitar', '吉他'], ['Bass', '贝斯'], ['Strings', '弦乐'], ['Ensemble', '合奏'],
  ['Brass', '铜管'], ['Reed', '簧管'], ['Pipe', '吹管'], ['Synth Lead', '合成主音'],
  ['Synth Pad', '合成铺底'], ['Synth Effects', '合成效果'], ['Ethnic', '民族乐器'],
  ['Percussive', '打击乐'], ['Sound Effects', '音效'],
]

export const GM_FAMILIES = FAMILIES.map(([en, zh], i) => ({ index: i, en, zh }))

export const GM_PROGRAMS = PROGRAMS.map(([en, zh], program) => ({
  program,
  display: program + 1,
  en,
  zh,
  family: GM_FAMILIES[Math.floor(program / 8)],
}))

// The standard GM kit. Kits are addressed by isDrum; program 0 selects the standard kit.
export const DRUM_KIT = { program: 0, en: 'Standard Drum Kit', zh: '标准鼓组' }

const DRUM_NOTES = [
  [35, 'Acoustic Bass Drum', '原声底鼓'], [36, 'Bass Drum 1 (Kick)', '底鼓'],
  [37, 'Side Stick', '鼓边敲击'], [38, 'Acoustic Snare', '原声军鼓'], [39, 'Hand Clap', '拍手'],
  [40, 'Electric Snare', '电军鼓'], [41, 'Low Floor Tom', '低落地通鼓'],
  [42, 'Closed Hi-Hat', '闭镲'], [43, 'High Floor Tom', '高落地通鼓'],
  [44, 'Pedal Hi-Hat', '踩镲'], [45, 'Low Tom', '低通鼓'], [46, 'Open Hi-Hat', '开镲'],
  [47, 'Low-Mid Tom', '中低通鼓'], [48, 'Hi-Mid Tom', '中高通鼓'],
  [49, 'Crash Cymbal 1', '强音镲 1'], [50, 'High Tom', '高通鼓'],
  [51, 'Ride Cymbal 1', '叮叮镲 1'], [52, 'Chinese Cymbal', '中国镲'],
  [53, 'Ride Bell', '叮叮镲帽'], [54, 'Tambourine', '铃鼓'], [55, 'Splash Cymbal', '水镲'],
  [56, 'Cowbell', '牛铃'], [57, 'Crash Cymbal 2', '强音镲 2'], [58, 'Vibraslap', '颤击器'],
  [59, 'Ride Cymbal 2', '叮叮镲 2'], [60, 'Hi Bongo', '高音邦戈鼓'],
  [61, 'Low Bongo', '低音邦戈鼓'], [62, 'Mute Hi Conga', '闷音高康加鼓'],
  [63, 'Open Hi Conga', '开音高康加鼓'], [64, 'Low Conga', '低康加鼓'],
  [65, 'High Timbale', '高音天巴鼓'], [66, 'Low Timbale', '低音天巴鼓'],
  [67, 'High Agogo', '高音阿哥哥'], [68, 'Low Agogo', '低音阿哥哥'], [69, 'Cabasa', '卡巴萨'],
  [70, 'Maracas', '沙槌'], [71, 'Short Whistle', '短哨'], [72, 'Long Whistle', '长哨'],
  [73, 'Short Guiro', '短刮葫'], [74, 'Long Guiro', '长刮葫'], [75, 'Claves', '响棒'],
  [76, 'Hi Wood Block', '高音木鱼'], [77, 'Low Wood Block', '低音木鱼'],
  [78, 'Mute Cuica', '闷音奎卡'], [79, 'Open Cuica', '开音奎卡'],
  [80, 'Mute Triangle', '闷音三角铁'], [81, 'Open Triangle', '开音三角铁'],
]
export const GM_DRUM_NOTES = DRUM_NOTES.map(([note, en, zh]) => ({ note, en, zh }))
export const drumNoteName = (note) => GM_DRUM_NOTES.find((d) => d.note === note)

// Quick presets from the spec; the full catalog stays one click away.
export const INSTRUMENT_PRESETS = [
  { label: '原声钢琴', en: 'Acoustic Piano', program: 0, isDrum: false },
  { label: '电钢琴', en: 'Electric Piano', program: 4, isDrum: false },
  { label: '尼龙弦吉他', en: 'Nylon Guitar', program: 24, isDrum: false },
  { label: '指弹贝斯', en: 'Finger Bass', program: 33, isDrum: false },
  { label: '合成贝斯', en: 'Synth Bass', program: 38, isDrum: false },
  { label: '弦乐', en: 'Strings', program: 48, isDrum: false },
  { label: '合成 Pad', en: 'Synth Pad', program: 89, isDrum: false },
  { label: '标准鼓组', en: 'Standard Drum Kit', program: 0, isDrum: true },
]

export function instrumentName({ program, isDrum }, lang = 'zh') {
  if (isDrum) return DRUM_KIT[lang]
  return GM_PROGRAMS[program]?.[lang] ?? `Program ${program + 1}`
}

export function instrumentLabel({ program, isDrum }, lang = 'zh') {
  if (isDrum) return lang === 'zh' ? `${DRUM_KIT.zh} · Drums` : DRUM_KIT.en
  const p = GM_PROGRAMS[program]
  return lang === 'zh' ? `${p.display}. ${p.zh} · ${p.en}` : `${p.display}. ${p.en}`
}

/** Case-insensitive search over Chinese/English names, family names and 1-based numbers. */
export function searchPrograms(query) {
  const q = query.trim().toLowerCase()
  if (!q) return GM_PROGRAMS
  return GM_PROGRAMS.filter((p) => String(p.display) === q
    || p.en.toLowerCase().includes(q) || p.zh.includes(q)
    || p.family.en.toLowerCase().includes(q) || p.family.zh.includes(q))
}

export function drumKitMatches(query) {
  const q = query.trim().toLowerCase()
  return !q || ['drum', 'drums', 'kit', '鼓', '鼓组', 'percussion'].some((w) => w.includes(q) || q.includes(w))
    || DRUM_KIT.zh.includes(q)
}
