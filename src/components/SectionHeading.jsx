function SectionHeading({ eyebrow, title, description, compact = true }) {
  return (
    <div className={`section-heading${compact ? ' compact' : ''}`}>
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
      </div>
      {description ? <p>{description}</p> : null}
    </div>
  )
}

export default SectionHeading
