export default function PageHeader({ title, description, actions }) {
  return <header className="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      <h1 className="page-title">{title}</h1>
      <svg aria-hidden="true" focusable="false" viewBox="0 0 96 12" fill="none" className="mt-3 h-3 w-24 text-matcha-500"><path d="M2 6 C10 0, 18 12, 26 6 S42 0, 50 6 S66 12, 74 6 S90 0, 94 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
      {description && <p className="page-description mt-4 max-w-2xl">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
  </header>
}
