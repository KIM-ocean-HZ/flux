"""A/B listening test: does instrument constraint / model size fix the mess?

Hypothesis from the first Phase 0 listen: the from-scratch accompaniment sounded
bad mostly because generation was free to scatter notes across ~14 instruments.
This script generates the same melody's accompaniment under a 2x2 grid of
conditions so the factors can be judged separately, by ear and by metrics:

  model size:  small (128M)  vs medium (~360M)
  instruments: unconstrained vs {piano 0, acoustic bass 32, drums 128}

Outputs: data/generated/ab_<condition>.mid/.png + rows in the metrics CSV.
"""

from __future__ import annotations

from research.generate import load_amt
from research.pipeline import run

ACCOMPANIMENT_SET = {0, 32, 128}  # piano, acoustic bass, drums

CONDITIONS = [
    # (tag, model_name, allowed_instruments, top_p)
    ("ab_small_free", "stanford-crfm/music-small-800k", None, 0.98),
    ("ab_small_constrained", "stanford-crfm/music-small-800k", ACCOMPANIMENT_SET, 0.95),
    ("ab_medium_free", "stanford-crfm/music-medium-800k", None, 0.98),
    ("ab_medium_constrained", "stanford-crfm/music-medium-800k", ACCOMPANIMENT_SET, 0.95),
]


def main() -> None:
    models: dict[str, tuple] = {}
    for tag, model_name, allowed, top_p in CONDITIONS:
        if model_name not in models:
            models[model_name] = load_amt(model_name)
        model, device = models[model_name]
        print(f"\n=== {tag} ===")
        run(top_p=top_p, model_name=model_name, allowed_instruments=allowed,
            tag=tag, model=model, device=device)


if __name__ == "__main__":
    main()
