# LapTime

LapTime is a local-LLM buying simulator that turns benchmark numbers into an
experience. Instead of asking buyers to interpret raw tokens per second,
LapTime shows how different hardware, models, and workloads feel in practice.

## Current scope

- Premium landing page and brand direction
- Interactive simulator shell with curated hardware, model, and workload presets
- Playback timeline for prompt ingest, time to first token, and streamed output

## Stack

- React 19
- Vite 8
- Plain CSS with a custom brand system

## Local development

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run lint
npm run build
```

## Near-term roadmap

- Replace synthetic metrics with a real benchmark dataset
- Add side-by-side system comparisons
- Build benchmark explorer and hardware landing pages
- Add affiliate-ready buyer guides and recommendation content
