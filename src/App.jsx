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
import QuickNotesSection from './components/QuickNotesSection'
import SimulatorSection from './components/SimulatorSection'
import SourceExplorerSection from './components/SourceExplorerSection'
import './App.css'

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function formatSeconds(value) {
  return `${value.toFixed(value >= 10 ? 1 : 2)}s`
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

function getExperience(totalSeconds) {
  if (totalSeconds < 4.5) return 'Feels instant'
  if (totalSeconds < 9) return 'Feels smooth'
  if (totalSeconds < 18) return 'Feels like waiting'
  return 'Feels batch-first'
}

function getModelScaling(model) {
  const paramsB = Math.max(model.paramsB ?? 8, 0.5)
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

function calculateMetrics(hardware, model, workload, customMetrics) {
  let prefillTps
  let decodeTps
  let ttftMs
  let source

  if (hardware.id === 'custom') {
    prefillTps = customMetrics.prefillTps
    decodeTps = customMetrics.decodeTps
    ttftMs = customMetrics.ttftMs
    source = 'Manual'
  } else if (benchmarkMatrix[hardware.id]?.[model.id]) {
    const benchmark = benchmarkMatrix[hardware.id][model.id]
    prefillTps = benchmark.prefillTps
    decodeTps = benchmark.decodeTps
    ttftMs = benchmark.ttftMs
    source = benchmark.source
  } else {
    const scaling = getModelScaling(model)
    prefillTps = hardware.prefillBase / scaling.prefillFactor
    decodeTps = hardware.decodeBase / scaling.decodeFactor
    ttftMs = hardware.ttftBase * scaling.ttftFactor
    source = 'Estimated from LocalScore baseline + model size'
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

function resolveWorkload(selectedWorkload, customPreset) {
  return selectedWorkload.id === 'custom'
    ? {
        ...selectedWorkload,
        promptTokens: customPreset.promptTokens,
        responseTokens: customPreset.responseTokens,
      }
    : selectedWorkload
}

function App() {
  const [hardwareId, setHardwareId] = useState(hardwareOptions[1].id)
  const [modelId, setModelId] = useState(modelOptions[1].id)
  const [workloadId, setWorkloadId] = useState(workloadOptions[2].id)
  const [compareHardwareId, setCompareHardwareId] = useState(hardwareOptions[3].id)
  const [compareModelId, setCompareModelId] = useState(modelOptions[2].id)
  const [hardwareQuery, setHardwareQuery] = useState('')
  const [modelQuery, setModelQuery] = useState('')
  const [compareHardwareQuery, setCompareHardwareQuery] = useState('')
  const [compareModelQuery, setCompareModelQuery] = useState('')
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
    promptTokens: 1200,
    responseTokens: 220,
  })

  const hardware = hardwareOptions.find((item) => item.id === hardwareId) ?? hardwareOptions[1]
  const model = modelOptions.find((item) => item.id === modelId) ?? modelOptions[0]
  const selectedWorkload = workloadOptions.find((item) => item.id === workloadId) ?? workloadOptions[0]
  const workload = resolveWorkload(selectedWorkload, customPreset)
  const metrics = calculateMetrics(hardware, model, workload, customMetrics)
  const fitAssessment = assessModelFit(hardware, model)
  const compareHardware =
    hardwareOptions.find((item) => item.id === compareHardwareId) ?? hardwareOptions[2]
  const compareModel = modelOptions.find((item) => item.id === compareModelId) ?? modelOptions[1]
  const compareMetrics = calculateMetrics(compareHardware, compareModel, workload, customMetrics)
  const compareFitAssessment = assessModelFit(compareHardware, compareModel)
  const visibleHardwareOptions = buildFilteredOptions(
    hardwareOptions,
    hardwareQuery,
    hardwareId,
    ['name', 'spec', 'buyer'],
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
  const visibleCompareHardwareOptions = buildFilteredOptions(
    hardwareOptions.filter((option) => option.id !== 'custom'),
    compareHardwareQuery,
    compareHardwareId,
    ['name', 'spec', 'buyer'],
  )
  const visibleCompareModelOptions = buildFilteredOptions(
    familyFilteredModels,
    compareModelQuery,
    compareModelId,
    ['name', 'family', 'quant', 'fit'],
  )
  const visibleCompareModelEntries = visibleCompareModelOptions.map((option) => ({
    ...option,
    fitAssessment: assessModelFit(compareHardware, option),
  }))
  const catalogModels =
    catalogFamilyFilter === 'all'
      ? modelOptions
      : modelOptions.filter((option) => option.family === catalogFamilyFilter)
  const catalogEntries = catalogModels.map((entry) => ({
    ...entry,
    fitAssessment: assessModelFit(hardware, entry),
    hasExactBenchmark: Boolean(benchmarkMatrix[hardwareId]?.[entry.id]),
  }))

  function restartSimulation() {
    setElapsedMs(0)
    setIsPlaying(true)
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
  const displayPhase = fitAssessment.status === 'unfit' ? 'Memory limit exceeded' : currentPhase
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

  return (
    <div className="app-shell">
      <section className="masthead">
        <div className="brand-lockup">
          <div className="eyebrow">LapTime</div>
          <h1>Local LLM lap simulator</h1>
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
        setCompareHardwareId={setCompareHardwareId}
        compareModel={compareModel}
        compareModelId={compareModelId}
        compareModelQuery={compareModelQuery}
        setCompareModelQuery={setCompareModelQuery}
        visibleCompareModelOptions={visibleCompareModelEntries}
        setCompareModelId={setCompareModelId}
        compareMetrics={compareMetrics}
        compareFitAssessment={compareFitAssessment}
        formatSeconds={formatSeconds}
      />

      <CatalogSection
        modelFamilyOptions={modelFamilyOptions}
        catalogFamilyFilter={catalogFamilyFilter}
        setCatalogFamilyFilter={setCatalogFamilyFilter}
        catalogEntries={catalogEntries}
      />

      <SourceExplorerSection
        sourceQuery={sourceQuery}
        setSourceQuery={setSourceQuery}
        communityFilter={communityFilter}
        setCommunityFilter={setCommunityFilter}
        filteredStructuredSources={filteredStructuredSources}
        filteredCommunityBenchmarks={filteredCommunityBenchmarks}
      />

      <QuickNotesSection />
    </div>
  )
}

export default App
