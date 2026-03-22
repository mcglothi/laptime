import SectionHeading from './SectionHeading'

function CatalogSection({
  modelFamilyOptions,
  catalogFamilyFilter,
  setCatalogFamilyFilter,
  catalogModels,
  benchmarkMatrix,
  hardwareId,
}) {
  return (
    <section className="catalog-section">
      <SectionHeading
        eyebrow="Catalog"
        title="Model browser."
        description="Browse the broader model catalog separately from the simulator flow."
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
          {catalogModels.length} models visible · exact playback where structured benchmarks exist
        </div>
      </div>

      <div className="catalog-grid">
        {catalogModels.map((entry) => (
          <article key={entry.id} className="catalog-card">
            <div className="catalog-header">
              <strong>{entry.name}</strong>
              <span>{entry.family}</span>
            </div>
            <p>{entry.fit}</p>
            <div className="catalog-meta">
              <span>{entry.quant}</span>
              <span>{entry.paramsB ? `${entry.paramsB}B params` : 'Unknown size'}</span>
              <span>
                {benchmarkMatrix[hardwareId]?.[entry.id] ? 'Exact benchmarked' : 'Estimated / catalog only'}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default CatalogSection
