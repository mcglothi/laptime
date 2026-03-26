import SectionHeading from './SectionHeading'
import ShareSheet from './ShareSheet'

function getFitLabel(status) {
  if (status === 'unfit') return "Won't fit"
  if (status === 'tight') return 'Tight fit'
  if (status === 'unknown') return 'Unknown fit'
  return 'Fits'
}

function getCoverageLabel(coverage) {
  if (coverage === 'exact') return 'Benchmark-backed'
  if (coverage === 'source-backed') return 'Source-backed runtime'
  if (coverage === 'community-runtime') return 'Community runtime'
  return 'Estimated / catalog only'
}

function getExperienceTone(experience) {
  if (experience === 'Feels instant') return 'instant'
  if (experience === 'Feels smooth') return 'smooth'
  if (experience === 'Feels like waiting') return 'waiting'
  return 'batch'
}

function ComparisonSection({
  hardware,
  model,
  metrics,
  fitAssessment,
  compareHardware,
  compareHardwareId,
  compareHardwareQuery,
  setCompareHardwareQuery,
  visibleCompareHardwareOptions,
  hardwarePlatformOptions,
  compareHardwarePlatformFilter,
  setCompareHardwarePlatformFilter,
  setCompareHardwareId,
  compareModel,
  compareMetrics,
  compareFitAssessment,
  elapsedMs,
  restartSimulation,
  formatSeconds,
  shareUrl,
  shareTitle,
}) {
  const comparisonProjected =
    fitAssessment.status === 'unfit' || compareFitAssessment.status === 'unfit'
  const laneATotalMs = metrics.totalSeconds * 1000
  const laneBTotalMs = compareMetrics.totalSeconds * 1000
  const raceElapsedMs = Math.min(elapsedMs, laneATotalMs, laneBTotalMs)
  const laneAProgress = Math.min(raceElapsedMs / laneATotalMs, 1)
  const laneBProgress = Math.min(raceElapsedMs / laneBTotalMs, 1)
  const laneAPrefillShare = (metrics.prefillSeconds * 1000) / laneATotalMs
  const laneATTFTShare = metrics.ttftMs / laneATotalMs
  const laneBPrefillShare = (compareMetrics.prefillSeconds * 1000) / laneBTotalMs
  const laneBTTFTShare = compareMetrics.ttftMs / laneBTotalMs
  const winnerThresholdMs = 40
  const hasWinner = !comparisonProjected && Math.abs(laneATotalMs - laneBTotalMs) > winnerThresholdMs
  const winnerLane = !hasWinner ? null : laneATotalMs < laneBTotalMs ? 'a' : 'b'
  const laneAExperienceTone = getExperienceTone(metrics.experience)
  const laneBExperienceTone = getExperienceTone(compareMetrics.experience)

  return (
    <section className="compare-section" id="comparison">
      <SectionHeading
        eyebrow="Comparison"
        title="Compare two setups."
      />

      <div className="race-card">
        <div className="race-header">
          <div>
            <div className="metrics-heading">Lap race</div>
            <p>Restart the playback to watch both setups launch, clear TTFT, and race through generation.</p>
          </div>
          <div className="playback-actions">
            <ShareSheet
              title={shareTitle}
              text={`${hardware.name} versus ${compareHardware.name} in LapTime`}
              url={shareUrl}
            />
            <button className="ghost-button" type="button" onClick={restartSimulation}>
              Run the race
            </button>
          </div>
        </div>

        {comparisonProjected ? (
          <div className="compare-caveat">
            One lane likely will not load the selected model normally. LapTime is still showing the
            projected race so you can compare the speed profile, but treat it as a hypothetical rather
            than a clean runnable matchup.
          </div>
        ) : null}
        <div className="race-lanes">
          <div className="race-lane">
            <div className="race-lane-head">
              <strong>
                Lane A
                {winnerLane === 'a' ? <span className="winner-accent-dot" aria-hidden="true" /> : null}
              </strong>
              <span>{hardware.name}</span>
            </div>
            <div className="race-track">
              <div className="race-track-fill">
                <div className="race-phase phase-prefill" style={{ width: `${laneAPrefillShare * 100}%` }} />
                <div className="race-phase phase-ttft" style={{ width: `${laneATTFTShare * 100}%` }} />
                <div
                  className="race-phase phase-stream"
                  style={{ width: `${Math.max(0, 1 - laneAPrefillShare - laneATTFTShare) * 100}%` }}
                />
              </div>
              <div className="race-marker lane-a" style={{ left: `${laneAProgress * 100}%` }}>
                A
              </div>
            </div>
            <div className={`race-lane-meta ${winnerLane === 'a' ? 'race-lane-meta-winner' : ''}`}>
              <span>{formatSeconds(metrics.totalSeconds)}</span>
              <span>{metrics.experience}</span>
            </div>
          </div>

          <div className="race-lane">
            <div className="race-lane-head">
              <strong>
                Lane B
                {winnerLane === 'b' ? <span className="winner-accent-dot" aria-hidden="true" /> : null}
              </strong>
              <span>{compareHardware.name}</span>
            </div>
            <div className="race-track">
              <div className="race-track-fill">
                <div className="race-phase phase-prefill" style={{ width: `${laneBPrefillShare * 100}%` }} />
                <div className="race-phase phase-ttft" style={{ width: `${laneBTTFTShare * 100}%` }} />
                <div
                  className="race-phase phase-stream"
                  style={{ width: `${Math.max(0, 1 - laneBPrefillShare - laneBTTFTShare) * 100}%` }}
                />
              </div>
              <div className="race-marker lane-b" style={{ left: `${laneBProgress * 100}%` }}>
                B
              </div>
            </div>
            <div className={`race-lane-meta ${winnerLane === 'b' ? 'race-lane-meta-winner' : ''}`}>
              <span>{formatSeconds(compareMetrics.totalSeconds)}</span>
              <span>{compareMetrics.experience}</span>
            </div>
          </div>

          <div className="timeline-legend">
            <span className="phase-prefill">
              Engine rev / prompt ingest
            </span>
            <span className="phase-ttft">
              Launch / first token
            </span>
            <span className="phase-stream">
              Top speed / generation
            </span>
          </div>
        </div>
      </div>

      <div className="compare-grid">
        <article className={`compare-card ${winnerLane === 'a' ? 'compare-card-winner' : ''}`}>
          <div className="compare-header">
            <span>Lane A</span>
            <strong>
              Current run
              {winnerLane === 'a' ? <span className="winner-label">Fastest</span> : null}
            </strong>
          </div>
          <div className="compare-setup-block compare-setup-block-disabled">
            <div className="compare-controls compare-controls-disabled" aria-hidden="true">
              <label className="control-group dense">
                <span>Hardware</span>
                <div className="chip-row">
                  {hardwarePlatformOptions.map((platform) => (
                    <button
                      key={platform}
                      className={`filter-chip ${platform === hardware.platform ? 'active' : ''}`}
                      type="button"
                      disabled
                      tabIndex={-1}
                    >
                      {platform === 'all' ? 'All platforms' : platform}
                    </button>
                  ))}
                </div>
                <input
                  id="current-hardware-search"
                  name="currentHardwareSearch"
                  type="text"
                  value={hardware.name}
                  placeholder="Search hardware"
                  disabled
                  readOnly
                  tabIndex={-1}
                />
                <select
                  id="current-hardware-select"
                  name="currentHardware"
                  value={hardware.id}
                  disabled
                  tabIndex={-1}
                  onChange={() => {}}
                >
                  <option value={hardware.id}>
                    {hardware.platform} · {hardware.name}
                  </option>
                </select>
              </label>
            </div>
            <div className="compare-title">{hardware.name}</div>
            <div className="compare-subtitle">
              {hardware.platform} · {model.name}
            </div>
            <div className={`fit-inline fit-inline-${fitAssessment.status}`}>
              {getFitLabel(fitAssessment.status)}
            </div>
          </div>
          <div className="metric-list">
            <div>
              <span>Prefill</span>
              <strong>{metrics.prefillTps.toFixed(0)} tok/s</strong>
            </div>
            <div>
              <span>Decode</span>
              <strong>{metrics.decodeTps.toFixed(1)} tok/s</strong>
            </div>
            <div>
              <span>TTFT</span>
              <strong>{Math.round(metrics.ttftMs)} ms</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{formatSeconds(metrics.totalSeconds)}</strong>
            </div>
          </div>
          {fitAssessment.status !== 'fit' ? (
            <div className={`fit-warning compact ${fitAssessment.status}`}>
              <strong>
                {fitAssessment.status === 'unfit' ? 'Will likely not fit' : 'Tight fit warning'}
              </strong>
              <p>{fitAssessment.message}</p>
            </div>
          ) : null}
          <div className={`compare-experience compare-experience-${laneAExperienceTone}`}>{metrics.experience}</div>
        </article>

        <article className={`compare-card ${winnerLane === 'b' ? 'compare-card-winner' : ''}`}>
          <div className="compare-header">
            <span>Lane B</span>
            <strong>
              Comparison run
              {winnerLane === 'b' ? <span className="winner-label">Fastest</span> : null}
            </strong>
          </div>
          <div className="compare-setup-block compare-setup-block-selectable">
            <div className="compare-controls">
              <label className="control-group dense">
                <span>Hardware</span>
                <div className="chip-row">
                  {hardwarePlatformOptions.map((platform) => (
                    <button
                      key={platform}
                      className={`filter-chip ${compareHardwarePlatformFilter === platform ? 'active' : ''}`}
                      type="button"
                      onClick={() => setCompareHardwarePlatformFilter(platform)}
                    >
                      {platform === 'all' ? 'All platforms' : platform}
                    </button>
                  ))}
                </div>
                <input
                  id="compare-hardware-search"
                  name="compareHardwareSearch"
                  type="text"
                  value={compareHardwareQuery}
                  placeholder="Search hardware"
                  onChange={(event) => setCompareHardwareQuery(event.target.value)}
                />
                <select
                  id="compare-hardware-select"
                  name="compareHardware"
                  value={compareHardwareId}
                  onChange={(event) => setCompareHardwareId(event.target.value)}
                >
                  {visibleCompareHardwareOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.platform} · {option.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="compare-title">{compareHardware.name}</div>
            <div className="compare-subtitle">
              {compareHardware.platform} · {compareModel.name}
            </div>
            <div className={`fit-inline fit-inline-${compareFitAssessment.status}`}>
              {getFitLabel(compareFitAssessment.status)}
            </div>
          </div>
          <div className="metric-list">
            <div>
              <span>Prefill</span>
              <strong>{compareMetrics.prefillTps.toFixed(0)} tok/s</strong>
            </div>
            <div>
              <span>Decode</span>
              <strong>{compareMetrics.decodeTps.toFixed(1)} tok/s</strong>
            </div>
            <div>
              <span>TTFT</span>
              <strong>{Math.round(compareMetrics.ttftMs)} ms</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{formatSeconds(compareMetrics.totalSeconds)}</strong>
            </div>
          </div>
          {compareFitAssessment.status !== 'fit' ? (
            <div className={`fit-warning compact ${compareFitAssessment.status}`}>
              <strong>
                {compareFitAssessment.status === 'unfit' ? 'Will likely not fit' : 'Tight fit warning'}
              </strong>
              <p>{compareFitAssessment.message}</p>
            </div>
          ) : null}
          <div className={`compare-experience compare-experience-${laneBExperienceTone}`}>{compareMetrics.experience}</div>
        </article>
      </div>

      <article className="compare-model-card compare-model-track-card">
        <div className="compare-model-card-header">
          <span>Selected track</span>
          <strong>{model.family}</strong>
        </div>
        <div className="compare-model-card-title">{model.name}</div>
        <div className="compare-model-card-meta">
          <span>{model.quant}</span>
          <span>{model.paramsB ? `${model.paramsB}B params` : 'Unknown size'}</span>
          <span>{getCoverageLabel(model.benchmarkCoverage)}</span>
        </div>
        <p>{model.fit}</p>
      </article>

      <div className="delta-grid">
        <div
          className={
            comparisonProjected
              ? 'delta-neutral'
              : compareMetrics.decodeTps >= metrics.decodeTps
                ? 'delta-positive'
                : 'delta-negative'
          }
        >
          <span>Decode delta</span>
          <strong>{`${(compareMetrics.decodeTps - metrics.decodeTps).toFixed(1)} tok/s`}</strong>
        </div>
        <div
          className={
            comparisonProjected
              ? 'delta-neutral'
              : compareMetrics.ttftMs <= metrics.ttftMs
                ? 'delta-positive'
                : 'delta-negative'
          }
        >
          <span>TTFT delta</span>
          <strong>{`${Math.round(compareMetrics.ttftMs - metrics.ttftMs)} ms`}</strong>
        </div>
        <div
          className={
            comparisonProjected
              ? 'delta-neutral'
              : compareMetrics.totalSeconds <= metrics.totalSeconds
                ? 'delta-positive'
                : 'delta-negative'
          }
        >
          <span>Total time delta</span>
          <strong>{formatSeconds(compareMetrics.totalSeconds - metrics.totalSeconds)}</strong>
        </div>
      </div>
    </section>
  )
}

export default ComparisonSection
