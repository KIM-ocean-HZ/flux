// Acceptance check for a project JSON + MIDI files exported from the page by a person:
// validate the project, re-run chord analysis, read each MIDI back with the page's importer,
// and render the MIDI offline (spessasynth_core + local sound bank) to prove every track sounds.
//   node e2e/accept_user_export.mjs <project.flux.json> <out-dir> <a.mid> [b.mid ...]
// mido read-back of the same files: .venv/bin/python frontend/e2e/check_exports.py (check()).
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { SoundBankLoader, SpessaSynthProcessor } from 'spessasynth_core'
import { analyzeHarmony, keyLabel } from '../src/music/analysis.js'
import { eventSymbol, segmentChords } from '../src/music/chords.js'
import { importMidi, planExport } from '../src/music/midi.js'
import { parseProjectFile, trackNotes } from '../src/music/project.js'
import { PPQ, ticksToSeconds } from '../src/music/time.js'

const [jsonPath, outDir, ...midiPaths] = process.argv.slice(2)
const SF2 = process.env.FLUX_SOUNDBANK ?? resolve(import.meta.dirname, '../../data/phase_a/soundfonts/GeneralUser-GS.sf2')
const SR = 44100
const report = { project: basename(jsonPath), midi: [], checks: [] }
const check = (name, ok, detail) => report.checks.push({ name, ok: !!ok, detail })
const noteKey = (n) => `${n.pitch}@${n.startTick}+${n.durationTick}v${n.velocity}`

const parsed = parseProjectFile(readFileSync(jsonPath, 'utf8'))
check('project JSON validates', parsed.ok, parsed.ok ? null : parsed.errors)
const project = parsed.project
const pitched = project.tracks.filter((t) => !t.isDrum)
report.summary = {
  bpm: project.quarterBpm, meter: `${project.timeSignature.numerator}/${project.timeSignature.denominator}`,
  tracks: project.tracks.map((t) => ({ name: t.name, program: t.program, isDrum: t.isDrum, notes: t.clips[0].notes.length })),
  chordTrack: project.chordTrack.map((e) => `${eventSymbol(e)}@${e.startTick}+${e.durationTick} ${e.status}`),
  keyContext: project.keyContext,
}

// Harmony exactly as the page computes it from confirmed chords.
const confirmed = project.chordTrack.filter((e) => e.status === 'confirmed')
const analysis = analyzeHarmony({ chords: confirmed, notes: pitched.flatMap(trackNotes), timeSignature: project.timeSignature,
  keyContext: project.keyContext, revision: project.revision })
report.analysis = {
  keyStatus: analysis.keyStatus, key: analysis.key && keyLabel(analysis.key),
  candidates: analysis.keyCandidates.map((k) => `${keyLabel(k)} ${k.score.toFixed(3)}`),
  numerals: confirmed.map((e) => analysis.chords[e.id]?.display ?? null),
  progressions: analysis.progressions.map((p) => `${p.name}: ${p.text}`),
}
report.segments = Object.fromEntries(pitched.map((t) => [t.id, segmentChords(trackNotes(t)).map((s) => s.label ?? s.detection.status)]))

// MIDI: identical copies, page importer read-back equals the project.
const plan = planExport(project)
for (const path of midiPaths) {
  const bytes = readFileSync(path)
  const entry = { file: basename(path), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }
  const back = importMidi(new Uint8Array(bytes), { name: 'readback' })
  entry.ok = back.ok
  if (back.ok) {
    entry.limitations = back.limitations
    const same = back.project.tracks.length === project.tracks.length && project.tracks.every((t, i) => {
      const b = back.project.tracks[i]
      const want = trackNotes(t).map(noteKey).sort().join()
      return b.name === t.name && b.isDrum === t.isDrum && (t.isDrum || b.program === t.program) && trackNotes(b).map(noteKey).sort().join() === want
    })
    entry.matchesProject = same && back.project.quarterBpm === project.quarterBpm
      && back.project.timeSignature.numerator === project.timeSignature.numerator
      && back.project.timeSignature.denominator === project.timeSignature.denominator
    entry.chordTrackInMidi = back.project.tracks.length !== project.tracks.length
  }
  report.midi.push(entry)
}
check('all MIDI files are byte-identical', new Set(report.midi.map((m) => m.sha256)).size === 1)
check('MIDI read back by the page importer equals the project (tracks, programs, notes, tempo, meter)', report.midi.every((m) => m.matchesProject))
check('MIDI import lists no limitations', report.midi.every((m) => m.limitations?.length === 0))

// Offline render of the first MIDI as imported (what another player would hear from the file).
if (existsSync(SF2) && midiPaths.length) {
  const buf = readFileSync(SF2)
  const bank = SoundBankLoader.fromArrayBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
  const synth = new SpessaSynthProcessor(SR, { effectsEnabled: false })
  synth.soundBankManager.addSoundBank(bank, 'main')
  await synth.processorInitialized
  const imported = importMidi(new Uint8Array(readFileSync(midiPaths[0])), { name: 'render' }).project
  const channels = planExport(imported).channels
  const t0 = synth.currentTime + 0.05
  const at = (tick) => t0 + ticksToSeconds(tick, imported.quarterBpm)
  let end = 0
  for (const t of imported.tracks) {
    const ch = channels.get(t.id)
    if (t.isDrum) synth.midiChannels[ch].setDrums(true)
    synth.programChange(ch, t.program)
    synth.controllerChange(ch, 7, t.volume)
    for (const n of trackNotes(t)) {
      synth.processMessage([0x90 | ch, n.pitch, n.velocity], 0, { time: at(n.startTick) })
      synth.processMessage([0x80 | ch, n.pitch, 0], 0, { time: at(n.startTick + n.durationTick) })
      end = Math.max(end, n.startTick + n.durationTick)
    }
  }
  const seconds = ticksToSeconds(end, imported.quarterBpm) + 1.5
  const n = Math.round(seconds * SR)
  const outs = Array.from({ length: 16 }, () => [new Float32Array(n), new Float32Array(n)])
  const fx = [new Float32Array(n), new Float32Array(n)]
  for (let i = 0; i < n; i += 128) synth.processSplit(outs, fx[0], fx[1], i, Math.min(128, n - i))
  // Per track: RMS while its notes sound, and whether every note onset window has signal.
  report.render = imported.tracks.map((t) => {
    const [l, r] = outs[channels.get(t.id)]
    const rmsOver = (a, b) => {
      const i0 = Math.max(0, Math.floor(a * SR)), i1 = Math.min(n, Math.ceil(b * SR))
      let s = 0
      for (let i = i0; i < i1; i++) s += l[i] * l[i] + r[i] * r[i]
      return Math.sqrt(s / Math.max(1, i1 - i0))
    }
    const notes = trackNotes(t)
    const silentNotes = notes.filter((x) => rmsOver(at(x.startTick), at(x.startTick) + Math.min(0.1, ticksToSeconds(x.durationTick, imported.quarterBpm))) < 1e-4)
    return { track: t.name, channel: channels.get(t.id) + 1, notes: notes.length, rms: +rmsOver(0, seconds).toFixed(5), silentNotes: silentNotes.length }
  })
  check('offline render: every track has signal and every note onset sounds', report.render.every((x) => x.rms > 1e-3 && x.silentNotes === 0))
  // 16-bit stereo WAV of the mix, for listening.
  const pcm = Buffer.alloc(n * 4)
  let peak = 0
  const mix = (i, side) => outs.reduce((s, o) => s + o[side][i], 0)
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(mix(i, 0)), Math.abs(mix(i, 1)))
  const gain = peak > 0.98 ? 0.98 / peak : 1
  for (let i = 0; i < n; i++) {
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix(i, 0) * gain)) * 32767), i * 4)
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix(i, 1) * gain)) * 32767), i * 4 + 2)
  }
  const head = Buffer.alloc(44)
  head.write('RIFF', 0); head.writeUInt32LE(36 + pcm.length, 4); head.write('WAVE', 8); head.write('fmt ', 12)
  head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(2, 22); head.writeUInt32LE(SR, 24)
  head.writeUInt32LE(SR * 4, 28); head.writeUInt16LE(4, 32); head.writeUInt16LE(16, 34); head.write('data', 36); head.writeUInt32LE(pcm.length, 40)
  writeFileSync(resolve(outDir, 'render.wav'), Buffer.concat([head, pcm]))
  report.renderSeconds = +seconds.toFixed(2)
} else check('offline render', false, `sound bank missing: ${SF2}`)

writeFileSync(resolve(outDir, 'acceptance.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
process.exit(report.checks.every((c) => c.ok) ? 0 : 1)
