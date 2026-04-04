# Open WebUI Extension API

This is the lightweight integration path for Open WebUI.

Instead of copying LapTime logic into the WebUI frontend, the extension should call a single API endpoint and render the response in a compact badge, pill row, or small side panel.

## Endpoint

`GET /api/runtime-telemetry`

Example:

```text
/api/runtime-telemetry?hardwareName=hopper&modelName=qwen3-coder:30b&runtime=Ollama
```

More explicit example with observed metrics:

```text
/api/runtime-telemetry?hardwareId=dgx-spark-gb10&modelName=Qwen3.5-122B-A10B-Q4_K_M&runtime=Ollama&observedDecodeTps=18.4&observedTtftMs=2400
```

## Supported query params

- `hardwareId`
- `hardwareName`
- `modelId`
- `modelName`
- `runtime`
- `promptTokens`
- `responseTokens`
- `observedPrefillTps`
- `observedDecodeTps`
- `observedTtftMs`

Use IDs when you have them. Use names when you only have the visible Open WebUI alias or model label.

## Response shape

```json
{
  "ok": true,
  "resolution": {
    "hardware": {
      "id": "dgx-spark-gb10",
      "name": "NVIDIA DGX Spark",
      "memoryGb": 128
    },
    "model": {
      "id": "qwen3.5-122b-a10b-q4-k-m",
      "name": "Qwen3.5 122B-A10B Q4_K_M",
      "quant": "Q4_K_M (MoE)"
    }
  },
  "context": {
    "promptTokens": 1200,
    "responseTokens": 220,
    "runtime": "Ollama"
  },
  "laptime": {
    "estimated": {
      "prefillTps": 512.3,
      "decodeTps": 18.4,
      "ttftMs": 2400,
      "source": "Estimated from ...",
      "observedRuntime": "Ollama",
      "coverage": "source-backed"
    },
    "fit": {
      "status": "tight",
      "fits": true,
      "message": "LapTime estimates a tight fit ..."
    }
  },
  "observed": {
    "prefillTps": null,
    "decodeTps": 17.9,
    "ttftMs": 2630
  },
  "comparison": {
    "prefill": null,
    "decode": {
      "absolute": -0.5,
      "percent": -2.7,
      "tone": "close"
    },
    "ttft": {
      "absolute": 230,
      "percent": 9.6,
      "tone": "close"
    }
  }
}
```

## Recommended extension behavior

Initial render after model selection:

- call with `hardwareName`, `modelName`, and `runtime`
- show LapTime estimated `decode`, `TTFT`, and `fit.status`

Follow-up render after a response finishes:

- call again with `observedDecodeTps` and `observedTtftMs`
- show compact delta indicators like:
  - `Decode -18% vs LapTime`
  - `TTFT +24% vs LapTime`

## UI guidance

Keep the extension minimal:

- one line or one small card
- no chart required for v1
- use LapTime as a comparison oracle, not a second simulator inside Open WebUI

Suggested compact fields:

- model label
- runtime
- estimated decode
- estimated TTFT
- fit status
- optional live delta once observed metrics exist

## Starter snippet

A minimal fetch-and-render example now lives at:

- `docs/open-webui-extension-snippet.js`

It is intentionally generic:

- one fetch helper
- one small render helper
- one compact card stylesheet

That should be easy to adapt into whatever Open WebUI extension surface ends up being the cleanest on Hopper.
