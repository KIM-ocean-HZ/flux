#!/usr/bin/env bash
# Pre-demo check: runs the existing non-model, non-destructive verifications in one pass.
# Does not download models, does not run the model, does not touch data/results/.
# Usage: bash scripts/demo_check.sh   (from the repository root)

set -u
cd "$(dirname "$0")/.."
fail=0
step() { printf '\n=== %s ===\n' "$1"; }
check() { if [ "$1" -eq 0 ]; then echo "ok"; else echo "FAILED"; fail=1; fi; }

step "1/5 transform property tests"
uv run pytest -q
check $?

step "2/5 frontend production build"
(cd frontend && npm run build)
check $?

step "3/5 transform demo (deterministic MIDI)"
demo=data/generated/transforms_demo.mid
before=$([ -f "$demo" ] && md5 -q "$demo" || echo none)
uv run python -m core.transforms
rc=$?
after=$([ -f "$demo" ] && md5 -q "$demo" || echo none)
if [ "$before" != none ] && [ "$before" != "$after" ]; then
  echo "WARNING: $demo changed (was $before, now $after) — transforms are meant to be deterministic"
  fail=1
fi
check $rc

step "4/5 backend smoke (stub, no model)"
PYTHONPATH=. uv run python -c "
from fastapi.testclient import TestClient
from backend.main import app
c = TestClient(app)
notes = [{'pitch': 60, 'time': 0, 'duration': 1, 'velocity': 80},
         {'pitch': 67, 'time': 2, 'duration': 1, 'velocity': 80}]
r1 = c.post('/api/suggest', json={'notes': notes}); r1.raise_for_status()
r2 = c.post('/api/suggest', json={'notes': notes}); r2.raise_for_status()
print(f'/api/suggest {r1.status_code}, {len(r1.json()[\"ghosts\"])} ghosts, '
      f'regenerate differs: {r1.json() != r2.json()}')
" 2>&1 | grep -v StarletteDeprecationWarning | grep -v 'from starlette.testclient'
check "${PIPESTATUS[0]}"

step "5/5 demo artifacts present"
missing=0
for f in data/generated/ab_small_free.png data/generated/ab_small_constrained.png \
         data/generated/ab_medium_free.png data/generated/ab_medium_constrained.png \
         data/generated/transforms_demo.mid data/results/pipeline_metrics.csv \
         data/sample/sample_melody.mid; do
  [ -f "$f" ] || { echo "MISSING: $f"; missing=1; }
done
check "$missing"

printf '\n=== result ===\n'
if [ "$fail" -eq 0 ]; then echo "all checks passed"; else echo "SOME CHECKS FAILED"; fi
exit "$fail"
