import SectionHeading from './SectionHeading'

function CatalogSection({
  modelFamilyOptions,
  catalogFamilyFilter,
  setCatalogFamilyFilter,
  catalogEntries,
}) {
  function getCoverageLabel(coverage) {
    if (coverage === 'exact') return 'Benchmark-backed'
    if (coverage === 'source-backed') return 'Source-backed runtime'
    if (coverage === 'community-runtime') return 'Community runtime'
    return 'Estimated / catalog only'
  }

  return (
    <section className="catalog-section">
      <SectionHeading
        eyebrow="Catalog"
        title="Model browser."
      />

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
        </div>
      </div>

      <div className="catalog-grid">
        {catalogEntries.map((entry) => (
          <article key={entry.id} className="catalog-card">
            <div className="catalog-header">
              <strong>{entry.name}</strong>
              <span>{entry.family}</span>
            </div>
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
          </article>
        ))}
      </div>
    </section>
  )
}

export default CatalogSection
