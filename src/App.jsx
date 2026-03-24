import { useEffect, useState } from 'react'
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
  return match ? Number(match[1]) : 4
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

function assessModelFit(hardware, model) {
  if (hardware.memoryGb == null) {
    return {
      fits: null,
      availableGb: null,
      requiredGb: estimateModelMemoryGb(model),
      message: 'Memory fit is unknown for custom hardware.',
      status: 'unknown',
    }
  }

  const requiredGb = estimateModelMemoryGb(model)
  const availableGb = hardware.memoryGb

  if (requiredGb > availableGb) {
    return {
      fits: false,
      availableGb,
      requiredGb,
      status: 'unfit',
      message: `This model likely will not fit in memory. Estimated requirement is about ${requiredGb.toFixed(1)} GB versus ${availableGb} GB available.`,
    }
  }

  if (requiredGb > availableGb * 0.85) {
    return {
      fits: true,
      availableGb,
      requiredGb,
      status: 'tight',
      message: `This is a tight fit. Estimated requirement is about ${requiredGb.toFixed(1)} GB of the ${availableGb} GB available, so overhead and long contexts could still cause issues.`,
    }
  }

  return {
    fits: true,
    availableGb,
    requiredGb,
    status: 'fit',
    message: `Estimated model memory is about ${requiredGb.toFixed(1)} GB on ${availableGb} GB available.`,
  }
}

function getBenchmarkEntry(hardwareId, modelId) {
  return benchmarkMatrix[hardwareId]?.[modelId] ?? null
}

function getBenchmarkCoverage(benchmark) {
  if (!benchmark) return 'none'
  return benchmark.coverage ?? 'exact'
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
      source = 'Estimated from benchmark-backed LocalScore baselines + model size'
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
  const [customHardwareProfile, setCustomHardwareProfile] = useState({
    name: 'Custom speeds',
    spec: 'Manual override',
    buyer: 'Set your own prefill, decode, and TTFT like TokenFlow.',
    source: 'Manual',
    memoryGb: null,
  })
  const hardwareEntries = hardwareOptions.map((item) => {
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
  const nonCustomHardwareEntries = hardwareEntries.filter((item) => item.id !== 'custom')
  const hardwarePlatformOptions = uniqueHardwarePlatforms(nonCustomHardwareEntries)
  const [hardwareId, setHardwareId] = useState(hardwareEntries[1].id)
  const [modelId, setModelId] = useState(modelOptions[1].id)
  const [workloadId, setWorkloadId] = useState(workloadOptions[0].id)
  const [compareHardwareId, setCompareHardwareId] = useState(hardwareEntries[3].id)
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
  const [customMetrics, setCustomMetrics] = useState({
    prefillTps: 3000,
    decodeTps: 60,
    ttftMs: 350,
  })
  const [customPreset, setCustomPreset] = useState({
    responseTokens: 220,
  })
  const [contextTokens, setContextTokens] = useState(workloadOptions[0].promptTokens)
  const [isPromptExpanded, setIsPromptExpanded] = useState(false)

  const hardware = hardwareEntries.find((item) => item.id === hardwareId) ?? hardwareEntries[1]
  const model = modelOptions.find((item) => item.id === modelId) ?? modelOptions[0]
  const selectedWorkload = workloadOptions.find((item) => item.id === workloadId) ?? workloadOptions[0]
  const workload = resolveWorkload(selectedWorkload, customPreset, contextTokens)
  const metrics = calculateMetrics(hardware, model, workload, customMetrics)
  const fitAssessment = assessModelFit(hardware, model)
  const compareHardware =
    hardwareEntries.find((item) => item.id === compareHardwareId) ?? hardwareEntries[2]
  const compareModel = model
  const compareMetrics = calculateMetrics(compareHardware, compareModel, workload, customMetrics)
  const compareFitAssessment = assessModelFit(compareHardware, compareModel)
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
  const modelFamilyOptions = uniqueFamilies(modelOptions)
  const familyFilteredModels =
    modelFamilyFilter === 'all'
      ? modelOptions
      : modelOptions.filter((option) => option.family === modelFamilyFilter)
  const visibleModelOptions = buildFilteredOptions(
    familyFilteredModels,
    modelQuery,
    modelId,
    ['name', 'family', 'quant', 'fit'],
  )
  const visibleModelEntries = visibleModelOptions.map((option) => ({
    ...option,
    fitAssessment: assessModelFit(hardware, option),
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
      ? modelOptions
      : modelOptions.filter((option) => option.family === catalogFamilyFilter)
  const catalogEntries = catalogModels.map((entry) => ({
    ...entry,
    fitAssessment: assessModelFit(hardware, entry),
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

    const matchedModel = findBestModelMatch(parsedLap.model, modelOptions)
    if (matchedModel) {
      setModelId(matchedModel.id)
    }
  }

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
  const officialSourceCount = dataSources.filter((source) => source.type === 'official specs').length
  const catalogSourceCount = dataSources.filter((source) => source.type === 'catalog').length
  const forumCount = communityBenchmarks.filter((entry) => entry.quality === 'forum').length
  const approximateCount = communityBenchmarks.filter((entry) => entry.quality === 'approximate').length

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
        setHardwarePlatformFilter={setHardwarePlatformFilter}
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
        benchmarkMatrix={benchmarkMatrix}
        communityBenchmarks={communityBenchmarks}
        dataSources={dataSources}
        modelOptions={modelOptions}
        fitAssessment={fitAssessment}
        isPlaying={isPlaying}
        currentPhase={displayPhase}
        restartSimulation={restartSimulation}
        streamedText={streamedText}
        elapsedMs={elapsedMs}
        streamStartMs={streamStartMs}
        progress={progress}
        formatSeconds={formatSeconds}
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
      />

      <SubmissionSection
        onLoadParsedSubmission={applyParsedSubmission}
        onRaceParsedSubmission={raceParsedSubmission}
      />

      <CatalogSection
        modelFamilyOptions={modelFamilyOptions}
        catalogFamilyFilter={catalogFamilyFilter}
        setCatalogFamilyFilter={setCatalogFamilyFilter}
        catalogEntries={catalogEntries}
      />

      <MethodologySection
        exactBenchmarkCount={exactBenchmarkCount}
        exactHardwareCount={exactHardwareCount}
        sourceBackedCount={sourceBackedCount}
        sourceBackedHardwareCount={sourceBackedHardwareCount}
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
