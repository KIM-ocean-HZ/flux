// Command-line access to the same MIDI exchange code the page uses, for cross-checking with
// independent parsers (tests/test_phase_a_midi.py reads the output with mido).
//   node scripts/midi_cli.mjs export <project.json> <out.mid>
//   node scripts/midi_cli.mjs import <in.mid> <out.json>
import { readFileSync, writeFileSync } from 'node:fs'
import { exportMidi, importMidi, planExport } from '../src/music/midi.js'
import { parseProjectFile } from '../src/music/project.js'

const [command, input, output] = process.argv.slice(2)
if (command === 'export') {
  const parsed = parseProjectFile(readFileSync(input, 'utf8'))
  if (!parsed.ok) {
    console.error(parsed.errors.join('\n'))
    process.exit(2)
  }
  const plan = planExport(parsed.project)
  if (!plan.ok) {
    console.error(plan.errors.join('\n'))
    process.exit(3)
  }
  for (const w of plan.warnings) console.error(`warning: ${w}`)
  writeFileSync(output, exportMidi(parsed.project, plan))
  console.log(JSON.stringify({ channels: Object.fromEntries(plan.channels) }))
} else if (command === 'import') {
  const result = importMidi(new Uint8Array(readFileSync(input)), { name: 'imported' })
  writeFileSync(output, JSON.stringify(result, null, 2))
  process.exit(result.ok ? 0 : 4)
} else {
  console.error('usage: midi_cli.mjs export <project.json> <out.mid> | import <in.mid> <out.json>')
  process.exit(1)
}
