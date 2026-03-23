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

## Cloudflare Pages

Use these settings when creating the Pages project in Cloudflare:

- Framework preset: `Vite`
- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`

Recommended domain setup:

- Primary domain: `laptime.run`
- Redirect: `www.laptime.run` -> `laptime.run`

After the first deploy, attach the custom domain from the Pages project:

1. Create a new Pages project from the `mcglothi/laptime` GitHub repo.
2. Deploy `main` with the settings above.
3. In `Custom domains`, add `laptime.run`.
4. Add `www.laptime.run` and enable redirect to the apex domain.

## GitHub Actions deploy

This repo can deploy to Cloudflare Pages automatically on every push to `main`.

Required GitHub repository secrets:

- `CLOUDFLARE_API_KEY`
- `CLOUDFLARE_EMAIL`

Workflow file:

- [.github/workflows/deploy-cloudflare-pages.yml](/Users/mcglothi/code/laptime/.github/workflows/deploy-cloudflare-pages.yml)

## Near-term roadmap

- Replace synthetic metrics with a real benchmark dataset
- Add side-by-side system comparisons
- Build benchmark explorer and hardware landing pages
- Add affiliate-ready buyer guides and recommendation content
