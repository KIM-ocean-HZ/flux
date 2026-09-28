// Offline rendering with the same synthesis core the browser worklet runs (spessasynth_core),
// using the local verification sound bank. Proves non-zero audio and channel isolation; it is
// not a listening test. Skipped when the sound bank is not present.
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SoundBankLoader, SpessaSynthProcessor } from 'spessasynth_core'
import { beforeAll, describe, expect, it } from 'vitest'
import { GM_DRUM_NOTES, GM_PROGRAMS } from '../src/music/gm.js'

const SF2 = process.env.FLUX_SOUNDBANK ?? resolve(__dirname, '../../data/phase_a/soundfonts/GeneralUser-GS.sf2')
const SR = 44100
let bank

function newSynth() {
  const synth = new SpessaSynthProcessor(SR, { effectsEnabled: false })
  synth.soundBankManager.addSoundBank(bank, 'main')
  return synth
}

/** Render `seconds`; returns per-channel RMS over the rendered span. */
function render(synth, seconds, channels = 16) {
  const n = Math.round(seconds * SR)
  const outs = Array.from({ length: channels }, () => [new Float32Array(n), new Float32Array(n)])
  const fx = [new Float32Array(n), new Float32Array(n)]
  for (let i = 0; i < n; i += 128) synth.processSplit(outs, fx[0], fx[1], i, Math.min(128, n - i))
  return {
    rms: outs.map(([l, r]) => Math.sqrt(l.reduce((s, v) => s + v * v, 0) / n + r.reduce((s, v) => s + v * v, 0) / n)),
    outs,
  }
}

describe.skipIf(!existsSync(SF2))('offline synthesis with the verification sound bank (A-01, A-02)', () => {
  beforeAll(async () => {
    const buf = readFileSync(SF2)
    bank = SoundBankLoader.fromArrayBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
  })

  it('the bank provides every GM melodic program in bank 0 plus a standard drum kit', () => {
    const melodic = new Set(bank.presets.filter((p) => !p.isGMGSDrum && p.bankMSB === 0 && p.bankLSB === 0).map((p) => p.program))
    expect(GM_PROGRAMS.every((p) => melodic.has(p.program))).toBe(true)
    expect(bank.presets.some((p) => p.isGMGSDrum && p.program === 0)).toBe(true)
  })

  it('all 128 programs make sound with no program offset', async () => {
    const silent = []
    const synth = newSynth()
    await synth.processorInitialized
    for (const p of GM_PROGRAMS) {
      synth.programChange(0, p.program)
      synth.noteOn(0, p.family.en === 'Bass' ? 40 : 60, 110)
      const { rms } = render(synth, 0.35)
      if (!(rms[0] > 1e-4)) silent.push(`${p.display} ${p.en}`)
      synth.stopAllChannels(true)
      render(synth, 0.01)
    }
    expect(silent).toEqual([])
  })

  it('drum kit pieces sound on a drum channel', async () => {
    const synth = newSynth()
    await synth.processorInitialized
    synth.midiChannels[9].setDrums(true)
    synth.programChange(9, 0)
    for (const note of [35, 36, 38, 42, 46, 49, 51, 56, 75, 76, 77, 81]) {
      expect(GM_DRUM_NOTES.some((d) => d.note === note)).toBe(true)
      synth.noteOn(9, note, 110)
      expect(render(synth, 0.2).rms[9], `drum ${note}`).toBeGreaterThan(1e-4)
      synth.stopAllChannels(true)
    }
  })

  it('two channels with the same program and pitch are independent (note-off, volume, mute)', async () => {
    const synth = newSynth()
    await synth.processorInitialized
    for (const ch of [0, 1]) { synth.programChange(ch, 0); synth.controllerChange(ch, 7, 100) }
    synth.noteOn(0, 60, 100)
    synth.noteOn(1, 60, 100)
    const both = render(synth, 0.3).rms
    expect(both[0]).toBeGreaterThan(1e-3)
    expect(both[1]).toBeCloseTo(both[0], 3)
    synth.noteOff(0, 60) // must not cut channel 1
    render(synth, 0.8)
    const after = render(synth, 0.2).rms
    expect(after[1]).toBeGreaterThan(20 * after[0])
    expect(synth.midiChannels[1].voiceCount).toBeGreaterThan(0)

    synth.stopAllChannels(true)
    synth.controllerChange(0, 7, 0) // volume 0 on one track only
    synth.noteOn(0, 64, 100)
    synth.noteOn(1, 64, 100)
    const vol = render(synth, 0.3).rms
    expect(vol[0]).toBeLessThan(1e-5)
    expect(vol[1]).toBeGreaterThan(1e-3)

    synth.stopAllChannels(true)
    synth.controllerChange(0, 7, 100)
    synth.midiChannels[1].setSystemParameter('isMuted', true)
    synth.noteOn(0, 67, 100)
    synth.noteOn(1, 67, 100)
    const muted = render(synth, 0.3).rms
    expect(muted[0]).toBeGreaterThan(1e-3)
    expect(muted[1]).toBe(0)
  })

  it('queued note-ons are dropped while a channel is muted (how stop/seek discards scheduled events)', async () => {
    const synth = newSynth()
    await synth.processorInitialized
    synth.programChange(0, 0)
    const t = synth.currentTime
    synth.processMessage([0x90, 60, 100], 0, { time: t + 0.1 })
    synth.processMessage([0x80, 60, 0], 0, { time: t + 0.3 })
    synth.midiChannels[0].setSystemParameter('isMuted', true)
    expect(render(synth, 0.4).rms[0]).toBe(0)
    synth.midiChannels[0].setSystemParameter('isMuted', false)
    expect(render(synth, 0.2).rms[0]).toBe(0) // nothing left in the queue
  })

  it('timed events start at their AudioContext time within one render quantum', async () => {
    const synth = newSynth()
    await synth.processorInitialized
    synth.programChange(0, 115) // woodblock: sharp attack
    const t = synth.currentTime + 0.25
    synth.processMessage([0x90, 72, 127], 0, { time: t })
    const { outs } = render(synth, 0.5)
    const onset = outs[0][0].findIndex((v) => Math.abs(v) > 1e-3) / SR
    expect(onset).toBeGreaterThanOrEqual(0.25 - 1e-9)
    expect(onset - 0.25).toBeLessThan(128 / SR + 0.005)
  })
})
