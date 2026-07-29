import { useState } from 'react'
import SectionHeading from './SectionHeading'

const TIER_BLURBS = {
  current: 'What people are downloading and running right now.',
  common: 'Older releases that are still in heavy day-to-day use.',
  baseline:
    'Kept because LapTime calibrates its estimates against their measured LocalScore runs — not a recommendation.',
}

function CatalogSection({
  selectedModelId,
  modelFamilyOptions,
  catalogFamilyFilter,
  setCatalogFamilyFilter,
  catalogEntries,
  contextTokens,
  onSelectModel,
  tierOrder,
  tierLabels,
}) {
  // Calibration baselines start collapsed so the first thing a visitor scans is
  // the current generation, not a wall of 2024 models.
  const [collapsedTiers, setCollapsedTiers] = useState(() => ({ baseline: true }))

  function toggleTier(tier) {
    setCollapsedTiers((previous) => ({ ...previous, [tier]: !previous[tier] }))
  }

  function getCoverageLabel(coverage) {
    if (coverage === 'exact') return 'Benchmark-backed'
    if (coverage === 'source-backed') return 'Source-backed runtime'
    if (coverage === 'community-runtime') return 'Community runtime'
    return 'Estimated / catalog only'
  }

  const groupedEntries = tierOrder
    .map((tier) => ({
      tier,
      label: tierLabels[tier] ?? tier,
      blurb: TIER_BLURBS[tier],
      entries: catalogEntries.filter((entry) => (entry.tier ?? 'current') === tier),
    }))
    .filter((group) => group.entries.length > 0)

  return (
    <section className="catalog-section">
      <SectionHeading eyebrow="Catalog" title="Model browser." />

      <div className="catalog-toolbar">
        <div className="chip-row">
          {modelFamilyOptions.map((family) => (
            <button
              key={family}
              className={`filter-chip ${catalogFamilyFilter === family ? 'active' : ''}`}
              type="button"
              onClick={() => setCatalogFamilyFilter(family)}
            >
              {family === 'all' ? 'All' : family}
            </button>
          ))}
        </div>
        <div className="source-note">
          {catalogEntries.length} models visible · fit badges reflect the currently selected hardware
          and the current {contextTokens.toLocaleString()}-token context
        </div>
      </div>

      {groupedEntries.map((group) => {
        const isExpanded = !collapsedTiers[group.tier]

        return (
          <div key={group.tier} className="catalog-tier">
            <div className="catalog-tier-header">
              <button
                type="button"
                className="catalog-tier-toggle"
                onClick={() => toggleTier(group.tier)}
                aria-expanded={isExpanded}
              >
                <span className="catalog-tier-caret" aria-hidden="true">
                  {isExpanded ? '▾' : '▸'}
                </span>
                {group.label}
                <span className="catalog-tier-count">{group.entries.length}</span>
              </button>
              {group.blurb ? <p className="catalog-tier-blurb">{group.blurb}</p> : null}
            </div>

            {isExpanded ? (
              <div className="catalog-grid">
                {group.entries.map((entry) => (
                  <article
                    key={entry.id}
                    className={`catalog-card${entry.id === selectedModelId ? ' catalog-card-current' : ''}`}
                  >
                    <div className="catalog-header">
                      <strong>{entry.name}</strong>
                      <span>{entry.family}</span>
                    </div>
                    {entry.id === selectedModelId ? (
                      <div className="catalog-current-pill">Current selection</div>
                    ) : null}
                    <p>{entry.fit}</p>
                    <div className="catalog-meta">
                      <span>{entry.quant}</span>
                      <span>{entry.paramsB ? `${entry.paramsB}B params` : 'Unknown size'}</span>
                      <span>{getCoverageLabel(entry.benchmarkCoverage)}</span>
                      <span
                        className={`fit-chip ${entry.fitAssessment.status === 'fit' ? 'fit' : entry.fitAssessment.status}`}
                      >
                        {entry.fitAssessment.status === 'fit' ? 'Fits' : null}
                        {entry.fitAssessment.status === 'tight' ? 'Tight fit' : null}
                        {entry.fitAssessment.status === 'unfit' ? "Won't fit" : null}
                        {entry.fitAssessment.status === 'unknown' ? 'Unknown fit' : null}
                      </span>
                    </div>
                    {entry.id !== selectedModelId && onSelectModel ? (
                      <button
                        type="button"
                        className="catalog-simulate-btn ghost-button"
                        onClick={() => onSelectModel(entry.id)}
                      >
                        Simulate →
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </section>
  )
}

export default CatalogSection
