#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {
  benchmarkMatrix,
  hardwareOptions,
  modelOptions,
} from '../src/data/benchmarkData.js'

function printUsage() {
  console.error('Usage: node scripts/review-house-benchmark.mjs --input path/to/benchmark.json')
}

function readArgs(argv) {
  const inputIndex = argv.indexOf('--input')
  if (inputIndex === -1 || !argv[inputIndex + 1]) {
    printUsage()
    process.exit(1)
  }

  return {
    inputPath: path.resolve(argv[inputIndex + 1]),
  }
}

function getCoverage(entry) {
  if (!entry) return 'none'
  return entry.coverage ?? 'exact'
}

function formatPercentDelta(nextValue, currentValue) {
  if (!Number.isFinite(nextValue) || !Number.isFinite(currentValue) || currentValue === 0) {
    return 'n/a'
  }

  const delta = ((nextValue - currentValue) / currentValue) * 100
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toFixed(1)}%`
}

function findHardware(hardwareId) {
  return hardwareOptions.find((item) => item.id === hardwareId) ?? null
}

function findModel(modelId) {
  return modelOptions.find((item) => item.id === modelId) ?? null
}

function normalizeInput(payload) {
  if (Array.isArray(payload)) return payload
  if (payload && Array.isArray(payload.entries)) return payload.entries
  return [payload]
}

function validateEntry(entry) {
  const requiredKeys = ['hardwareId', 'modelId', 'prefillTps', 'decodeTps', 'ttftMs']
  const missing = requiredKeys.filter((key) => entry[key] == null || entry[key] === '')

  if (missing.length) {
    return `Missing required fields: ${missing.join(', ')}`
  }

  for (const key of ['prefillTps', 'decodeTps', 'ttftMs']) {
    if (!Number.isFinite(Number(entry[key])) || Number(entry[key]) <= 0) {
      return `Field ${key} must be a positive number`
    }
  }

  return null
}

function recommendAction(existing, candidate) {
  const coverage = getCoverage(existing)
  const fitVerdict = String(candidate.fitVerdict ?? '').trim().toLowerCase()

  if (!existing) {
    return 'new-row-candidate'
  }

  if (fitVerdict === 'verified-unfit') {
    return 'fit-contradiction-review'
  }

  if (coverage === 'none') {
    return 'new-row-candidate'
  }

  if (coverage === 'exact') {
    return 'keep-as-house-calibration'
  }

  if (coverage === 'source-backed' || coverage === 'community-runtime') {
    const decodeDelta = Math.abs((Number(candidate.decodeTps) - existing.decodeTps) / existing.decodeTps)
    const ttftDelta = Math.abs((Number(candidate.ttftMs) - existing.ttftMs) / existing.ttftMs)

    if (decodeDelta >= 0.25 || ttftDelta >= 0.25) {
      return 'runtime-divergence-review'
    }
  }

  return 'candidate-supports-existing-row'
}

function printEntryReview(entry) {
  const hardware = findHardware(entry.hardwareId)
  const model = findModel(entry.modelId)
  const existing = benchmarkMatrix[entry.hardwareId]?.[entry.modelId] ?? null
  const coverage = getCoverage(existing)
  const action = recommendAction(existing, entry)

  const errors = []
  if (!hardware) errors.push(`Unknown hardwareId: ${entry.hardwareId}`)
  if (!model) errors.push(`Unknown modelId: ${entry.modelId}`)
  const validationError = validateEntry(entry)
  if (validationError) errors.push(validationError)

  console.log(`\n=== ${entry.hardwareId} :: ${entry.modelId} ===`)

  if (hardware) {
    console.log(`Hardware: ${hardware.name}`)
  }
  if (model) {
    console.log(`Model: ${model.name}`)
  }

  if (errors.length) {
    for (const error of errors) {
      console.log(`ERROR: ${error}`)
    }
    return
  }

  console.log(`Candidate: prefill ${Number(entry.prefillTps).toFixed(1)} tok/s | decode ${Number(entry.decodeTps).toFixed(1)} tok/s | TTFT ${Math.round(Number(entry.ttftMs))} ms`)
  console.log(`Runtime: ${entry.runtime ?? 'unspecified'} | Host: ${entry.host ?? 'unspecified'} | Fit verdict: ${entry.fitVerdict ?? 'unspecified'}`)

  if (!existing) {
    console.log('Current LapTime row: none')
  } else {
    console.log(`Current LapTime row: ${coverage}`)
    console.log(`Current metrics: prefill ${existing.prefillTps.toFixed(1)} tok/s | decode ${existing.decodeTps.toFixed(1)} tok/s | TTFT ${Math.round(existing.ttftMs)} ms`)
    console.log(`Delta vs current: prefill ${formatPercentDelta(Number(entry.prefillTps), existing.prefillTps)} | decode ${formatPercentDelta(Number(entry.decodeTps), existing.decodeTps)} | TTFT ${formatPercentDelta(Number(entry.ttftMs), existing.ttftMs)}`)
  }

  console.log(`Suggested action: ${action}`)

  if (entry.provenance) {
    console.log(`Provenance: ${entry.provenance}`)
  }
  if (entry.sourceLabel) {
    console.log(`Source label: ${entry.sourceLabel}`)
  }
  if (entry.notes) {
    console.log(`Notes: ${entry.notes}`)
  }
}

function main() {
  const { inputPath } = readArgs(process.argv.slice(2))
  const raw = fs.readFileSync(inputPath, 'utf8')
  const parsed = JSON.parse(raw)
  const entries = normalizeInput(parsed)

  if (!entries.length) {
    console.error('No entries found in input.')
    process.exit(1)
  }

  for (const entry of entries) {
    printEntryReview(entry)
  }
}

main()
