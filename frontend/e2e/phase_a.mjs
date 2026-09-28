// Phase A browser verification (Playwright driving installed Chrome, or Playwright's WebKit).
// Produces JSON evidence, screenshots, saved projects and exported MIDI in --out.
// These are automated real-browser checks; they do not replace a human listening test.
//
//   node e2e/phase_a.mjs --browser chrome --url http://localhost:5173/ --out ../data/phase_a/evidence/chrome-5173
//   node e2e/phase_a.mjs --browser webkit --url http://127.0.0.1:8000/ --out ../data/phase_a/evidence/webkit-8000
//   add --perf 300 for the 8-track / 5-minute loop run (A-09)

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { chromium, webkit } from 'playwright'

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []))
const BROWSER = args.browser ?? 'chrome'
const URL = args.url ?? 'http://localhost:5173/'
const OUT = resolve(args.out ?? `../data/phase_a/evidence/${BROWSER}`)
const PERF_SECONDS = Number(args.perf ?? 0)
const ONLY = args.only ? args.only.split(',') : null
const ROOT = resolve(import.meta.dirname, '../..')
const SF2 = resolve(ROOT, 'data/phase_a/soundfonts/GeneralUser-GS.sf2')
const FIX = resolve(ROOT, 'data/phase_a/fixtures')
mkdirSync(OUT, { recursive: true })

const results = []
const log = (...a) => console.log(`[${BROWSER}]`, ...a)
function check(id, pass, detail) {
  results.push({ id, pass: !!pass, detail })
  log(pass ? 'PASS' : 'FAIL', id, typeof detail === 'string' ? detail : JSON.stringify(detail))
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = BROWSER === 'webkit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true })
const page = await context.newPage()
const consoleErrors = []
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.stack ?? e.message}`))
page.on('response', (r) => { if (r.status() >= 400) consoleErrors.push(`HTTP ${r.status()} ${r.url()}`) })

// --- helpers ---------------------------------------------------------------------------
const flux = (fn, arg) => page.evaluate(fn, arg)
const project = () => flux(() => window.__flux.project)
const level = () => flux(() => window.__flux.engine.level())
async function peakLevel(ms = 200) {
  let peak = 0
  for (let t = 0; t < ms; t += 20) { peak = Math.max(peak, await level()); await sleep(20) }
  return peak
}
const btn = (name) => page.getByRole('button', { name, exact: true })
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` })

async function boot() {
  await page.goto(URL)
  await btn('启用声音').click()
  await page.waitForFunction(() => window.__flux?.engine.synth, null, { timeout: 30000 })
  await page.waitForFunction(() => ['ready', 'needs-soundbank'].includes(window.__flux.engine.status), null, { timeout: 60000 })
  if (await flux(() => window.__flux.engine.status) !== 'ready') {
    await page.setInputFiles('input[accept=".sf2,.sf3,.dls"]', SF2)
    await page.waitForFunction(() => window.__flux.engine.status === 'ready', null, { timeout: 60000 })
  }
}

async function keyboardOn() {
  const on = await page.locator('.keyboard-panel.on').count()
  if (!on) await page.getByRole('button', { name: /^电脑键盘/ }).click()
  await page.locator('.brand').click() // focus away from inputs
}
async function mode(name) { await page.getByRole('radio', { name }).click(); await page.locator('.brand').click() }
async function chord(codes, holdMs = 150) {
  for (const c of codes) await page.keyboard.down(c)
  await sleep(holdMs)
  for (const c of codes) await page.keyboard.up(c)
  await sleep(40)
}
async function importFile(name) {
  await page.setInputFiles('input[accept=".mid,.midi,audio/midi"]', `${FIX}/${name}`)
  await sleep(300)
}
async function newProject() { await btn('新建').click(); await sleep(100) }
async function setBpm(bpm) {
  const input = page.getByLabel('速度（四分音符 BPM）')
  await input.fill(String(bpm))
  await input.press('Enter')
  await page.locator('.brand').click()
}
async function download(trigger, name) {
  const [d] = await Promise.all([page.waitForEvent('download'), trigger()])
  const path = `${OUT}/${name}`
  await d.saveAs(path)
  return path
}
const liveSymbol = () => page.locator('[data-testid=live-chord-symbol]').textContent({ timeout: 2000 }).catch(() => null)
async function openEditorRange(startBar, endBar) {
  // Drag across the chord lane (y = ruler 22 + 15) from startBar to endBar.
  const k = 56 / 960
  const bar = await flux(() => { const ts = window.__flux.project.timeSignature; return 960 * ts.numerator * 4 / ts.denominator })
  const svg = page.locator('.tl-head-svg')
  await page.locator('.timeline-scroll').evaluate((el, x) => { el.scrollLeft = Math.max(0, x - 120) }, (startBar - 1) * bar * k)
  const box = await svg.boundingBox()
  await page.mouse.move(box.x + (startBar - 1) * bar * k + 3, box.y + 37)
  await page.mouse.down()
  await page.mouse.move(box.x + (endBar - 1) * bar * k - 1, box.y + 37, { steps: 4 })
  await page.mouse.up()
  await page.locator('[data-testid=chord-editor]').waitFor()
}
async function manualChord(root, typeLabel, bass = '') {
  const ed = page.locator('[data-testid=chord-editor]')
  await ed.locator('.root-grid button', { hasText: new RegExp(`^${root}$`) }).click()
  await ed.locator('.type-grid button', { hasText: typeLabel }).first().click()
  if (bass) await ed.getByLabel('低音').selectOption(bass)
  const symbol = await ed.locator('[data-testid=editor-symbol]').textContent()
  await ed.getByRole('button', { name: /写入和弦轨|更新/ }).click()
  return symbol
}
const romans = () => page.locator('[data-testid=roman]').evaluateAll((els) => els.map((e) => e.dataset.display))
const suggestionLabels = () => page.locator('[data-testid=chord-suggestion]').evaluateAll((els) => els.map((e) => e.dataset.label))
async function confirmKey(label) {
  await page.getByLabel('手动选择调性').selectOption({ label })
}
async function tapChannels(trackIds) {
  return flux((ids) => {
    const { engine } = window.__flux
    window.__taps = ids.map((id) => {
      const a = engine.ctx.createAnalyser()
      a.fftSize = 1024
      engine.synth.connectChannel(a, engine.channelOf(id))
      return a
    })
  }, trackIds)
}
const tapLevels = () => flux(() => window.__taps.map((a) => {
  const b = new Float32Array(a.fftSize)
  a.getFloatTimeDomainData(b)
  return Math.sqrt(b.reduce((s, v) => s + v * v, 0) / b.length)
}))
async function spyNotes() {
  await flux(() => {
    const { engine } = window.__flux
    window.__spy = { on: [], off: [], click: [], live: 0 }
    const s = engine.sink
    const [on, off, click] = [s.noteOn, s.noteOff, s.click]
    s.noteOn = (t, p, v, time) => { window.__spy.on.push({ t, p, time }); on(t, p, v, time) }
    s.noteOff = (t, p, time) => { window.__spy.off.push({ t, p, time }); off(t, p, time) }
    s.click = (a, time) => { window.__spy.click.push({ a, time }); click(a, time) }
    const live = engine.liveNoteOn.bind(engine)
    engine.liveNoteOn = (...x) => { window.__spy.live++; return live(...x) }
  })
}
const spy = () => flux(() => window.__spy)

// --- checks ----------------------------------------------------------------------------
const run = async (name, fn) => {
  if (ONLY && !ONLY.includes(name)) return
  try { await fn() } catch (e) { check(`${name}:error`, false, String(e.stack ?? e).slice(0, 800)) }
}

await boot()
const info = await flux(() => ({ ...window.__flux.engine.info(), userAgent: navigator.userAgent }))
check('A-01:engine-ready', info.status === 'ready' && info.coverage.melodic === 128 && info.coverage.drumKit, info)
await spyNotes()

await run('A-01', async () => {
  await page.locator('.track .instrument').first().click()
  const dialog = page.locator('dialog.picker')
  const rows = await dialog.locator('.catalog li').count()
  const presets = await dialog.locator('.preset-row li').count()
  await dialog.getByLabel('搜索音色').fill('贝斯')
  const bass = await dialog.locator('.catalog li').count()
  await dialog.getByLabel('搜索音色').fill('')
  await dialog.locator('.preset-row li').first().getByRole('button', { name: /试听/ }).click()
  await sleep(250)
  const previewLevel = await level()
  await dialog.getByRole('button', { name: '关闭' }).click()
  check('A-01:catalog', rows === 129 && presets === 8 && bass >= 8, { rows, presets, bassSearch: bass })
  check('A-01:preview-audible', previewLevel > 1e-4, { previewLevel })
  // One program per family plus the drum kit, played through the computer keyboard.
  await keyboardOn()
  const silent = []
  for (let fam = 0; fam < 16; fam++) {
    const program = fam * 8 + 1
    await page.locator('.track .instrument').first().click()
    await page.locator('dialog.picker').getByLabel('搜索音色').fill(String(program + 1))
    await page.locator('dialog.picker .catalog li .choose').first().click()
    await page.keyboard.down('KeyA')
    const l = await peakLevel(250)
    await page.keyboard.up('KeyA'); await sleep(60)
    const got = (await project()).tracks[0].program
    if (!(l > 1e-4) || got !== program) silent.push({ program: program + 1, level: l, got })
  }
  await page.locator('.track .instrument').first().click()
  await page.locator('dialog.picker').getByLabel('搜索音色').fill('鼓')
  await page.locator('dialog.picker .catalog li .choose').last().click()
  await page.keyboard.press('KeyZ'); await page.keyboard.press('KeyZ') // A = MIDI 36 (kick)
  const drums = []
  for (const code of ['KeyA', 'KeyD', 'KeyJ']) { // 36 kick, 40 snare, 47 tom
    await page.keyboard.down(code)
    drums.push(await peakLevel(200))
    await page.keyboard.up(code); await sleep(80)
  }
  await page.keyboard.press('KeyX'); await page.keyboard.press('KeyX')
  check('A-01:families-and-drums-audible', !silent.length && drums.every((l) => l > 1e-4) && (await project()).tracks[0].isDrum,
    { silent, drumLevels: drums })
  await newProject()
})

await run('A-02', async () => {
  await importFile('a02_same_program.mid')
  const p = await project()
  const ids = p.tracks.map((t) => t.id)
  const channels = await flux(() => window.__flux.engine.info().channels)
  check('A-02:separate-channels', new Set(ids.map((id) => channels[id])).size === 4 && p.tracks[0].program === p.tracks[1].program,
    { programs: p.tracks.map((t) => t.program), channels: ids.map((id) => channels[id]) })
  await tapChannels(ids)
  await btn('播放').click()
  await sleep(700)
  const both = await tapLevels() // 0.7 s: A and B both hold C4
  await sleep(750)
  const afterAOff = await tapLevels() // 1.45 s: A released at 1.0 s, B continues to 2.0 s
  await btn('停止').click()
  await sleep(400)
  await page.getByLabel(`音量 ${p.tracks[0].name}`).fill('0')
  await btn('播放').click(); await sleep(700)
  const volZero = await tapLevels()
  await btn('停止').click(); await sleep(300)
  await page.getByLabel(`音量 ${p.tracks[0].name}`).fill('100')
  await page.getByLabel(`静音 ${p.tracks[1].name}`).click()
  await page.getByLabel(`静音 ${p.tracks[3].name}`).click()
  await btn('播放').click(); await sleep(700)
  const muted = await tapLevels()
  await btn('停止').click(); await sleep(300)
  await page.getByLabel(`静音 ${p.tracks[1].name}`).click()
  await page.getByLabel(`静音 ${p.tracks[3].name}`).click()
  await page.getByLabel(`独奏 ${p.tracks[1].name}`).click()
  await page.getByLabel(`独奏 ${p.tracks[2].name}`).click()
  await page.getByLabel(`静音 ${p.tracks[2].name}`).click() // Mute wins over Solo
  await btn('播放').click(); await sleep(700)
  const solo = await tapLevels()
  await btn('停止').click(); await sleep(1500)
  // Transport channels must be empty after stop; other channels may still hold an inaudible
  // natural decay tail (GM drums ignore note-off), so audibility is checked by level.
  const perChannel = await flux(() => window.__flux.engine.synth.midiChannels.map((c, i) => [i, c.voiceCount]).filter(([, n]) => n))
  const transportChannels = Object.values(channels)
  const voicesAfterStop = perChannel.filter(([ch]) => transportChannels.includes(ch)).reduce((s, [, n]) => s + n, 0)
  const levelAfterStop = await level()
  const r = (x) => x.map((v) => +v.toExponential(2))
  check('A-02:no-cross-note-off', both[0] > 1e-3 && both[1] > 1e-3 && afterAOff[1] > 5 * afterAOff[0], { both: r(both), afterAOff: r(afterAOff) })
  check('A-02:independent-volume', volZero[0] < 1e-5 && volZero[1] > 1e-3, { volZero: r(volZero) })
  check('A-02:mute', muted[1] === 0 && muted[3] === 0 && muted[0] > 1e-3 && muted[2] > 1e-4, { muted: r(muted) })
  check('A-02:solo-mute-priority', solo[1] > 1e-3 && solo[0] === 0 && solo[2] === 0 && solo[3] === 0, { solo: r(solo) })
  check('A-02:no-hanging-voices', voicesAfterStop === 0 && levelAfterStop < 1e-4, { voicesAfterStop, levelAfterStop, otherChannelTails: perChannel })
  await flux(() => window.__taps.forEach((a) => a.disconnect()))
  await newProject()
})

await run('A-03', async () => {
  await keyboardOn()
  const nameBox = page.getByLabel('轨道名称').first()
  const spyBefore = (await spy()).live
  await nameBox.click(); await nameBox.fill(''); await page.keyboard.type('ASDF')
  await page.getByLabel('速度（四分音符 BPM）').click(); await page.keyboard.press('KeyA')
  await page.locator('.track .instrument').first().click()
  await page.locator('dialog.picker').getByLabel('搜索音色').type('asd')
  await page.locator('dialog.picker').getByRole('button', { name: '关闭' }).click()
  await sleep(100)
  const typedName = (await project()).tracks[0].name
  const liveDuringTyping = (await spy()).live - spyBefore
  check('A-03:no-sound-while-typing', liveDuringTyping === 0 && typedName === 'ASDF', { liveDuringTyping, typedName })
  await setBpm(120)
  await page.locator('.brand').click()
  // Key repeat: holding A sends repeats; only one note starts.
  const liveBefore = (await spy()).live
  await page.keyboard.down('KeyA'); await page.keyboard.down('KeyA'); await page.keyboard.down('KeyA')
  await page.keyboard.up('KeyA')
  check('A-03:repeat-ignored', (await spy()).live - liveBefore === 1, { starts: (await spy()).live - liveBefore })
  // Octave change while held, then blur while held: nothing hangs. (Clear earlier audition tails first.)
  await flux(() => window.__flux.engine.synth.controllerChange(14, 120, 0))
  await page.keyboard.down('KeyA'); await page.keyboard.press('KeyX'); await page.keyboard.down('KeyS')
  await page.keyboard.up('KeyA'); await page.keyboard.up('KeyS'); await page.keyboard.press('KeyZ')
  await sleep(1500)
  const afterOctave = await flux(() => [window.__flux.engine.liveCounts.size, window.__flux.engine.synth.midiChannels[14].voiceCount, window.__flux.engine.level()])
  await page.keyboard.down('KeyA'); await page.keyboard.down('KeyD')
  await flux(() => window.dispatchEvent(new Event('blur')))
  await sleep(1500)
  const afterBlur = await flux(() => [window.__flux.engine.liveCounts.size, window.__flux.engine.synth.midiChannels[14].voiceCount, window.__flux.engine.level(), window.__flux.engine.info().status])
  await page.keyboard.up('KeyA'); await page.keyboard.up('KeyD')
  check('A-03:octave-release', afterOctave[0] === 0 && afterOctave[1] === 0 && afterOctave[2] < 1e-4, { liveHeld: afterOctave[0], liveVoices: afterOctave[1], level: afterOctave[2] })
  check('A-03:blur-release', afterBlur[0] === 0 && afterBlur[1] === 0 && afterBlur[2] < 1e-4, { liveHeld: afterBlur[0], liveVoices: afterBlur[1], level: afterBlur[2] })

  // Real-time: 90 BPM, one-bar count-in, 4 bars of quarter notes (16 presses).
  await setBpm(90)
  await btn('录音').click()
  const beatMs = 60000 / 90
  await sleep(beatMs * 4 + 60) // count-in
  const melody = ['KeyA', 'KeyD', 'KeyG', 'KeyK', 'KeyJ', 'KeyG', 'KeyD', 'KeyS', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyF', 'KeyD', 'KeyA']
  const t0 = Date.now()
  for (let i = 0; i < 16; i++) {
    const due = t0 + i * beatMs
    await sleep(Math.max(0, due - Date.now()))
    await page.keyboard.down(melody[i])
    await sleep(beatMs * 0.6)
    await page.keyboard.up(melody[i])
  }
  await sleep(beatMs * 0.3)
  await btn('停止').click()
  await sleep(300)
  const notes = (await project()).tracks[0].clips[0].notes.slice().sort((a, b) => a.startTick - b.startTick)
  const deviation = notes.map((n, i) => n.startTick - (notes[0].startTick + i * 960))
  const maxDev = Math.max(...deviation.map(Math.abs))
  check('A-03:record-4-bars', notes.length === 16 && notes[0].startTick < 480 && maxDev < 240 && notes.every((n) => n.durationTick > 300),
    { count: notes.length, firstStart: notes[0]?.startTick, maxDeviationTicks: maxDev, last: notes.at(-1) })
  await shot('a03-recorded-4-bars-1280')
  // Playback of the take is audible.
  await btn('播放').click(); await sleep(800)
  const playLevel = await level()
  await btn('停止').click()
  check('A-03:playback', playLevel > 1e-4, { playLevel })
  const recordedTicks = JSON.stringify(notes.map((n) => [n.pitch, n.startTick, n.durationTick]))

  // Step input: one 1/8 chord, group release advances once; rest advances without notes.
  await btn('回到开头').click()
  await mode('步进')
  await page.getByLabel('步进时值').selectOption('1/8')
  const before = (await project()).tracks[0].clips[0].notes.length
  await page.getByLabel('选择轨道 ' + (await project()).tracks[0].name).click()
  await btn('回到开头').click()
  await page.locator('.brand').click()
  await page.keyboard.down('KeyA'); await page.keyboard.down('KeyD'); await page.keyboard.up('KeyA')
  await page.keyboard.down('KeyG'); await page.keyboard.up('KeyD'); await page.keyboard.up('KeyG')
  await sleep(100)
  const head1 = await flux(() => window.__flux.playhead)
  await btn('休止／前进一步').click()
  const head2 = await flux(() => window.__flux.playhead)
  const added = (await project()).tracks[0].clips[0].notes.slice(before)
  check('A-03:step-chord', added.length === 3 && added.every((n) => n.startTick === 0 && n.durationTick === 480) && head1 === 480 && head2 === 960,
    { added: added.map((n) => [n.pitch, n.startTick, n.durationTick]), cursorAfterGroup: head1, cursorAfterRest: head2 })
  await mode('试听')
  // Tempo/meter change after recording keeps every tick (A-04).
  await setBpm(60)
  await btn('3/4').click(); await btn('6/8').click()
  const after = JSON.stringify((await project()).tracks[0].clips[0].notes.slice(0, 16).sort((a, b) => a.startTick - b.startTick).map((n) => [n.pitch, n.startTick, n.durationTick]))
  check('A-04:ticks-kept-after-bpm-ts-change', after === recordedTicks, 'notes identical after 90→60 BPM and 4/4→3/4→6/8')
  await newProject()
})

await run('A-04', async () => {
  await importFile('ch05_c_g_am_f.mid') // 100 BPM in file
  await setBpm(120)
  await flux(() => { window.__spy.on.length = 0; window.__spy.off.length = 0 })
  await btn('播放').click(); await sleep(2300); await btn('停止').click()
  const at120 = await spy()
  await setBpm(60)
  await sleep(300)
  await flux(() => { window.__spy.on.length = 0; window.__spy.off.length = 0 })
  await btn('播放').click(); await sleep(4400); await btn('停止').click()
  const at60 = await spy()
  const dur = (s) => {
    const on = s.on.find((e) => e.p === 48)
    const off = s.off.find((e) => e.p === 48 && e.time > on.time)
    return off.time - on.time
  }
  const d120 = dur(at120), d60 = dur(at60)
  check('A-04:120-to-60-doubles', Math.abs(d120 - 2) < 1e-6 && Math.abs(d60 - 4) < 1e-6, { bar1At120s: d120, bar1At60s: d60 })
  for (const [label, expect] of [['3/4', ['bar', 'beat', 'beat', 'bar', 'beat', 'beat']], ['6/8', ['bar', 'beat', 'bar', 'beat']]]) {
    await btn(label).click()
    await setBpm(120)
    await page.getByRole('button', { name: '节拍器' }).click()
    await flux(() => { window.__spy.click.length = 0 })
    await btn('播放').click(); await sleep(label === '3/4' ? 2800 : 2800); await btn('停止').click()
    await page.getByRole('button', { name: '节拍器' }).click()
    const clicks = (await spy()).click
    const accents = clicks.map((c) => c.a).slice(0, expect.length)
    const gaps = clicks.slice(1, 4).map((c, i) => +(c.time - clicks[i].time).toFixed(4))
    check(`A-04:metronome-${label}`, JSON.stringify(accents) === JSON.stringify(expect), { accents, gapsSeconds: gaps })
  }
  await newProject()
})

await run('CH-01', async () => {
  await keyboardOn()
  const rev0 = (await project()).revision
  await page.keyboard.down('KeyA'); await page.keyboard.down('KeyD'); await page.keyboard.down('KeyG')
  await sleep(200)
  const c = await liveSymbol()
  await page.keyboard.up('KeyA'); await page.keyboard.up('KeyD'); await page.keyboard.up('KeyG')
  await page.keyboard.press('KeyZ') // A = 48: D=52 (E3), G=55 (G3), K=60 (C4)
  await page.keyboard.down('KeyD'); await page.keyboard.down('KeyG'); await page.keyboard.down('KeyK')
  await sleep(200)
  const ce = await liveSymbol()
  await shot('ch01-live-chord-c-over-e-1280')
  await page.keyboard.up('KeyD'); await page.keyboard.up('KeyG'); await page.keyboard.up('KeyK')
  await page.keyboard.press('KeyX')
  const rev1 = (await project()).revision
  const perf = await flux(() => window.__flux.perf.summary())
  check('CH-01', c === 'C' && ce === 'C/E' && rev0 === rev1, { first: c, second: ce, projectRevisionUnchanged: rev0 === rev1,
    keyToNoteOnMs: perf.keyToNoteOnMs, liveChordUpdateMs: perf.liveChordUpdateMs })
})

await run('CH-02', async () => {
  await keyboardOn()
  await mode('步进')
  await page.getByLabel('步进时值').selectOption('1/4')
  await btn('回到开头').click(); await page.locator('.brand').click()
  await chord(['KeyA', 'KeyD', 'KeyG'])
  await mode('试听')
  const sugg = page.locator('[data-testid=chord-suggestion]')
  await sugg.first().waitFor()
  const stepLabel = (await suggestionLabels())[0]
  await sugg.first().click()
  await page.locator('[data-testid=suggestion-box]').getByRole('button', { name: '采用' }).first().click()
  const adopted = (await project()).chordTrack
  check('CH-02:step-suggest-adopt', stepLabel.trim() === 'C' && adopted.length === 1 && adopted[0].status === 'confirmed'
    && adopted[0].source === 'midi_detected' && adopted[0].chord.rootPc === 0, { stepLabel, adopted: adopted.map((e) => [e.startTick, e.durationTick, e.source]) })
  await newProject()
  await importFile('ch02_block_and_line.mid')
  const labels = await suggestionLabels()
  const h = await flux(() => window.__flux.harmony.suggestions.map((s) => [s.startTick, s.endTick, s.label, s.detection.status]))
  await shot('ch02-imported-block-and-line-1280')
  await page.getByLabel('选择轨道 Drums').click()
  const drumSuggestions = await sugg.count()
  check('CH-02:import', labels.length === 1 && labels[0].trim() === 'C' && drumSuggestions === 0,
    { suggestions: h, drumTrackSuggestions: drumSuggestions })
  await newProject()
})

await run('CH-03', async () => {
  await keyboardOn()
  await page.keyboard.down('KeyA'); await page.keyboard.down('KeyD'); await page.keyboard.down('KeyG'); await page.keyboard.down('KeyH')
  await sleep(200)
  const text = await page.locator('[data-testid=live-chord]').textContent()
  const live = await flux(() => window.__flux.liveChord.detection.candidates.map((c) => c.typeId + '@' + c.chord.rootPc))
  // Fast change: release two keys, press two others without releasing everything.
  await page.keyboard.up('KeyH'); await page.keyboard.up('KeyA')
  await page.keyboard.down('KeyF'); await page.keyboard.down('KeyK')
  await sleep(40)
  await page.keyboard.up('KeyD'); await page.keyboard.up('KeyG')
  await sleep(200)
  const afterChange = await flux(() => window.__flux.liveChord.pitches)
  await flux(() => window.dispatchEvent(new Event('blur')))
  await sleep(200)
  const afterBlur = await flux(() => ({ active: window.__flux.liveChord.active, held: window.__flux.engine.liveCounts.size }))
  await page.keyboard.up('KeyF'); await page.keyboard.up('KeyK')
  check('CH-03', /C6/.test(text) && /Am7\/C/.test(text) && /多种解释/.test(text) && JSON.stringify(afterChange) === '[65,72]'
    && afterBlur.active === false && afterBlur.held === 0, { display: text, candidates: live, afterChange, afterBlur })
})

await run('CH-04', async () => {
  await newProject()
  await openEditorRange(1, 2)
  const ed = page.locator('[data-testid=chord-editor]')
  const seen = []
  for (const label of ['大三', '小三', '减三', '增三', '属七', '大七', '小七', '挂二', '挂四', '加九', '小加九', '加十一', '大六', '小六', '属九']) {
    await ed.locator('.type-grid button', { hasText: label }).first().click()
    const symbol = await ed.locator('[data-testid=editor-symbol]').textContent()
    const tones = await ed.locator('.chord-summary .muted').textContent()
    seen.push(`${symbol} ${tones.replace(/^ = /, '')}`)
  }
  await ed.locator('.type-grid button', { hasText: '加九' }).first().click()
  await ed.getByRole('button', { name: '试听' }).click()
  await sleep(250)
  const previewLevel = await level()
  const symbol = await manualChord('C', '加九')
  await openEditorRange(2, 3)
  const ninth = await manualChord('C', '属九')
  await openEditorRange(3, 4)
  const slash = await manualChord('C', '大三', 'E')
  await openEditorRange(4, 5)
  const sus = await manualChord('C', '挂四')
  const events = (await project()).chordTrack
  // Drag the right edge of the first chord from bar 2 to bar 2.3 (resize).
  await page.locator('.timeline-scroll').evaluate((el) => { el.scrollLeft = 0 })
  const svg = await page.locator('.tl-head-svg').boundingBox()
  const k = 56 / 960
  await page.mouse.move(svg.x + 3840 * k - 2, svg.y + 37)
  await page.mouse.down(); await page.mouse.move(svg.x + (3840 + 960) * k, svg.y + 37, { steps: 5 }); await page.mouse.up()
  const resized = (await project()).chordTrack.map((e) => [e.startTick, e.durationTick])
  const byStart = Object.fromEntries(events.map((e) => [e.startTick, e.chord]))
  await shot('ch04-manual-chords-1280')
  check('CH-04:types', seen.length === 15, seen)
  check('CH-04:add9-9-sus-slash', symbol === 'Cadd9' && ninth === 'C9' && slash === 'C/E' && sus === 'Csus4'
    && byStart[0].additions.includes('add9') && byStart[3840].quality === '9' && byStart[7680].bassPc === 4 && byStart[7680].rootPc === 0
    && !seen.find((s) => s.startsWith('Cadd9')).includes('B♭') && seen.find((s) => s.startsWith('C9')).includes('B♭')
    && !/\bE\b/.test(seen.find((s) => s.startsWith('Csus4')).split(' ').slice(1).join(' ')),
  { symbols: [symbol, ninth, slash, sus], stored: events.map((e) => e.chord) })
  check('CH-04:preview-and-resize', previewLevel > 1e-4 && resized[0][1] === 4800 && resized[1][0] === 4800,
    { previewLevel, resized })
})

await run('CH-05', async () => {
  await newProject()
  await importFile('ch05_c_g_am_f.mid')
  await btn('采用全部建议（4）').click()
  await confirmKey('C 大调')
  const r1 = await romans()
  const labels1 = await page.locator('[data-testid=progressions]').textContent()
  await shot('ch05-c-g-am-f-in-c-1280')
  // Add Dm7–G7–Cmaj7 in bars 5–7 manually.
  for (const [bar, root, type] of [[5, 'D', '小七'], [6, 'G', '属七'], [7, 'C', '大七']]) {
    await openEditorRange(bar, bar + 1)
    await manualChord(root, type)
  }
  const r2 = await romans()
  const labels2 = await page.locator('[data-testid=progressions]').textContent()
  const chordsBefore = JSON.stringify((await project()).chordTrack.map((e) => e.chord))
  const notesBefore = JSON.stringify((await project()).tracks.map((t) => t.clips[0].notes))
  await confirmKey('G 大调')
  const r3 = await romans()
  const chordsAfter = JSON.stringify((await project()).chordTrack.map((e) => e.chord))
  const notesAfter = JSON.stringify((await project()).tracks.map((t) => t.clips[0].notes))
  check('CH-05', r1.slice(0, 4).join(' ') === 'I V vi IV' && /1–5–6m–4/.test(labels1)
    && r2.slice(4).join(' ') === 'ii7 V7 Imaj7' && /ii–V–I/.test(labels2) && r3[0] === 'IV' && chordsBefore === chordsAfter && notesBefore === notesAfter,
  { inC: r2, inG: r3, labels: labels2.slice(0, 200) })
})

await run('CH-06', async () => {
  await newProject()
  for (const [bar, root, type] of [[1, 'C', '大三'], [2, 'D', '属七'], [3, 'G', '大三'], [4, 'C', '大三'], [5, 'F', '大三'], [6, 'F', '小三'], [7, 'C', '大三']]) {
    await openEditorRange(bar, bar + 1)
    await manualChord(root, type)
  }
  const inferred = await page.locator('[data-testid=key-status]').textContent()
  await confirmKey('C 大调')
  const r = await romans()
  const labels = await page.locator('[data-testid=progressions]').textContent()
  await shot('ch06-secondary-borrowed-1280')
  await newProject()
  await openEditorRange(1, 2)
  await manualChord('C', '大三')
  const isolated = await page.locator('[data-testid=key-status]').textContent()
  const isolatedRomans = await romans()
  check('CH-06', r.join(' ') === 'I V7/V V I IV iv I' && /副属和弦/.test(labels) && /借用小下属/.test(labels) && /借用和弦/.test(labels)
    && /证据不足/.test(isolated) && isolatedRomans.length === 0 && /C 大调/.test(inferred),
  { romans: r, inferredBeforeConfirm: inferred, isolated, isolatedRomans })
})

await run('CH-07', async () => {
  await newProject()
  await importFile('ch05_c_g_am_f.mid')
  await btn('采用全部建议（4）').click()
  const confirmed = JSON.stringify((await project()).chordTrack.map((e) => [e.startTick, e.durationTick, e.chord, e.status]))
  // Edit a source note of bar 1 (C chord): move the top C (72) up to D (74) by dragging.
  const note = page.locator('[data-testid=note][data-pitch="72"][data-start="0"]')
  await note.scrollIntoViewIfNeeded()
  const box = await note.boundingBox()
  await page.mouse.move(box.x + 4, box.y + box.height / 2)
  await page.mouse.down(); await page.mouse.move(box.x + 4, box.y + box.height / 2 - 24, { steps: 4 }); await page.mouse.up()
  const moved = (await project()).tracks[0].clips[0].notes.find((n) => n.startTick === 0 && n.pitch === 74)
  const stillConfirmed = JSON.stringify((await project()).chordTrack.map((e) => [e.startTick, e.durationTick, e.chord, e.status]))
  const staleCount = await page.locator('.chord.stale').count()
  await page.locator('.chord.stale').first().click({ position: { x: 20, y: 10 } })
  const staleText = await page.locator('[data-testid=stale-box]').textContent()
  await shot('ch07-stale-source-1280')
  // Chord edit then undo/redo restores structure and status exactly.
  const ed = page.locator('[data-testid=chord-editor]')
  await ed.locator('.type-grid button', { hasText: '加九' }).first().click()
  await ed.getByRole('button', { name: '更新' }).click()
  const edited = JSON.stringify((await project()).chordTrack.map((e) => [e.chord, e.status, e.source]))
  await btn('撤销').click()
  const undone = JSON.stringify((await project()).chordTrack.map((e) => [e.startTick, e.durationTick, e.chord, e.status]))
  await btn('重做').click()
  const redone = JSON.stringify((await project()).chordTrack.map((e) => [e.chord, e.status, e.source]))
  check('CH-07', !!moved && stillConfirmed === confirmed && staleCount === 1 && /输入已变化/.test(staleText)
    && undone === confirmed && redone === edited, { staleCount, staleText: staleText.slice(0, 120), undoRestored: undone === confirmed, redoRestored: redone === edited })
})

await run('A-05', async () => {
  await newProject()
  const roll = page.locator('svg.roll')
  const box = await roll.boundingBox()
  const k = 56 / 960
  const yFor = (pitch) => (108 - pitch) * 12 + 6
  await page.locator('.timeline-scroll').evaluate((el) => { el.scrollTop = 0 })
  const b2 = await roll.boundingBox()
  await page.mouse.dblclick(b2.x + 960 * k + 3, b2.y + yFor(100))
  const s1 = JSON.stringify((await project()).tracks[0].clips[0].notes.map((n) => [n.pitch, n.startTick, n.durationTick]))
  const n = page.locator('[data-testid=note]').first()
  const nb = await n.boundingBox()
  await page.mouse.move(nb.x + 3, nb.y + 5); await page.mouse.down(); await page.mouse.move(nb.x + 3 + 960 * k, nb.y + 5 - 24, { steps: 4 }); await page.mouse.up()
  const s2 = JSON.stringify((await project()).tracks[0].clips[0].notes.map((x) => [x.pitch, x.startTick, x.durationTick]))
  const nb2 = await n.boundingBox()
  await page.mouse.move(nb2.x + nb2.width - 2, nb2.y + 5); await page.mouse.down(); await page.mouse.move(nb2.x + nb2.width + 960 * k, nb2.y + 5, { steps: 4 }); await page.mouse.up()
  const s3 = JSON.stringify((await project()).tracks[0].clips[0].notes.map((x) => [x.pitch, x.startTick, x.durationTick]))
  await n.click(); await page.keyboard.press('Delete')
  const s4 = (await project()).tracks[0].clips[0].notes.length
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+KeyZ' : 'Control+KeyZ')
  const u1 = JSON.stringify((await project()).tracks[0].clips[0].notes.map((x) => [x.pitch, x.startTick, x.durationTick]))
  await btn('撤销').click()
  const u2 = JSON.stringify((await project()).tracks[0].clips[0].notes.map((x) => [x.pitch, x.startTick, x.durationTick]))
  await btn('撤销').click()
  const u3 = JSON.stringify((await project()).tracks[0].clips[0].notes.map((x) => [x.pitch, x.startTick, x.durationTick]))
  await btn('重做').click(); await btn('重做').click()
  const r3 = JSON.stringify((await project()).tracks[0].clips[0].notes.map((x) => [x.pitch, x.startTick, x.durationTick]))
  check('A-05', s1 !== s2 && s2 !== s3 && s4 === 0 && u1 === s3 && u2 === s2 && u3 === s1 && r3 === s3,
    { added: s1, moved: s2, resized: s3, afterDelete: s4, undoChain: [u1 === s3, u2 === s2, u3 === s1], redo: r3 === s3 })
})

await run('A-06', async () => {
  await newProject()
  await importFile('a06_complex.mid')
  const modal = page.locator('dialog.modal')
  const text = await modal.textContent()
  await shot('a06-import-limitations-1280')
  await modal.getByRole('button', { name: '取消' }).click()
  const unchanged = (await project()).tracks[0].clips[0].notes.length === 0
  await importFile('a06_complex.mid')
  await page.locator('dialog.modal').getByRole('button', { name: '仍然导入' }).click()
  const imported = (await project()).tracks[0].clips[0].notes.map((x) => [x.pitch, x.startTick, x.durationTick])
  check('A-06:complex-import-limits', /CC64/.test(text) && /弯音/.test(text) && /速度变化/.test(text) && /音色中途变化/.test(text) && /PPQ 384/.test(text)
    && unchanged && JSON.stringify(imported) === JSON.stringify([[60, 0, 960], [62, 960, 3]]), { limitations: text.slice(0, 400), imported })
  // Invalid project file keeps the current project.
  await sleep(300)
  const before = JSON.stringify(await project())
  writeFileSync(`${OUT}/invalid.flux.json`, JSON.stringify({ schemaVersion: 1, ppq: 960, quarterBpm: 999, tracks: [] }))
  await page.setInputFiles('input[accept=".json,application/json"]', `${OUT}/invalid.flux.json`)
  const err = await page.locator('dialog.modal').textContent()
  await page.locator('dialog.modal').getByRole('button', { name: '关闭' }).click()
  check('A-06:invalid-json-rejected', /quarterBpm/.test(err) && before === JSON.stringify(await project()), { error: err.slice(0, 200) })
})

// Five main flows: new → sound → tempo/meter → keyboard input → multitrack → chords → analysis → save/export.
async function mainFlow(n, { bpm, ts, steps, stepValue, key, pick, expectRomans, extra, melody = ['KeyK', 'KeyL', 'Semicolon', 'KeyL'] }) {
  await newProject()
  await setBpm(bpm)
  await btn(ts).click()
  await keyboardOn()
  // Melody by real-time recording (2 bars) on track 1.
  await btn('回到开头').click()
  await btn('录音').click()
  const pulseMs = 60000 / bpm * (ts === '6/8' ? 1.5 : 1)
  const barPulses = ts === '4/4' ? 4 : ts === '3/4' ? 3 : 2
  await sleep(pulseMs * barPulses + 60)
  for (let i = 0; i < barPulses * 2; i++) {
    const code = melody[i % 4]
    await page.keyboard.down(code); await sleep(pulseMs * 0.5); await page.keyboard.up(code); await sleep(pulseMs * 0.5)
  }
  await btn('停止').click()
  // Harmony by step input on a new same-program track.
  await page.getByRole('button', { name: '+ 添加轨道' }).click()
  const p1 = await project()
  const t2 = p1.tracks[1]
  await page.getByLabel(`录音准备 ${t2.name}`).click()
  await mode('步进')
  await page.getByLabel('步进时值').selectOption(stepValue)
  await btn('回到开头').click(); await page.locator('.brand').click()
  for (const s of steps) await chord(s)
  await mode('试听')
  await page.getByLabel(`选择轨道 ${t2.name}`).click()
  await sleep(200)
  const suggestions = await suggestionLabels()
  await page.getByRole('button', { name: /采用全部建议/ }).click()
  if (pick) await pick()
  const inferred = await page.locator('[data-testid=key-status]').textContent()
  await confirmKey(key)
  if (extra) await extra()
  const r = await romans()
  await shot(`flow${n}-1280`)
  await page.setViewportSize({ width: 1440, height: 900 })
  await shot(`flow${n}-1440`)
  await page.setViewportSize({ width: 1280, height: 800 })
  const jsonPath = await download(() => btn('保存项目').click(), `flow${n}.flux.json`)
  const midPath = await download(() => btn('导出 MIDI').click(), `flow${n}.mid`)
  const saved = JSON.parse(readFileSync(jsonPath, 'utf8'))
  const ok = JSON.stringify(r) === JSON.stringify(expectRomans)
  check(`FLOW-${n}`, ok && saved.tracks.length === 2 && saved.chordTrack.filter((e) => e.chord).length === expectRomans.length,
    { bpm, ts, key, suggestions, inferred, romans: r, chords: saved.chordTrack.map((e) => e.chord ? `${e.chord.rootSpelling}${e.chord.quality}${e.chord.additions.join('')}${e.chord.bassSpelling ? '/' + e.chord.bassSpelling : ''}` : 'N.C.'), json: jsonPath, midi: midPath })
  return { jsonPath, midPath, saved }
}

let flow1
let perfBeforeReload = null
await run('FLOWS', async () => {
  flow1 = await mainFlow(1, { bpm: 90, ts: '4/4', stepValue: '1/1', key: 'C 大调',
    steps: [['KeyA', 'KeyD', 'KeyG'], ['KeyS', 'KeyG', 'KeyJ'], ['KeyA', 'KeyD', 'KeyH'], ['KeyA', 'KeyF', 'KeyH']],
    expectRomans: ['I', 'V⁶₄', 'vi⁶', 'IV⁶₄'] })
  await mainFlow(2, { bpm: 100, ts: '3/4', stepValue: '1/2', key: 'E♭ 大调', melody: ['KeyU', 'KeyK', 'KeyL', 'KeyK'],
    steps: [['KeyE', 'KeyG', 'KeyU'], ['KeyS', 'KeyF', 'KeyU'], ['KeyA', 'KeyE', 'KeyG'], ['KeyY', 'KeyK', 'KeyP']],
    expectRomans: ['I', 'V⁶', 'vi', 'IV'] })
  await mainFlow(3, { bpm: 72, ts: '6/8', stepValue: '1/2', key: 'D 大调', melody: ['KeyS', 'KeyD', 'KeyT', 'KeyD'],
    steps: [['KeyS', 'KeyG', 'KeyH'], ['KeyS', 'KeyT', 'KeyH'], ['KeyG', 'KeyH', 'KeyJ', 'KeyL'], ['KeyG', 'KeyH', 'KeyO', 'Semicolon']],
    expectRomans: ['Isus4', 'I', 'IV add9', 'V⁴₂'] })
  await mainFlow(4, { bpm: 84, ts: '4/4', stepValue: '1/1', key: 'A 小调', melody: ['KeyH', 'KeyJ', 'KeyK', 'KeyJ'],
    steps: [['KeyH', 'KeyK', 'Semicolon'], ['KeyS', 'KeyF', 'KeyH'], ['KeyD', 'KeyY', 'KeyJ'], ['KeyA', 'KeyD', 'KeyG', 'KeyH']],
    pick: async () => {
      // The last chord (C E G A) has two readings; choose Am7/C explicitly.
      const last = page.locator('[data-testid=chord-event]').last()
      await last.click({ position: { x: 20, y: 10 } })
      const ed = page.locator('[data-testid=chord-editor]')
      await ed.locator('.root-grid button', { hasText: /^A$/ }).click()
      await ed.locator('.type-grid button', { hasText: '小七' }).first().click()
      await ed.getByLabel('低音').selectOption('C')
      await ed.getByRole('button', { name: '更新' }).click()
    },
    expectRomans: ['i', 'iv', 'V', 'i⁶₅'] })
  await mainFlow(5, { bpm: 110, ts: '4/4', stepValue: '1/1', key: 'C 大调',
    steps: [['KeyA', 'KeyD', 'KeyG'], ['KeyS', 'KeyT', 'KeyH', 'KeyK'], ['KeyS', 'KeyG', 'KeyJ'], ['KeyA', 'KeyF', 'KeyH']],
    extra: async () => {
      // Manual borrowed iv and an explicit N.C. region after the progression.
      await openEditorRange(5, 6)
      await manualChord('F', '小三')
      await openEditorRange(6, 7)
      await page.locator('[data-testid=chord-editor] label.nc input').check()
      await page.locator('[data-testid=chord-editor]').getByRole('button', { name: '写入和弦轨' }).click()
    },
    expectRomans: ['I', 'V7/V', 'V⁶₄', 'IV⁶₄', 'iv'] })
})

await run('A-06-reload', async () => {
  if (!flow1) return
  // Refresh the page, enable sound again (sound bank from browser cache or file), reopen the saved project.
  perfBeforeReload = await flux(() => window.__flux.perf.summary())
  await page.reload()
  await boot()
  await spyNotes()
  await page.setInputFiles('input[accept=".json,application/json"]', flow1.jsonPath)
  await sleep(300)
  const reopened = await project()
  const same = isDeepStrictEqual(reopened, flow1.saved)
  const banner = await page.locator('.banner-warn').count()
  check('A-06:reload-reopen-deep-equal', same && banner === 0, { deepEqual: same, soundbankPrompt: banner, soundbank: reopened.soundbanks })
  // Changing BPM and meter keeps chord ticks (CH-08).
  const ticks = JSON.stringify(reopened.chordTrack.map((e) => [e.startTick, e.durationTick]))
  await setBpm(133); await btn('6/8').click()
  const after = JSON.stringify((await project()).chordTrack.map((e) => [e.startTick, e.durationTick]))
  check('CH-08:bpm-ts-keep-chord-ticks', ticks === after, 'chord ticks equal after 133 BPM and 6/8')
})

await run('EXTRA', async () => {
  // Loop recording stops at the loop end and closes a held note there.
  await newProject()
  await setBpm(120)
  await page.getByLabel('循环终点小节（不含）').fill('2')
  if (!(await project()).loopRange.enabled) await btn('循环').click()
  await btn('倒数').click() // count-in off
  await keyboardOn()
  await btn('录音').click()
  await sleep(300); await page.keyboard.down('KeyA'); await sleep(400); await page.keyboard.up('KeyA')
  await sleep(800); await page.keyboard.down('KeyD')
  await sleep(1500)
  const transport = await flux(() => window.__flux.transport)
  await page.keyboard.up('KeyD')
  const take = (await project()).tracks[0].clips[0].notes.map((n) => [n.pitch, n.startTick, n.startTick + n.durationTick])
  check('A-02:loop-record-stops-at-end', transport === 'stopped' && take.length === 2 && take.every(([, , end]) => end <= 3840) && take[1][2] === 3840,
    { transport, take })
  await btn('倒数').click(); await btn('循环').click()

  // On-screen keys play through the same path as the computer keyboard.
  const key = page.locator('.pkey[data-code=KeyA]')
  const kb = await key.boundingBox()
  await page.mouse.move(kb.x + kb.width / 2, kb.y + kb.height - 10); await page.mouse.down()
  const onScreenLevel = await peakLevel(200)
  const held = await flux(() => [...document.querySelectorAll('.pkey.down')].map((e) => e.dataset.code))
  await page.mouse.up(); await sleep(50)
  const released = await flux(() => window.__flux.engine.liveCounts.size)
  check('A-03:on-screen-keys', onScreenLevel > 1e-4 && held.includes('KeyA') && released === 0, { onScreenLevel, held, released })

  // Explicit quantize from the toolbar is undoable; recorded/added positions stay raw until then.
  await page.getByLabel('编辑网格').selectOption('off')
  await page.locator('.timeline-scroll').evaluate((el) => { el.scrollTop = 0; el.scrollLeft = 0 })
  const roll = await page.locator('svg.roll').boundingBox()
  await page.mouse.dblclick(roll.x + 1100 * (56 / 960), roll.y + (108 - 100) * 12 + 6)
  const raw = (await project()).tracks[0].clips[0].notes.find((n) => n.pitch === 100)
  await page.getByLabel('编辑网格').selectOption('1/16')
  await page.getByRole('button', { name: /^量化/ }).click()
  const q = (await project()).tracks[0].clips[0].notes.find((n) => n.pitch === 100)
  await btn('撤销').click()
  const back = (await project()).tracks[0].clips[0].notes.find((n) => n.pitch === 100)
  check('A-05:quantize-explicit-undoable', raw.startTick % 240 !== 0 && q.startTick % 240 === 0 && back.startTick === raw.startTick,
    { raw: raw.startTick, quantized: q.startTick, afterUndo: back.startTick })

  // A project that names another sound bank asks to relocate it instead of silently switching.
  const other = JSON.parse(readFileSync(flow1?.jsonPath ?? `${OUT}/flow1.flux.json`, 'utf8'))
  const otherBank = { id: 'Other-GM.sf2:1234:abcdef0123456789', name: 'Other-GM.sf2', byteLength: 1234, sha256: 'abcdef0123456789'.padEnd(64, '0') }
  other.soundbanks = [otherBank]
  other.tracks.forEach((t) => { t.soundbankId = otherBank.id })
  writeFileSync(`${OUT}/other-soundbank.flux.json`, JSON.stringify(other))
  await page.setInputFiles('input[accept=".json,application/json"]', `${OUT}/other-soundbank.flux.json`)
  await sleep(300)
  const banner = await page.locator('.banner-warn').textContent().catch(() => '')
  await shot('a06-soundbank-relocate-1280')
  await page.locator('.banner-warn').getByRole('button', { name: '改用当前音源' }).click()
  const after = await project()
  const current = await flux(() => window.__flux.engine.soundbank.id)
  check('A-06:soundbank-relocate-prompt', /Other-GM\.sf2/.test(banner) && /重新定位/.test(banner) && after.tracks.every((t) => t.soundbankId === current)
    && (await page.locator('.banner-warn').count()) === 0, { banner: banner.slice(0, 160), switchedTo: current })
})

await run('PERF-CHORD', async () => {
  // Chord segmentation + key/Roman analysis time for 4 and 8 bars of one recorded part.
  const out = {}
  for (const bars of [4, 8]) {
    await newProject()
    await importFile(`perf_${bars}_bars.mid`)
    await flux(() => window.__flux.perf.reset())
    const name = (await project()).tracks[0].name
    for (let i = 0; i < 30; i++) await page.getByLabel(`静音 ${name}`).click() // each toggle re-runs the analysis
    const perf = await flux(() => window.__flux.perf.summary())
    out[`${bars}bars`] = { notes: perf.chordAnalysisNotes.max, runs: perf.chordAnalysisMs.count, p50: perf.chordAnalysisMs.p50, p95: perf.chordAnalysisMs.p95, max: perf.chordAnalysisMs.max,
      suggestions: (await suggestionLabels()).length }
  }
  check('A-09:chord-analysis-p95', out['4bars'].p95 <= 500 && out['8bars'].p95 <= 500 && out['8bars'].suggestions === 8, out)
  await newProject()
})

await run('A-10', async () => {
  const worklet = await flux(async () => {
    const url = window.__flux.engine.info().processorUrl
    const r = await fetch(url)
    return { url: new URL(url, location.href).href, status: r.status, bytes: (await r.arrayBuffer()).byteLength }
  })
  const title = await page.locator('.brand').textContent()
  const hasKeyboard = await page.getByRole('button', { name: /电脑键盘/ }).count()
  check('A-10:entry-serves-new-ui', title === 'FLUX' && hasKeyboard === 1 && worklet.status === 200 && worklet.bytes > 100000, { url: URL, worklet })
})

// --- A-09: 8 tracks, 2-bar loop, 5 minutes with edits ------------------------------------
if (PERF_SECONDS > 0 && (!ONLY || ONLY.includes('A-09'))) {
  await run('A-09', async () => {
    await newProject()
    await importFile('a09_eight_tracks.mid')
    await flux(() => window.__flux.perf.reset())
    await page.getByLabel('循环终点小节（不含）').fill('3')
    await page.getByRole('button', { name: '循环' }).click()
    await page.getByRole('button', { name: '节拍器' }).click()
    await flux(() => { window.__spy.on.length = 0; window.__spy.off.length = 0; window.__spy.click.length = 0 })
    const t0 = Date.now()
    await btn('播放').click()
    let edits = 0, maxVoices = 0
    const roll = page.locator('svg.roll')
    while (Date.now() - t0 < PERF_SECONDS * 1000) {
      await sleep(5000)
      const tracks = (await project()).tracks
      const t = tracks[edits % tracks.length]
      // Edit during playback: toggle mute, change volume, add + remove a note.
      await page.getByLabel(`静音 ${t.name}`).click()
      await page.getByLabel(`音量 ${t.name}`).fill(String(60 + (edits % 60)))
      await page.getByLabel(`静音 ${t.name}`).click()
      await page.locator('.timeline-scroll').evaluate((el) => { el.scrollTop = 0 })
      const b = await roll.boundingBox()
      const before = (await project()).revision
      await page.mouse.dblclick(b.x + 200 + (edits % 10) * 20, b.y + (108 - 100) * 12 + 6)
      if ((await project()).revision > before) await page.keyboard.press('Meta+KeyZ')
      edits++
      maxVoices = Math.max(maxVoices, await flux(() => window.__flux.engine.synth.voiceCount))
    }
    const durationS = (Date.now() - t0) / 1000
    await btn('停止').click()
    await sleep(2500)
    const voicesAfter = await flux(() => window.__flux.engine.synth.voiceCount)
    const perf = await flux(() => window.__flux.perf.summary())
    const s = await spy()
    // Drift: every middle C of track 1 falls on a beat; after 5 minutes it must still be on the
    // absolute beat grid computed from the first one.
    const loopSeconds = 7680 / (120 * 960 / 60)
    const track1 = (await project()).tracks[0].id
    const times = s.on.filter((e) => e.p === 60 && e.t === track1).map((e) => e.time)
    const maxDrift = times.reduce((m, x) => Math.max(m, Math.abs((x - times[0]) - Math.round((x - times[0]) / 0.5) * 0.5)), 0)
    const passes = Math.round((times.at(-1) - times[0]) / loopSeconds) + 1
    const late = s.on.length ? perf.scheduleLeadMs.min : null
    writeFileSync(`${OUT}/a09-perf.json`, JSON.stringify({ durationS, edits, maxVoices, voicesAfter, perf, passes, maxDrift, notesScheduled: s.on.length }, null, 2))
    check('A-09', durationS >= PERF_SECONDS && voicesAfter === 0 && maxDrift < 1e-6 && late > 0 && maxVoices < 200,
      { durationS, edits, loopPasses: passes, maxDriftSeconds: maxDrift, minScheduleLeadMs: late, maxVoices, voicesAfter,
        schedulerTickMs: perf.schedulerTickMs, scheduleLeadMs: perf.scheduleLeadMs })
  })
}

const perf = await flux(() => window.__flux.perf.summary()).catch(() => null)
writeFileSync(`${OUT}/results.json`, JSON.stringify({
  browser: BROWSER, url: URL, when: new Date().toISOString(), info, results, perfBeforeReload, perfAfterReload: perf,
  browserVersion: browser.version(), consoleErrors,
}, null, 2))
const failed = results.filter((r) => !r.pass)
log(`${results.length - failed.length}/${results.length} passed; console errors: ${consoleErrors.length}`)
await browser.close()
process.exit(failed.length ? 1 : 0)
