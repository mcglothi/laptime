import { useCallback, useEffect, useState } from 'react'
import {
  benchmarkMatrix,
  communityBenchmarks,
  dataSources,
  hardwareOptions,
  modelOptions,
  workloadOptions,
} from './data/benchmarkData'
import CatalogSection from './components/CatalogSection'
import ComparisonSection from './components/ComparisonSection'
import MethodologySection from './components/MethodologySection'
import SubmissionSection from './components/SubmissionSection'
import SimulatorSection from './components/SimulatorSection'
import SourceExplorerSection from './components/SourceExplorerSection'
import './App.css'
import flagsMark from '../flags.png'

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function formatSeconds(value) {
  return `${value.toFixed(value >= 10 ? 1 : 2)}s`
}

function formatTokenCount(value) {
  if (value >= 1000) {
    const short = value >= 10000 ? Math.round(value / 1000) : Number((value / 1000).toFixed(1))
    return `${short}k`
  }
  return `${value}`
}

const CONTEXT_TOKENS_MIN = 128
const CONTEXT_TOKENS_MAX = 128000

function normalizeComparableModelName(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\.gguf$/g, '')
    .replace(/\bq\d+(?:[_.-]?[a-z0-9]+)?\b/g, ' ')
    .replace(/\biq\d+(?:[_.-]?[a-z0-9]+)?\b/g, ' ')
    .replace(/\bmxfp\d+(?:[_.-]?[a-z0-9]+)?\b/g, ' ')
    .replace(/\bmlx\b/g, ' ')
    .replace(/\bgguf\b/g, ' ')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function findBestModelMatch(parsedModelName, models) {
  const normalizedParsed = normalizeComparableModelName(parsedModelName)
  if (!normalizedParsed) return null

  return (
    models.find((item) => {
      const normalizedCandidate = normalizeComparableModelName(item.name)
      return (
        normalizedParsed === normalizedCandidate ||
        normalizedParsed.includes(normalizedCandidate) ||
        normalizedCandidate.includes(normalizedParsed)
      )
    }) ?? null
  )
}

function buildFilteredOptions(items, query, selectedId, fields) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return items

  const filtered = items.filter((item) =>
    fields.some((field) => String(item[field] ?? '').toLowerCase().includes(normalized)),
  )

  if (filtered.some((item) => item.id === selectedId)) return filtered

  const selected = items.find((item) => item.id === selectedId)
  return selected ? [selected, ...filtered] : filtered
}

function parsePositiveNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseHuggingFaceRepoReference(value) {
  const normalized = String(value ?? '').trim()
  if (!normalized) return null

  try {
    const parsedUrl = new URL(normalized)
    if (!parsedUrl.hostname.includes('huggingface.co')) {
      return null
    }

    const parts = parsedUrl.pathname.split('/').filter(Boolean)
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`
    }
    return null
  } catch {
    const match = normalized.match(/^([A-Za-z0-9._-]+\/[A-Za-z0-9._-]+)$/)
    return match ? match[1] : null
  }
}

function normalizeHuggingFaceSearchQuery(value) {
  return String(value ?? '')
    .trim()
    .replace(/^https?:\/\/huggingface\.co\//i, '')
    .replace(/^huggingface\.co\//i, '')
}

function toTitleCase(value) {
  return String(value ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim()
}

function extractQuantLabel(value, fallbackPrecision) {
  const normalized = String(value ?? '')
  const patterns = [
    /MXFP4(?:[_-]MOE)?/i,
    /IQ\d+(?:[_-][A-Z0-9]+)?/i,
    /Q\d+(?:\.\d+)?(?:[_-][A-Z0-9]+)*/i,
    /BF16/i,
    /FP16/i,
    /\bF16\b/i,
    /FP8/i,
    /INT8/i,
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (match) {
      return match[0].replace(/-/g, '_').toUpperCase()
    }
  }

  if (fallbackPrecision) {
    return String(fallbackPrecision).toUpperCase()
  }

  return 'Source precision'
}

function extractParamsFromName(value) {
  const normalized = String(value ?? '')
  const activeMatch = normalized.match(/A(\d+(?:\.\d+)?)B/i)
  const totalMatch = normalized.match(/(\d+(?:\.\d+)?)B(?![A-Za-z])/i)

  return {
    paramsB: totalMatch ? Number(totalMatch[1]) : null,
    scalingParamsB: activeMatch ? Number(activeMatch[1]) : null,
  }
}

const importedQuantOptions = [
  'Source precision',
  'Q4_K_M',
  'Q6_K',
  'Q8_0',
  'IQ4_XS',
  'BF16',
  'FP16',
  'FP8',
  'MXFP4',
]

function buildImportedModelOption(payload, quantOverride = '') {
  const repo = payload.id ?? payload.modelId
  if (!repo) {
    throw new Error('Model repo not found in Hugging Face response.')
  }

  const repoName = repo.split('/').pop() ?? repo
  const safetensorsParams = payload.safetensors?.parameters ?? {}
  const safetensorsKeys = Object.keys(safetensorsParams)
  const safetensorsPrecision = safetensorsKeys[0] ?? null
  const safetensorsTotal = Number(payload.safetensors?.total ?? 0)
  const nameDerivedParams = extractParamsFromName(repoName)
  const paramsB = safetensorsTotal > 0 ? safetensorsTotal / 1_000_000_000 : nameDerivedParams.paramsB
  const sourceQuant = extractQuantLabel(repoName, safetensorsPrecision)
  const quant = quantOverride || sourceQuant
  const family =
    payload.config?.model_type != null
      ? toTitleCase(payload.config.model_type)
      : toTitleCase(repoName.split(/[-_]/)[0] ?? 'Imported')

  const option = {
    id: `hf:${repo.toLowerCase()}`,
    name: repoName.replace(/[-_]+/g, ' ').trim(),
    family,
    paramsB: paramsB != null ? Number(paramsB.toFixed(paramsB >= 20 ? 0 : 1)) : 8,
    quant,
    importedSourceQuant: sourceQuant,
    importedQuantOverride: quantOverride || '',
    fit: `Imported from Hugging Face (${repo}). Runtime speeds are still modeled from LapTime's baseline until a direct benchmark row exists.`,
    huggingFaceRepo: repo,
    source: 'Imported from Hugging Face metadata',
  }

  if (nameDerivedParams.scalingParamsB != null) {
    option.scalingParamsB = nameDerivedParams.scalingParamsB
  }

  return option
}

const defaultCustomHardwareProfile = {
  name: 'Custom speeds',
  spec: 'Manual override',
  buyer: 'Set your own prefill, decode, and TTFT like TokenFlow.',
  source: 'Manual',
  memoryGb: null,
}

const defaultCustomMetrics = {
  prefillTps: 3000,
  decodeTps: 60,
  ttftMs: 350,
}

function getInitialShareState() {
  const defaults = {
    customHardwareProfile: defaultCustomHardwareProfile,
    customMetrics: defaultCustomMetrics,
    hardwareId: hardwareOptions[1].id,
    huggingFaceRepo: '',
    huggingFaceQuantOverride: '',
    modelId: modelOptions[1].id,
    workloadId: workloadOptions[0].id,
    compareHardwareId: hardwareOptions[3].id,
    contextTokens: workloadOptions[0].promptTokens,
    isPromptExpanded: false,
  }

  if (typeof window === 'undefined') return defaults

  const params = new URLSearchParams(window.location.search)
  if (!params.toString()) return defaults

  const hardwareIds = new Set(hardwareOptions.map((item) => item.id))
  const modelIds = new Set(modelOptions.map((item) => item.id))
  const workloadIds = new Set(workloadOptions.map((item) => item.id))

  const customHardwareProfile = {
    ...defaultCustomHardwareProfile,
  }
  const customMetrics = {
    ...defaultCustomMetrics,
  }

  if (params.get('cname')) customHardwareProfile.name = params.get('cname')
  if (params.get('cspec')) customHardwareProfile.spec = params.get('cspec')

  const customMemoryGb = parsePositiveNumber(params.get('cmem'))
  if (customMemoryGb != null) {
    customHardwareProfile.memoryGb = customMemoryGb
  }

  const customPrefillTps = parsePositiveNumber(params.get('cp'))
  if (customPrefillTps != null) {
    customMetrics.prefillTps = customPrefillTps
  }

  const customDecodeTps = parsePositiveNumber(params.get('cd'))
  if (customDecodeTps != null) {
    customMetrics.decodeTps = customDecodeTps
  }

  const customTtftMs = parsePositiveNumber(params.get('ct'))
  if (customTtftMs != null) {
    customMetrics.ttftMs = customTtftMs
  }

  return {
    customHardwareProfile,
    customMetrics,
    hardwareId: hardwareIds.has(params.get('hw')) ? params.get('hw') : defaults.hardwareId,
    huggingFaceRepo: parseHuggingFaceRepoReference(params.get('hf')) ?? defaults.huggingFaceRepo,
    huggingFaceQuantOverride:
      importedQuantOptions.includes(params.get('hfq')) ? params.get('hfq') : defaults.huggingFaceQuantOverride,
    compareHardwareId: hardwareIds.has(params.get('cmp'))
      ? params.get('cmp')
      : defaults.compareHardwareId,
    modelId: modelIds.has(params.get('m')) ? params.get('m') : defaults.modelId,
    workloadId: workloadIds.has(params.get('w')) ? params.get('w') : defaults.workloadId,
    contextTokens: parsePositiveNumber(params.get('ctx')) ?? defaults.contextTokens,
    isPromptExpanded: params.get('prompt') === 'expanded',
  }
}

function buildShareParams({
  hardwareId,
  compareHardwareId,
  huggingFaceRepo,
  huggingFaceQuantOverride,
  modelId,
  workloadId,
  contextTokens,
  isPromptExpanded,
  customHardwareProfile,
  customMetrics,
}) {
  const params = new URLSearchParams({
    hw: hardwareId,
    cmp: compareHardwareId,
    m: modelId,
    w: workloadId,
    ctx: String(contextTokens),
  })

  if (isPromptExpanded) {
    params.set('prompt', 'expanded')
  }

  if (huggingFaceRepo) {
    params.set('hf', huggingFaceRepo)
    if (huggingFaceQuantOverride) {
      params.set('hfq', huggingFaceQuantOverride)
    }
  }

  if (hardwareId === 'custom' || compareHardwareId === 'custom') {
    params.set('cname', customHardwareProfile.name)
    params.set('cspec', customHardwareProfile.spec)
    if (customHardwareProfile.memoryGb != null) {
      params.set('cmem', String(customHardwareProfile.memoryGb))
    }
    params.set('cp', String(customMetrics.prefillTps))
    params.set('cd', String(customMetrics.decodeTps))
    params.set('ct', String(customMetrics.ttftMs))
  }

  return params
}

function uniqueFamilies(items) {
  return ['all', ...new Set(items.map((item) => item.family).filter(Boolean))]
}

function getHardwarePlatform(hardware) {
  if (hardware.id === 'custom') return 'Custom'
  if (
    hardware.id.startsWith('mac') ||
    hardware.id.startsWith('m1-') ||
    hardware.name.includes('Mac')
  ) {
    return 'Apple Silicon'
  }
  if (
    hardware.id.includes('dgx-spark') ||
    hardware.id.includes('gx10') ||
    hardware.id.includes('pgx') ||
    hardware.id.includes('ms-c931')
  ) {
    return 'GB10 Systems'
  }
  if (
    hardware.id.includes('strix') ||
    hardware.id.includes('framework-desktop') ||
    hardware.id.includes('hp-z2-mini-g1a') ||
    hardware.id.includes('rog-flow-z13') ||
    hardware.id.includes('beelink-gtr9')
  ) {
    return 'AMD Strix Halo'
  }
  if (
    hardware.name.includes('RTX') ||
    hardware.name.includes('A100') ||
    hardware.name.includes('H100')
  ) {
    return 'NVIDIA GPU'
  }
  return 'Other'
}

function uniqueHardwarePlatforms(items) {
  return ['all', ...new Set(items.map((item) => item.platform).filter(Boolean))]
}

function extractChipGeneration(name) {
  const match = name.match(/\bM(\d+)\b/i)
  return match ? Number(match[1]) : null
}

function getAppleTierRank(name) {
  const normalized = name.toLowerCase()
  if (normalized.includes('ultra')) return 0
  if (normalized.includes('max')) return 1
  if (normalized.includes('pro')) return 2
  return 3
}

function getAppleFormFactorRank(name) {
  const normalized = name.toLowerCase()
  if (normalized.includes('studio')) return 0
  if (normalized.includes('macbook pro')) return 1
  if (normalized.includes('mini')) return 2
  if (normalized.includes('macbook air')) return 3
  return 4
}

function compareHardwareEntries(left, right) {
  if (left.id === 'custom' || right.id === 'custom') {
    return left.id === 'custom' ? -1 : 1
  }

  if (left.platform !== right.platform) {
    return left.platform.localeCompare(right.platform)
  }

  if (left.platform === 'Apple Silicon') {
    const generationDiff = (extractChipGeneration(right.name) ?? -1) - (extractChipGeneration(left.name) ?? -1)
    if (generationDiff !== 0) return generationDiff

    const formFactorDiff = getAppleFormFactorRank(left.name) - getAppleFormFactorRank(right.name)
    if (formFactorDiff !== 0) return formFactorDiff

    const tierDiff = getAppleTierRank(left.name) - getAppleTierRank(right.name)
    if (tierDiff !== 0) return tierDiff

    const memoryDiff = (right.memoryGb ?? -1) - (left.memoryGb ?? -1)
    if (memoryDiff !== 0) return memoryDiff
  }

  if (left.platform === 'GB10 Systems') {
    const memoryDiff = (right.memoryGb ?? -1) - (left.memoryGb ?? -1)
    if (memoryDiff !== 0) return memoryDiff
  }

  return left.name.localeCompare(right.name)
}

function getExperience(totalSeconds) {
  if (totalSeconds < 4.5) return 'Feels instant'
  if (totalSeconds < 9) return 'Feels smooth'
  if (totalSeconds < 18) return 'Feels like waiting'
  return 'Feels batch-first'
}

function getContextDescriptor(promptTokens) {
  if (promptTokens < 2000) return 'Short prompt'
  if (promptTokens < 8000) return 'Multi-turn context'
  if (promptTokens < 32000) return 'Research bundle'
  if (promptTokens < 96000) return 'Large retrieval pack'
  return 'Huge context window'
}

const contextPreviewSegments = [
  'System note: prioritize factual consistency, cite the strongest evidence first, and surface hardware bottlenecks when they materially change user experience.',
  'Retrieved benchmark summary: RTX 4090 holds decode speed well on 8B models, but larger prompt bundles expose bigger differences in prefill throughput across platforms.',
  'Buyer profile: comparing an Apple laptop, a used 3090 tower, and a newer GB10 box for coding, summarization, and retrieval-heavy note synthesis.',
  'Product notes: latency perception matters more than peak tokens/sec when the workflow involves long markdown context, PDF extracts, or agent traces.',
  'Interview excerpt: users describe 2 to 4 second TTFT as fine for chat, but anything above that starts to feel like waiting for the machine to wake up.',
  'Tool trace: retrieved snippets from issue threads, changelog entries, benchmark tables, and hardware spec pages that all need to be ingested before generation.',
  'Risk note: memory fit, offload behavior, and backend choice can dominate perceived performance even when the advertised GPU appears fast on short prompts.',
  'Comparison goal: estimate how this setup feels at 8k, 32k, and 128k contexts before buying or recommending a workstation build.',
]

function buildPromptPreview(basePrompt, promptTokens) {
  const desiredChars = Math.max(180, Math.round(promptTokens * 3.4))
  const blocks = [basePrompt]
  let length = basePrompt.length
  let index = 0

  while (length < Math.min(desiredChars, 3600) && index < contextPreviewSegments.length) {
    const segment = contextPreviewSegments[index]
    blocks.push(segment)
    length += segment.length
    index += 1
  }

  if (promptTokens >= 12000) {
    blocks.push(
      `Additional context omitted here: roughly ${formatTokenCount(
        promptTokens,
      )} of retrieved notes, code excerpts, benchmark rows, meeting summaries, and tool logs are being ingested before generation begins.`,
    )
  }

  return blocks.join('\n\n')
}

function getModelScaling(model) {
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

function estimateModelMemoryGb(model) {
  if (typeof model.memoryGb === 'number' && Number.isFinite(model.memoryGb)) {
    return model.memoryGb
  }

  const paramsB = Math.max(model.paramsB ?? 8, 0.5)
  const quantBits = getQuantBits(model)
  const baseWeightGb = paramsB * (quantBits / 8)
  const overheadMultiplier = model.paramsB && model.paramsB >= 30 ? 1.2 : 1.12
  return baseWeightGb * overheadMultiplier
}

function estimateKvCacheGb(model, workload) {
  const totalTokens = Math.max((workload?.promptTokens ?? 0) + (workload?.responseTokens ?? 0), 0)
  if (!totalTokens) return 0

  const paramsB = Math.max(model.paramsB ?? 8, 0.5)
  const kvCachePer64kGb = paramsB * 0.8
  return (totalTokens / 65536) * kvCachePer64kGb
}

function estimateRuntimeOverheadGb(model) {
  const weightGb = estimateModelMemoryGb(model)
  return Math.max(0.6, weightGb * 0.08)
}

function assessModelFit(hardware, model, workload) {
  const weightGb = estimateModelMemoryGb(model)
  const kvCacheGb = estimateKvCacheGb(model, workload)
  const runtimeOverheadGb = estimateRuntimeOverheadGb(model)
  const requiredGb = weightGb + kvCacheGb + runtimeOverheadGb

  if (hardware.memoryGb == null) {
    return {
      fits: null,
      availableGb: null,
      requiredGb,
      weightGb,
      kvCacheGb,
      runtimeOverheadGb,
      message: `Memory fit is unknown for custom hardware. LapTime estimates about ${requiredGb.toFixed(1)} GB total at this context, including ${weightGb.toFixed(1)} GB of weights and ${kvCacheGb.toFixed(1)} GB of context cache.`,
      status: 'unknown',
    }
  }

  const availableGb = hardware.memoryGb
  const headroomGb = availableGb - requiredGb

  if (requiredGb > availableGb) {
    return {
      fits: false,
      availableGb,
      requiredGb,
      weightGb,
      kvCacheGb,
      runtimeOverheadGb,
      headroomGb,
      status: 'unfit',
      message: `At ${workload.promptTokens.toLocaleString()} prompt tokens, LapTime estimates about ${requiredGb.toFixed(1)} GB total (${weightGb.toFixed(1)} GB weights, ${kvCacheGb.toFixed(1)} GB context cache, ${runtimeOverheadGb.toFixed(1)} GB runtime overhead) versus ${availableGb} GB available.`,
    }
  }

  if (requiredGb > availableGb * 0.85) {
    return {
      fits: true,
      availableGb,
      requiredGb,
      weightGb,
      kvCacheGb,
      runtimeOverheadGb,
      headroomGb,
      status: 'tight',
      message: `This is a tight fit at the current context. LapTime estimates about ${requiredGb.toFixed(1)} GB total (${weightGb.toFixed(1)} GB weights, ${kvCacheGb.toFixed(1)} GB context cache, ${runtimeOverheadGb.toFixed(1)} GB runtime overhead), leaving roughly ${headroomGb.toFixed(1)} GB of headroom.`,
    }
  }

  return {
    fits: true,
    availableGb,
    requiredGb,
    weightGb,
    kvCacheGb,
    runtimeOverheadGb,
    headroomGb,
    status: 'fit',
    message: `Estimated total memory at this context is about ${requiredGb.toFixed(1)} GB (${weightGb.toFixed(1)} GB weights, ${kvCacheGb.toFixed(1)} GB context cache, ${runtimeOverheadGb.toFixed(1)} GB runtime overhead) on ${availableGb} GB available.`,
  }
}

function getBenchmarkEntry(hardwareId, modelId) {
  return benchmarkMatrix[hardwareId]?.[modelId] ?? null
}

function getBenchmarkCoverage(benchmark) {
  if (!benchmark) return 'none'
  return benchmark.coverage ?? 'exact'
}

function getCoverageIndicator(coverage) {
  if (coverage === 'exact') return { symbol: '🟢', label: 'Benchmark-backed' }
  if (coverage === 'source-backed') return { symbol: '🔵', label: 'Source-backed runtime' }
  if (coverage === 'community-runtime') return { symbol: '🟡', label: 'Community runtime' }
  return { symbol: '⚪', label: 'Estimated only' }
}

function calculateMetrics(hardware, model, workload, customMetrics) {
  let prefillTps
  let decodeTps
  let ttftMs
  let source

  if (hardware.id === 'custom') {
    prefillTps = customMetrics.prefillTps
    decodeTps = customMetrics.decodeTps
    ttftMs = customMetrics.ttftMs
    source = hardware.source ?? 'Manual'
    } else {
      const benchmark = getBenchmarkEntry(hardware.id, model.id)
      if (benchmark) {
        prefillTps = benchmark.prefillTps
        decodeTps = benchmark.decodeTps
      ttftMs = benchmark.ttftMs
      source = benchmark.source
      } else {
        const scaling = getModelScaling(model)
        prefillTps = hardware.prefillBase / scaling.prefillFactor
        decodeTps = hardware.decodeBase / scaling.decodeFactor
        ttftMs = hardware.ttftBase * scaling.ttftFactor
        source = `${hardware.source} · ${model.name} modeled from the hardware reference baseline`
      }
    }

  ttftMs += workload.promptTokens * 0.16
  const prefillSeconds = workload.promptTokens / prefillTps
  const streamingSeconds = workload.responseTokens / decodeTps
  const totalSeconds = prefillSeconds + ttftMs / 1000 + streamingSeconds

  return {
    prefillTps,
    decodeTps,
    ttftMs,
    prefillSeconds,
    streamingSeconds,
    totalSeconds,
    experience: getExperience(totalSeconds),
    source,
  }
}

function resolveWorkload(selectedWorkload, customPreset, contextTokens) {
  const promptTokens = contextTokens
  const responseTokens =
    selectedWorkload.id === 'custom' ? customPreset.responseTokens : selectedWorkload.responseTokens

  return {
    ...selectedWorkload,
    promptTokens,
    responseTokens,
    prompt: buildPromptPreview(selectedWorkload.prompt, promptTokens),
    contextDescriptor: getContextDescriptor(promptTokens),
  }
}

function App() {
  const [initialShareState] = useState(() => getInitialShareState())
  const [customHardwareProfile, setCustomHardwareProfile] = useState(initialShareState.customHardwareProfile)
  const [huggingFaceImportInput, setHuggingFaceImportInput] = useState(initialShareState.huggingFaceRepo)
  const [huggingFaceQuantOverride, setHuggingFaceQuantOverride] = useState(initialShareState.huggingFaceQuantOverride)
  const [huggingFaceImportState, setHuggingFaceImportState] = useState({
    status: 'idle',
    message: '',
  })
  const [huggingFaceSearchQuery, setHuggingFaceSearchQuery] = useState('')
  const [huggingFaceSearchResults, setHuggingFaceSearchResults] = useState([])
  const [importedModel, setImportedModel] = useState(null)
  const [importedModelPayload, setImportedModelPayload] = useState(null)
  const hardwareEntries = hardwareOptions
    .map((item) => {
      const mergedItem =
        item.id === 'custom'
          ? {
              ...item,
              ...customHardwareProfile,
            }
          : item

      return {
        ...mergedItem,
        platform: getHardwarePlatform(mergedItem),
      }
    })
    .sort(compareHardwareEntries)
  const nonCustomHardwareEntries = hardwareEntries.filter((item) => item.id !== 'custom')
  const hardwarePlatformOptions = uniqueHardwarePlatforms(nonCustomHardwareEntries)
  const [hardwareId, setHardwareId] = useState(initialShareState.hardwareId)
  const [modelId, setModelId] = useState(initialShareState.modelId)
  const [workloadId, setWorkloadId] = useState(initialShareState.workloadId)
  const [compareHardwareId, setCompareHardwareId] = useState(initialShareState.compareHardwareId)
  const [hardwareQuery, setHardwareQuery] = useState('')
  const [modelQuery, setModelQuery] = useState('')
  const [compareHardwareQuery, setCompareHardwareQuery] = useState('')
  const [hardwarePlatformFilter, setHardwarePlatformFilter] = useState('all')
  const [compareHardwarePlatformFilter, setCompareHardwarePlatformFilter] = useState('all')
  const [modelFamilyFilter, setModelFamilyFilter] = useState('all')
  const [catalogFamilyFilter, setCatalogFamilyFilter] = useState('all')
  const [sourceQuery, setSourceQuery] = useState('')
  const [communityFilter, setCommunityFilter] = useState('all')
  const [theme, setTheme] = useState('dark')
  const [isPlaying, setIsPlaying] = useState(true)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [customMetrics, setCustomMetrics] = useState(initialShareState.customMetrics)
  const [customPreset, setCustomPreset] = useState({
    responseTokens: 220,
  })
  const [contextTokens, setContextTokens] = useState(
    clamp(initialShareState.contextTokens, CONTEXT_TOKENS_MIN, CONTEXT_TOKENS_MAX),
  )
  const [isPromptExpanded, setIsPromptExpanded] = useState(initialShareState.isPromptExpanded)
  const activeModelOptions = importedModel ? [importedModel, ...modelOptions] : modelOptions

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    function scrollToCurrentHash() {
      if (!window.location.hash) return

      const targetId = window.location.hash.replace('#', '')
      if (!targetId) return

      const target = document.getElementById(targetId)
      if (target) {
        target.scrollIntoView({ behavior: 'auto', block: 'start' })
      }
    }

    const timeoutId = window.setTimeout(scrollToCurrentHash, 60)
    window.addEventListener('hashchange', scrollToCurrentHash)

    return () => {
      window.clearTimeout(timeoutId)
      window.removeEventListener('hashchange', scrollToCurrentHash)
    }
  }, [])

  const hardware = hardwareEntries.find((item) => item.id === hardwareId) ?? hardwareEntries[1]
  const model = activeModelOptions.find((item) => item.id === modelId) ?? activeModelOptions[0]
  const selectedWorkload = workloadOptions.find((item) => item.id === workloadId) ?? workloadOptions[0]
  const workload = resolveWorkload(selectedWorkload, customPreset, contextTokens)
  const metrics = calculateMetrics(hardware, model, workload, customMetrics)
  const runCoverage = getBenchmarkCoverage(getBenchmarkEntry(hardware.id, model.id))
  const fitAssessment = assessModelFit(hardware, model, workload)
  const compareHardware =
    hardwareEntries.find((item) => item.id === compareHardwareId) ?? hardwareEntries[2]
  const compareModel = model
  const compareMetrics = calculateMetrics(compareHardware, compareModel, workload, customMetrics)
  const compareFitAssessment = assessModelFit(compareHardware, compareModel, workload)
  const platformFilteredHardware =
    hardwarePlatformFilter === 'all'
      ? hardwareEntries
      : hardwareEntries.filter(
          (option) => option.id === 'custom' || option.platform === hardwarePlatformFilter,
        )
  const visibleHardwareOptions = buildFilteredOptions(
    platformFilteredHardware,
    hardwareQuery,
    hardwareId,
    ['name', 'spec', 'buyer', 'platform'],
  )
  const modelFamilyOptions = uniqueFamilies(activeModelOptions)
  const familyFilteredModels =
    modelFamilyFilter === 'all'
      ? activeModelOptions
      : activeModelOptions.filter((option) => option.family === modelFamilyFilter)
  const visibleModelOptions = buildFilteredOptions(
    familyFilteredModels,
    modelQuery,
    modelId,
    ['name', 'family', 'quant', 'fit'],
  )
  const visibleModelEntries = visibleModelOptions.map((option) => ({
    ...option,
    fitAssessment: assessModelFit(hardware, option, workload),
    benchmarkCoverage: getBenchmarkCoverage(getBenchmarkEntry(hardware.id, option.id)),
    coverageIndicator: getCoverageIndicator(getBenchmarkCoverage(getBenchmarkEntry(hardware.id, option.id))),
  }))
  const comparePlatformFilteredHardware =
    compareHardwarePlatformFilter === 'all'
      ? nonCustomHardwareEntries
      : nonCustomHardwareEntries.filter((option) => option.platform === compareHardwarePlatformFilter)
  const compareHardwareOptionPool =
    compareHardwareId === 'custom'
      ? [hardwareEntries.find((item) => item.id === 'custom'), ...comparePlatformFilteredHardware].filter(Boolean)
      : comparePlatformFilteredHardware
  const visibleCompareHardwareOptions = buildFilteredOptions(
    compareHardwareOptionPool,
    compareHardwareQuery,
    compareHardwareId,
    ['name', 'spec', 'buyer', 'platform'],
  )
  const catalogModels =
    catalogFamilyFilter === 'all'
      ? activeModelOptions
      : activeModelOptions.filter((option) => option.family === catalogFamilyFilter)
  const catalogEntries = catalogModels.map((entry) => ({
    ...entry,
    fitAssessment: assessModelFit(hardware, entry, workload),
    benchmarkCoverage: getBenchmarkCoverage(getBenchmarkEntry(hardwareId, entry.id)),
  }))

  function restartSimulation() {
    setElapsedMs(0)
    setIsPlaying(true)
  }

  function handleCompareHardwarePlatformFilterChange(nextFilter) {
    setCompareHardwarePlatformFilter(nextFilter)

    const nextOptions =
      nextFilter === 'all'
        ? nonCustomHardwareEntries
        : nonCustomHardwareEntries.filter((option) => option.platform === nextFilter)

    if (nextOptions.some((option) => option.id === compareHardwareId)) {
      return
    }

    const fallbackHardware = nextOptions[0]
    if (fallbackHardware) {
      setCompareHardwareId(fallbackHardware.id)
    }
  }

  function handleHardwarePlatformFilterChange(nextFilter) {
    setHardwarePlatformFilter(nextFilter)

    const nextOptions =
      nextFilter === 'all'
        ? hardwareEntries
        : nonCustomHardwareEntries.filter((option) => option.platform === nextFilter)

    if (nextOptions.some((option) => option.id === hardwareId)) {
      return
    }

    const fallbackHardware = nextOptions[0]
    if (fallbackHardware) {
      setHardwareId(fallbackHardware.id)
    }
  }

  function syncParsedLap(parsedLap) {
    setCustomMetrics({
      prefillTps: parsedLap.prefillTps,
      decodeTps: parsedLap.decodeTps,
      ttftMs: Math.round(parsedLap.ttftMs),
    })
    setCustomHardwareProfile({
      name: parsedLap.hardware || 'Parsed custom rig',
      spec: parsedLap.backend ? `${parsedLap.backend} benchmark log` : 'Parsed benchmark log',
      buyer: 'Loaded from a parsed benchmark log for side-by-side LapTime races.',
      source: 'Parsed benchmark log',
      memoryGb: parsedLap.memoryGb ?? null,
    })

    const matchedModel = findBestModelMatch(parsedLap.model, activeModelOptions)
    if (matchedModel) {
      setModelId(matchedModel.id)
    }
  }

  const searchHuggingFaceModels = useCallback(async (inputValue) => {
    const searchQuery = normalizeHuggingFaceSearchQuery(inputValue)

    if (!searchQuery || searchQuery.length < 2) {
      setHuggingFaceSearchQuery('')
      setHuggingFaceSearchResults([])
      setHuggingFaceImportState((current) =>
        current.status === 'idle' && !current.message
          ? current
          : {
              status: 'idle',
              message: '',
            },
      )
      return null
    }

    setHuggingFaceSearchQuery(searchQuery)
    setHuggingFaceSearchResults([])
    setHuggingFaceImportState({
      status: 'loading',
      message: `Searching Hugging Face for "${searchQuery}"...`,
    })

    try {
      const params = new URLSearchParams({ q: searchQuery })
      const response = await fetch(`/api/huggingface-search?${params.toString()}`)
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error ?? 'Hugging Face search failed.')
      }

      const results = Array.isArray(payload.results) ? payload.results : []
      setHuggingFaceSearchResults(results)
      setHuggingFaceImportState({
        status: results.length > 0 ? 'success' : 'error',
        message:
          results.length > 0
            ? `Found ${results.length} public model${results.length === 1 ? '' : 's'} for "${searchQuery}".`
            : `No public text-generation models matched "${searchQuery}".`,
      })
      return results
    } catch (error) {
      setHuggingFaceImportState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Hugging Face search failed.',
      })
      return null
    }
  }, [])

  const importHuggingFaceModel = useCallback(async (inputValue = huggingFaceImportInput, options = {}) => {
    const { selectImportedModel = true } = options
    const repo = parseHuggingFaceRepoReference(inputValue)

    if (!repo) {
      return searchHuggingFaceModels(inputValue)
    }

    setHuggingFaceImportInput(repo)
    setHuggingFaceSearchQuery('')
    setHuggingFaceSearchResults([])
    setHuggingFaceImportState({
      status: 'loading',
      message: `Importing ${repo}...`,
    })

    try {
      const params = new URLSearchParams({ repo })
      const response = await fetch(`/api/huggingface-model?${params.toString()}`)
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error ?? 'Hugging Face import failed.')
      }

      const nextImportedModel = buildImportedModelOption(payload, huggingFaceQuantOverride)
      setImportedModelPayload(payload)
      setImportedModel(nextImportedModel)
      setModelFamilyFilter('all')
      setCatalogFamilyFilter('all')
      setModelQuery('')
      if (selectImportedModel) {
        setModelId(nextImportedModel.id)
      }
      setHuggingFaceImportState({
        status: 'success',
        message: `Imported ${payload.id} from Hugging Face metadata.`,
      })
      return nextImportedModel
    } catch (error) {
      setHuggingFaceImportState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Hugging Face import failed.',
      })
      return null
    }
  }, [huggingFaceImportInput, huggingFaceQuantOverride, searchHuggingFaceModels])

  useEffect(() => {
    if (!importedModelPayload) return

    setImportedModel(buildImportedModelOption(importedModelPayload, huggingFaceQuantOverride))
  }, [huggingFaceQuantOverride, importedModelPayload])

  useEffect(() => {
    const trimmedInput = huggingFaceImportInput.trim()
    const exactRepo = parseHuggingFaceRepoReference(trimmedInput)

    if (!trimmedInput) {
      setHuggingFaceSearchQuery('')
      setHuggingFaceSearchResults([])
      setHuggingFaceImportState((current) =>
        current.status === 'idle' && !current.message
          ? current
          : {
              status: 'idle',
              message: '',
            },
      )
      return undefined
    }

    if (exactRepo) {
      setHuggingFaceSearchQuery('')
      setHuggingFaceSearchResults([])
      setHuggingFaceImportState((current) => {
        const nextMessage = `Exact repo detected: ${exactRepo}. Click import to load it.`
        if (current.status === 'success' && current.message === nextMessage) {
          return current
        }
        return {
          status: 'success',
          message: nextMessage,
        }
      })
      return undefined
    }

    if (normalizeHuggingFaceSearchQuery(trimmedInput).length < 2) {
      setHuggingFaceSearchQuery('')
      setHuggingFaceSearchResults([])
      setHuggingFaceImportState((current) =>
        current.status === 'idle' && !current.message
          ? current
          : {
              status: 'idle',
              message: '',
            },
      )
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      searchHuggingFaceModels(trimmedInput)
    }, 320)

    return () => window.clearTimeout(timeoutId)
  }, [huggingFaceImportInput, searchHuggingFaceModels])

  function applyParsedSubmission(parsedLap) {
    syncParsedLap(parsedLap)
    if (hardwareId !== 'custom') {
      setCompareHardwareId(hardwareId)
    }

    setHardwareId('custom')
    setHardwarePlatformFilter('all')
    setHardwareQuery('')
    setIsPromptExpanded(false)
    restartSimulation()
    window.location.hash = 'simulator'
  }

  function raceParsedSubmission(parsedLap) {
    syncParsedLap(parsedLap)
    setCompareHardwareId('custom')
    setCompareHardwarePlatformFilter('all')
    setCompareHardwareQuery('')
    restartSimulation()
    window.location.hash = 'comparison'
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!initialShareState.huggingFaceRepo) return
    if (importedModel?.huggingFaceRepo === initialShareState.huggingFaceRepo) return

    importHuggingFaceModel(initialShareState.huggingFaceRepo)
  }, [importHuggingFaceModel, importedModel?.huggingFaceRepo, initialShareState.huggingFaceRepo])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const params = buildShareParams({
      hardwareId,
      compareHardwareId,
      huggingFaceRepo: model.huggingFaceRepo ?? '',
      huggingFaceQuantOverride: model.importedQuantOverride ?? '',
      modelId,
      workloadId,
      contextTokens,
      isPromptExpanded,
      customHardwareProfile,
      customMetrics,
    })
    const nextSearch = `?${params.toString()}`
    const currentHash = window.location.hash
    const currentUrl = `${window.location.pathname}${window.location.search}${currentHash}`
    const nextUrl = `${window.location.pathname}${nextSearch}${currentHash}`

    if (currentUrl !== nextUrl) {
      window.history.replaceState({}, '', nextUrl)
    }
  }, [
    compareHardwareId,
    contextTokens,
    customHardwareProfile,
    customMetrics,
    hardwareId,
    model.huggingFaceRepo,
    model.importedQuantOverride,
    isPromptExpanded,
    modelId,
    workloadId,
  ])

  useEffect(() => {
    if (!isPlaying) {
      return undefined
    }

    const startedAt = performance.now()
    const durationMs = metrics.totalSeconds * 1000

    const intervalId = window.setInterval(() => {
      const nextElapsed = performance.now() - startedAt

      if (nextElapsed >= durationMs) {
        setElapsedMs(durationMs)
        setIsPlaying(false)
        window.clearInterval(intervalId)
        return
      }

      setElapsedMs(nextElapsed)
    }, 48)

    return () => window.clearInterval(intervalId)
  }, [isPlaying, metrics.totalSeconds])

  const prefillMs = metrics.prefillSeconds * 1000
  const streamStartMs = prefillMs + metrics.ttftMs
  const streamDurationMs = metrics.streamingSeconds * 1000
  const progress = clamp(elapsedMs / (metrics.totalSeconds * 1000), 0, 1)
  const streamProgress = clamp((elapsedMs - streamStartMs) / streamDurationMs, 0, 1)
  const visibleChars = Math.floor(workload.response.length * streamProgress)
  const streamedText = workload.response.slice(0, visibleChars)
  const currentPhase =
    elapsedMs < prefillMs
      ? 'Ingesting prompt'
      : elapsedMs < streamStartMs
        ? 'Preparing first token'
        : isPlaying
        ? 'Streaming response'
          : 'Playback complete'
  const displayPhase = fitAssessment.status === 'unfit' ? 'Projected memory miss' : currentPhase
  const normalizedQuery = sourceQuery.trim().toLowerCase()
  const filteredStructuredSources = dataSources.filter((source) => {
    if (!normalizedQuery) return true
    return [source.name, source.type, source.notes]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery)
  })
  const filteredCommunityBenchmarks = communityBenchmarks.filter((entry) => {
    const matchesFilter = communityFilter === 'all' || entry.quality === communityFilter
    const matchesQuery =
      !normalizedQuery ||
      [entry.hardware, entry.model, entry.source]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    return matchesFilter && matchesQuery
  })
  const benchmarkRows = Object.entries(benchmarkMatrix).flatMap(([hardwareKey, modelMap]) =>
    Object.values(modelMap).map((entry) => ({ hardwareKey, coverage: getBenchmarkCoverage(entry) })),
  )
  const exactBenchmarkCount = benchmarkRows.filter((entry) => entry.coverage === 'exact').length
  const sourceBackedCount = benchmarkRows.filter((entry) => entry.coverage === 'source-backed').length
  const communityRuntimeCount = benchmarkRows.filter((entry) => entry.coverage === 'community-runtime').length
  const exactHardwareCount = new Set(
    benchmarkRows
      .filter((entry) => entry.coverage === 'exact')
      .map((entry) => entry.hardwareKey),
  ).size
  const sourceBackedHardwareCount = new Set(
    benchmarkRows
      .filter((entry) => entry.coverage === 'source-backed')
      .map((entry) => entry.hardwareKey),
  ).size
  const communityRuntimeHardwareCount = new Set(
    benchmarkRows
      .filter((entry) => entry.coverage === 'community-runtime')
      .map((entry) => entry.hardwareKey),
  ).size
  const officialSourceCount = dataSources.filter((source) => source.type === 'official specs').length
  const catalogSourceCount = dataSources.filter((source) => source.type === 'catalog').length
  const forumCount = communityBenchmarks.filter((entry) => entry.quality === 'forum').length
  const approximateCount = communityBenchmarks.filter((entry) => entry.quality === 'approximate').length

  function buildShareUrl(sectionId) {
    if (typeof window === 'undefined') return ''
    const params = buildShareParams({
      hardwareId,
      compareHardwareId,
      huggingFaceRepo: model.huggingFaceRepo ?? '',
      huggingFaceQuantOverride: model.importedQuantOverride ?? '',
      modelId,
      workloadId,
      contextTokens,
      isPromptExpanded,
      customHardwareProfile,
      customMetrics,
    })

    return `${window.location.origin}${window.location.pathname}?${params.toString()}#${sectionId}`
  }

  const simulatorShareUrl = buildShareUrl('simulator')
  const comparisonShareUrl = buildShareUrl('comparison')
  const simulatorShareTitle = `${hardware.name} vs ${model.name} on LapTime`
  const comparisonShareTitle = `${hardware.name} vs ${compareHardware.name} on LapTime`

  return (
    <div className="app-shell">
      <section className="masthead">
        <div className="brand-lockup">
          <div className="brand-banner">
            <img className="brand-banner-mark" src={flagsMark} alt="Checkered flags" />
            <div>
              <h1>
                <span>LapTime</span>
                <small>Local LLM Simulator</small>
              </h1>
              <p>Test-drive local AI rigs with a more visual, source-aware benchmark feel.</p>
            </div>
          </div>
        </div>
        <button
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="theme-toggle icon-toggle"
          type="button"
          onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
        >
          <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
        </button>
      </section>

      <SimulatorSection
        hardware={hardware}
        hardwareId={hardwareId}
        hardwareQuery={hardwareQuery}
        setHardwareQuery={setHardwareQuery}
        visibleHardwareOptions={visibleHardwareOptions}
        hardwarePlatformOptions={hardwarePlatformOptions}
        hardwarePlatformFilter={hardwarePlatformFilter}
        setHardwarePlatformFilter={handleHardwarePlatformFilterChange}
        setHardwareId={setHardwareId}
        customMetrics={customMetrics}
        setCustomMetrics={setCustomMetrics}
        model={model}
        modelId={modelId}
        modelQuery={modelQuery}
        setModelQuery={setModelQuery}
        visibleModelOptions={visibleModelEntries}
        setModelId={setModelId}
        modelFamilyOptions={modelFamilyOptions}
        modelFamilyFilter={modelFamilyFilter}
        setModelFamilyFilter={setModelFamilyFilter}
        huggingFaceImportInput={huggingFaceImportInput}
        setHuggingFaceImportInput={setHuggingFaceImportInput}
        huggingFaceQuantOptions={importedQuantOptions}
        huggingFaceQuantOverride={huggingFaceQuantOverride}
        setHuggingFaceQuantOverride={setHuggingFaceQuantOverride}
        huggingFaceImportState={huggingFaceImportState}
        huggingFaceSearchQuery={huggingFaceSearchQuery}
        huggingFaceSearchResults={huggingFaceSearchResults}
        importHuggingFaceModel={importHuggingFaceModel}
        workload={workload}
        workloadId={workloadId}
        workloadOptions={workloadOptions}
        setWorkloadId={setWorkloadId}
        contextTokens={contextTokens}
        setContextTokens={setContextTokens}
        formatTokenCount={formatTokenCount}
        isPromptExpanded={isPromptExpanded}
        setIsPromptExpanded={setIsPromptExpanded}
        customPreset={customPreset}
        setCustomPreset={setCustomPreset}
        metrics={metrics}
        runCoverage={runCoverage}
        benchmarkMatrix={benchmarkMatrix}
        communityBenchmarks={communityBenchmarks}
        dataSources={dataSources}
        modelOptions={activeModelOptions}
        fitAssessment={fitAssessment}
        isPlaying={isPlaying}
        currentPhase={displayPhase}
        restartSimulation={restartSimulation}
        streamedText={streamedText}
        elapsedMs={elapsedMs}
        streamStartMs={streamStartMs}
        progress={progress}
        formatSeconds={formatSeconds}
        shareUrl={simulatorShareUrl}
        shareTitle={simulatorShareTitle}
      />

      <ComparisonSection
        hardware={hardware}
        model={model}
        metrics={metrics}
        fitAssessment={fitAssessment}
        compareHardware={compareHardware}
        compareHardwareId={compareHardwareId}
        compareHardwareQuery={compareHardwareQuery}
        setCompareHardwareQuery={setCompareHardwareQuery}
        visibleCompareHardwareOptions={visibleCompareHardwareOptions}
        hardwarePlatformOptions={hardwarePlatformOptions}
        compareHardwarePlatformFilter={compareHardwarePlatformFilter}
        setCompareHardwarePlatformFilter={handleCompareHardwarePlatformFilterChange}
        setCompareHardwareId={setCompareHardwareId}
        compareModel={compareModel}
        compareMetrics={compareMetrics}
        compareFitAssessment={compareFitAssessment}
        elapsedMs={elapsedMs}
        restartSimulation={restartSimulation}
        formatSeconds={formatSeconds}
        shareUrl={comparisonShareUrl}
        shareTitle={comparisonShareTitle}
      />

      <SubmissionSection
        onLoadParsedSubmission={applyParsedSubmission}
        onRaceParsedSubmission={raceParsedSubmission}
      />

      <CatalogSection
        selectedModelId={modelId}
        modelFamilyOptions={modelFamilyOptions}
        catalogFamilyFilter={catalogFamilyFilter}
        setCatalogFamilyFilter={setCatalogFamilyFilter}
        catalogEntries={catalogEntries}
        contextTokens={workload.promptTokens}
      />

      <MethodologySection
        exactBenchmarkCount={exactBenchmarkCount}
        exactHardwareCount={exactHardwareCount}
        sourceBackedCount={sourceBackedCount}
        sourceBackedHardwareCount={sourceBackedHardwareCount}
        communityRuntimeCount={communityRuntimeCount}
        communityRuntimeHardwareCount={communityRuntimeHardwareCount}
        officialSourceCount={officialSourceCount}
        catalogSourceCount={catalogSourceCount}
        communityCount={communityBenchmarks.length}
        forumCount={forumCount}
        approximateCount={approximateCount}
      />

      <SourceExplorerSection
        sourceQuery={sourceQuery}
        setSourceQuery={setSourceQuery}
        communityFilter={communityFilter}
        setCommunityFilter={setCommunityFilter}
        filteredStructuredSources={filteredStructuredSources}
        filteredCommunityBenchmarks={filteredCommunityBenchmarks}
      />
    </div>
  )
}

export default App
