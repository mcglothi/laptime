import { benchmarkMatrix, hardwareOptions, modelOptions } from '../data/benchmarkData.js'

const HARDWARE_ALIAS_MAP = {
  hopper: 'dgx-spark-gb10',
  'hopper lab': 'dgx-spark-gb10',
  'dgx spark': 'dgx-spark-gb10',
}

const MODEL_ALIAS_MAP = {
  'qwen3.5 122b a10b': 'qwen3.5-122b-a10b-q4-k-m',
  'qwen 3.5 122b moe': 'qwen3.5-122b-a10b-q4-k-m',
  'gpt oss 20b': 'gpt-oss-20b',
  'gpt oss 120b': 'gpt-oss-120b',
  'gemma3 27b': 'gemma-3-27b',
  'gemma 3 27b': 'gemma-3-27b',
  'hf.co qwen qwen3 30b a3b': 'qwen3.5-35b-a3b-q4-k-m',
  'qwen moe 30b': 'qwen3.5-35b-a3b-q4-k-m',
  'qwen3 coder 30b': 'qwen3.5-27b-q4-k-m',
  'qwen coder 30b': 'qwen3.5-27b-q4-k-m',
}

export function normalizeComparableModelName(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\.gguf$/g, '')
    .replace(/\bq\d+(?:[_.-]?[a-z0-9]+)?\b/g, ' ')
    .replace(/\biq\d+(?:[_.-]?[a-z0-9]+)?\b/g, ' ')
    .replace(/\bmxfp\d+(?:[_.-]?[a-z0-9]+)?\b/g, ' ')
    .replace(/\bmlx\b/g, ' ')
    .replace(/\bgguf\b/g, ' ')
    .replace(/[-_:/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeComparableHardwareName(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\bnvidia\b/g, ' ')
    .replace(/\bapple\b/g, ' ')
    .replace(/[-_:/()+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function findBestModelMatch(value, models = modelOptions) {
  const normalized = normalizeComparableModelName(value)
  if (!normalized) return null

  return (
    models.find((item) => item.id === MODEL_ALIAS_MAP[normalized]) ??
    models.find((item) => {
      const candidate = normalizeComparableModelName(item.id)
      return candidate === normalized
    }) ??
    models.find((item) => {
      const candidate = normalizeComparableModelName(item.name)
      return candidate === normalized
    }) ??
    models.find((item) => {
      const candidate = normalizeComparableModelName(item.name)
      return normalized.includes(candidate) || candidate.includes(normalized)
    }) ??
    null
  )
}

function getMatchMethod(rawValue, matchedValue, aliasMap) {
  const normalized = normalizeComparableModelName(rawValue)
  if (!normalized || !matchedValue) return 'unknown'
  if (aliasMap[normalized] === matchedValue) return 'alias'
  return 'fuzzy'
}

export function getModelSuggestions(value, models = modelOptions, limit = 3) {
  const normalized = normalizeComparableModelName(value)
  if (!normalized) return []

  return models
    .map((item) => {
      const candidate = normalizeComparableModelName(item.name)
      let score = 0

      if (candidate === normalized) score += 100
      if (candidate.includes(normalized)) score += 40
      if (normalized.includes(candidate)) score += 25
      for (const token of normalized.split(' ')) {
        if (token.length >= 3 && candidate.includes(token)) score += 5
      }

      return { item, score }
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((entry) => ({
      id: entry.item.id,
      name: entry.item.name,
      quant: entry.item.quant ?? null,
    }))
}

export function findBestHardwareMatch(value, hardwareList = hardwareOptions) {
  const normalized = normalizeComparableHardwareName(value)
  if (!normalized) return null

  return (
    hardwareList.find((item) => item.id === HARDWARE_ALIAS_MAP[normalized]) ??
    hardwareList.find((item) => normalizeComparableHardwareName(item.id) === normalized) ??
    hardwareList.find((item) => normalizeComparableHardwareName(item.name) === normalized) ??
    hardwareList.find((item) => {
      const candidate = normalizeComparableHardwareName(item.name)
      return normalized.includes(candidate) || candidate.includes(normalized)
    }) ??
    null
  )
}

export function getModelScaling(model) {
  const paramsB = Math.max(model.scalingParamsB ?? model.paramsB ?? 8, 0.5)
  const sizeRatio = paramsB / 8

  return {
    prefillFactor: model.prefillFactor ?? Math.max(0.2, sizeRatio ** 0.92),
    decodeFactor: model.decodeFactor ?? Math.max(0.22, sizeRatio ** 0.88),
    ttftFactor: model.ttftFactor ?? Math.max(0.3, sizeRatio ** 0.72),
  }
}

function getQuantBits(model) {
  const match = model.quant?.match(/q(\d+(?:\.\d+)?)/i)
  if (match) return Number(match[1])
  if (/mxfp4/i.test(model.quant ?? '')) return 4
  if (/\bbf16\b|\bfp16\b|\bf16\b/i.test(model.quant ?? '')) return 16
  if (/fp8|int8|q8/i.test(model.quant ?? '')) return 8
  return 4
}

export function estimateModelMemoryGb(model) {
  if (typeof model.memoryGb === 'number' && Number.isFinite(model.memoryGb)) {
    return model.memoryGb
  }

  const paramsB = Math.max(model.paramsB ?? 8, 0.5)
  const quantBits = getQuantBits(model)
  const baseWeightGb = paramsB * (quantBits / 8)
  const overheadMultiplier = model.paramsB && model.paramsB >= 30 ? 1.2 : 1.12
  return baseWeightGb * overheadMultiplier
}

export function estimateKvCacheGb(model, promptTokens = 1200, responseTokens = 220) {
  const totalTokens = Math.max(promptTokens + responseTokens, 0)
  if (!totalTokens) return 0

  const paramsB = Math.max(model.paramsB ?? 8, 0.5)
  const kvCachePer64kGb = paramsB * 0.8
  return (totalTokens / 65536) * kvCachePer64kGb
}

export function estimateRuntimeOverheadGb(model) {
  const weightGb = estimateModelMemoryGb(model)
  return Math.max(0.6, weightGb * 0.08)
}

export function assessModelFit(hardware, model, promptTokens = 1200, responseTokens = 220) {
  const weightGb = estimateModelMemoryGb(model)
  const kvCacheGb = estimateKvCacheGb(model, promptTokens, responseTokens)
  const runtimeOverheadGb = estimateRuntimeOverheadGb(model)
  const requiredGb = weightGb + kvCacheGb + runtimeOverheadGb

  if (hardware.memoryGb == null) {
    return {
      status: 'unknown',
      fits: null,
      availableGb: null,
      requiredGb,
      weightGb,
      kvCacheGb,
      runtimeOverheadGb,
      message: `Memory fit is unknown. LapTime estimates about ${requiredGb.toFixed(1)} GB total at this context.`,
    }
  }

  const availableGb = hardware.memoryGb
  const headroomGb = availableGb - requiredGb

  if (requiredGb > availableGb) {
    return {
      status: 'unfit',
      fits: false,
      availableGb,
      requiredGb,
      weightGb,
      kvCacheGb,
      runtimeOverheadGb,
      headroomGb,
      message: `LapTime estimates about ${requiredGb.toFixed(1)} GB total versus ${availableGb} GB available.`,
    }
  }

  if (requiredGb > availableGb * 0.85) {
    return {
      status: 'tight',
      fits: true,
      availableGb,
      requiredGb,
      weightGb,
      kvCacheGb,
      runtimeOverheadGb,
      headroomGb,
      message: `LapTime estimates a tight fit: about ${requiredGb.toFixed(1)} GB total with roughly ${headroomGb.toFixed(1)} GB headroom.`,
    }
  }

  return {
    status: 'fit',
    fits: true,
    availableGb,
    requiredGb,
    weightGb,
    kvCacheGb,
    runtimeOverheadGb,
    headroomGb,
    message: `LapTime estimates about ${requiredGb.toFixed(1)} GB total on ${availableGb} GB available.`,
  }
}

export function getBenchmarkEntry(hardwareId, modelId) {
  return benchmarkMatrix[hardwareId]?.[modelId] ?? null
}

export function getBenchmarkCoverage(benchmark) {
  if (!benchmark) return 'none'
  return benchmark.coverage ?? 'exact'
}

function inferRuntimeLabel(source) {
  const normalized = String(source ?? '').toLowerCase()

  if (!normalized) return null
  if (normalized.includes('manual')) return 'Manual override'
  if (normalized.includes('vllm')) return 'vLLM'
  if (normalized.includes('mlx')) return 'MLX'
  if (normalized.includes('ollama')) return 'Ollama'
  if (normalized.includes('llama.cpp')) return 'llama.cpp'
  if (normalized.includes('rocm')) return 'ROCm backend'
  if (normalized.includes('vulkan')) return 'Vulkan backend'
  return null
}

export function calculateEstimatedMetrics(hardware, model, promptTokens = 1200) {
  const benchmark = getBenchmarkEntry(hardware.id, model.id)
  let source
  let prefillTps
  let decodeTps
  let ttftMs

  if (benchmark) {
    source = benchmark.source
    prefillTps = benchmark.prefillTps
    decodeTps = benchmark.decodeTps
    ttftMs = benchmark.ttftMs
  } else {
    const scaling = getModelScaling(model)
    source = `${hardware.source} · ${model.name} modeled from the hardware reference baseline`
    prefillTps = hardware.prefillBase / scaling.prefillFactor
    decodeTps = hardware.decodeBase / scaling.decodeFactor
    ttftMs = hardware.ttftBase * scaling.ttftFactor
  }

  ttftMs += promptTokens * 0.16

  return {
    prefillTps,
    decodeTps,
    ttftMs,
    source,
    observedRuntime: inferRuntimeLabel(source),
    coverage: getBenchmarkCoverage(benchmark),
  }
}

function summarizeDelta(observed, estimated, lowerIsBetter = false) {
  if (!Number.isFinite(observed) || !Number.isFinite(estimated) || estimated === 0) {
    return null
  }

  const absolute = observed - estimated
  const percent = (absolute / estimated) * 100
  let tone = 'close'

  if (Math.abs(percent) >= 25) {
    tone = lowerIsBetter ? (percent <= 0 ? 'better' : 'worse') : percent >= 0 ? 'better' : 'worse'
  } else if (Math.abs(percent) >= 10) {
    tone = 'notable'
  }

  return {
    absolute,
    percent,
    tone,
  }
}

export function buildTelemetrySnapshot({
  hardwareId,
  hardwareName,
  modelId,
  modelName,
  runtime,
  promptTokens = 1200,
  responseTokens = 220,
  observedPrefillTps,
  observedDecodeTps,
  observedTtftMs,
} = {}) {
  const hardware =
    hardwareOptions.find((item) => item.id === hardwareId) ??
    findBestHardwareMatch(hardwareName) ??
    null
  const model =
    modelOptions.find((item) => item.id === modelId) ??
    findBestModelMatch(modelName) ??
    null

  if (!hardware || !model) {
    return {
      ok: false,
      error: !hardware && !model
        ? 'Unable to resolve both hardware and model.'
        : !hardware
          ? 'Unable to resolve hardware.'
          : 'Unable to resolve model.',
      resolution: {
        hardware: hardware
          ? { id: hardware.id, name: hardware.name }
          : null,
        model: model
          ? { id: model.id, name: model.name }
          : null,
      },
      suggestions: {
        models: !model ? getModelSuggestions(modelName) : [],
      },
    }
  }

  const estimated = calculateEstimatedMetrics(hardware, model, promptTokens)
  const fit = assessModelFit(hardware, model, promptTokens, responseTokens)

  const observed = {
    prefillTps: Number.isFinite(observedPrefillTps) ? observedPrefillTps : null,
    decodeTps: Number.isFinite(observedDecodeTps) ? observedDecodeTps : null,
    ttftMs: Number.isFinite(observedTtftMs) ? observedTtftMs : null,
  }

  const comparison = {
    prefill: summarizeDelta(observed.prefillTps, estimated.prefillTps, false),
    decode: summarizeDelta(observed.decodeTps, estimated.decodeTps, false),
    ttft: summarizeDelta(observed.ttftMs, estimated.ttftMs, true),
  }

  return {
    ok: true,
    resolution: {
      hardware: {
        id: hardware.id,
        name: hardware.name,
        memoryGb: hardware.memoryGb ?? null,
        matchMethod: hardwareId ? 'id' : HARDWARE_ALIAS_MAP[normalizeComparableHardwareName(hardwareName)] ? 'alias' : 'fuzzy',
      },
      model: {
        id: model.id,
        name: model.name,
        quant: model.quant ?? null,
        matchMethod: modelId ? 'id' : getMatchMethod(modelName, model.id, MODEL_ALIAS_MAP),
      },
    },
    context: {
      promptTokens,
      responseTokens,
      runtime: runtime ?? estimated.observedRuntime ?? null,
    },
    laptime: {
      estimated,
      fit,
    },
    observed,
    comparison,
  }
}
