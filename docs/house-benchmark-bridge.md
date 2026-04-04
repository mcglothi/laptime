# House Benchmark Bridge

LapTime already separates public data quality into four lanes:

- `exact`
- `source-backed`
- `community-runtime`
- modeled estimates

What it does not have yet is a clean bridge for private, first-party runs from house hardware like `hopper`, and later `newton`, before those runs are ready to become public catalog rows.

## Goal

Create a reviewable bridge between local benchmark runs and LapTime's catalog so we can:

- run a baseline on a known platform
- test new models or runtimes against that baseline
- detect where real backend behavior diverges from LapTime's modeled fit or throughput
- promote only the right results into public LapTime data

## Why this matters

Hopper already exposed the failure mode:

- LapTime currently shows `Qwen3.5 122B-A10B Q4_K_M` as a GB10-fit-capable row with strong modeled/source-backed throughput
- real Hopper testing showed that a practical backend path can still fail or become operationally unsafe on the same class of hardware

That is not a normal "benchmark drift" problem. It is a `catalog fit` vs `verified runtime fit` problem.

Newton will make this even more useful because it gives us a second calibrated platform for:

- Apple-silicon local lanes
- agent-oriented real workflows
- cross-platform comparisons against Hopper's GB10 behavior

## Recommended shape

Do not let Hopper or Newton write directly into `src/data/benchmarkData.js`.

Use a 3-stage bridge instead:

1. Export a normalized benchmark artifact from Hopper or Newton
2. Review the artifact against LapTime's current catalog
3. Promote it intentionally into one of two destinations

Destination A: public LapTime row
- use when the run is reproducible and safe to cite publicly
- likely lands as `community-runtime` first unless it has a stronger benchmark pedigree

Destination B: private house calibration note
- use when the run is real and valuable, but still internal, backend-specific, or operationally messy
- especially useful for "modeled fit said yes, real backend fit said no" cases

## Normalized artifact shape

The bridge should treat house benchmark output as a normalized JSON payload with the fields LapTime actually needs:

```json
{
  "hardwareId": "dgx-spark-gb10",
  "modelId": "qwen3.5-122b-a10b-q4-k-m",
  "prefillTps": 512.3,
  "decodeTps": 18.4,
  "ttftMs": 2400,
  "runtime": "Ollama",
  "host": "hopper",
  "fitVerdict": "verified-unfit",
  "sourceLabel": "Hopper house benchmark",
  "provenance": "hopper overnight batch 2026-04-04",
  "notes": "Loads or serves poorly on this backend despite catalog-level GB10 fit expectations."
}
```

Required:

- `hardwareId`
- `modelId`
- `prefillTps`
- `decodeTps`
- `ttftMs`

Strongly recommended:

- `runtime`
- `host`
- `fitVerdict`
- `sourceLabel`
- `provenance`
- `notes`

## Promotion rules

If no matching LapTime row exists:

- create a candidate row, but keep it out of the public catalog until it is reviewed

If an estimated row exists:

- house data should usually replace the estimate path first in an internal review queue

If a `source-backed` or `community-runtime` row exists:

- compare deltas before promotion
- if the measured run is materially different, keep both the public row and the house calibration note until the divergence is understood

If the measured run contradicts fit expectations:

- do not silently overwrite the row
- add or preserve a backend-fit note
- treat the result as evidence that LapTime needs a stronger distinction between:
  - "projected fit"
  - "verified fit on this runtime/backend"

## Newton plan

Newton should become the second calibration lane, not just another row source.

Use it for:

- Apple-silicon baseline runs on the same model families tested on Hopper
- direct backend comparisons for the same model where possible
- repeatable "reference platform" laps for models we care about operationally, not just academically

Recommended reference matrix:

- one small dense model
- one mainstream coder model
- one medium dense model
- one MoE model that is supposed to fit cleanly
- one stretch model that tests the boundary of fit and runtime overhead

## Practical workflow

1. Run or export a Hopper/Newton benchmark into normalized JSON.
2. Review it with `node scripts/review-house-benchmark.mjs --input path/to/file.json`.
3. Check whether it is:
   - a new candidate row
   - a correction to a modeled row
   - a contradiction of current fit assumptions
4. Promote only reviewed rows into public LapTime data.
5. Keep unresolved contradictions as private house calibration evidence until the modeling change is clear.

## Near-term implementation

The first bridge does not need a database, worker, or API.

The simplest useful version is:

- a normalized JSON export format from Hopper/Newton
- a review script that compares measurements against `benchmarkData.js`
- a human promotion step into the public catalog

That gives us immediate leverage without making LapTime's public data path brittle.
