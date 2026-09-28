const WAVE_PATHS = [
  'M0,120 C240,40 480,200 720,120 C960,40 1200,200 1440,120 C1680,40 1920,200 2160,120 C2400,40 2640,200 2880,120 L2880,320 L0,320 Z',
  'M0,180 C180,120 540,240 720,180 C900,120 1260,240 1440,180 C1620,120 1980,240 2160,180 C2340,120 2700,240 2880,180 L2880,320 L0,320 Z',
  'M0,230 C300,190 420,270 720,230 C1020,190 1140,270 1440,230 C1740,190 1860,270 2160,230 C2460,190 2580,270 2880,230 L2880,320 L0,320 Z',
]
const CONTOUR = 'M0,60 C240,20 480,100 720,60 C960,20 1200,100 1440,60 C1680,20 1920,100 2160,60 C2400,20 2640,100 2880,60'

function Wave({ d, color, height, duration, reverse = false, opacity = 1, className = '' }) {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 2880 320" preserveAspectRatio="none" className={`backdrop-wave absolute left-0 w-[200%] max-w-none ${className}`} style={{ height, opacity, animationDuration: `${duration}s`, animationDirection: reverse ? 'reverse' : 'normal' }}><path d={d} style={{ fill: `var(${color})` }} /></svg>
}

function Contours({ className = '', duration = 120 }) {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 2880 420" preserveAspectRatio="none" className={`backdrop-wave absolute left-0 w-[200%] max-w-none ${className}`} style={{ animationDuration: `${duration}s` }}>{Array.from({ length: 9 }, (_, i) => <path key={i} d={CONTOUR} transform={`translate(0 ${i * 34})`} fill="none" strokeWidth="1.5" style={{ stroke: 'var(--bd-line)' }} />)}</svg>
}

function Ripples({ className = '' }) {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 400 400" fill="none" className={`absolute ${className}`}>{[60, 100, 140, 180, 220].map((r, i) => <circle key={r} cx="200" cy="200" r={r} strokeWidth="1.5" style={{ stroke: 'var(--bd-line)', opacity: 1 - i * .14 }} />)}</svg>
}

export default function PageBackdrop({ animated = false, rich = false, scale = 1 }) {
  const h = (vh) => `${vh * scale}vh`
  return <div aria-hidden="true" data-animated={animated ? '' : undefined} className="backdrop-root pointer-events-none fixed inset-0 z-0 overflow-hidden" style={{ backgroundImage: 'linear-gradient(160deg, var(--bd-from), var(--bd-to))' }}>
    <div className="backdrop-blob absolute -left-40 -top-40 size-[36rem] rounded-full blur-3xl" style={{ background: 'var(--bd-blob-a)', opacity: .6 }} />
    <div className="backdrop-blob backdrop-blob-b absolute -right-48 top-[28%] size-[32rem] rounded-full blur-3xl" style={{ background: 'var(--bd-blob-b)', opacity: .55 }} />
    <Ripples className="-right-24 -top-24 w-[26rem] opacity-70 sm:w-[34rem]" />
    {rich && <Contours className="top-[18%] h-[26vh] opacity-80" />}
    <div className="absolute inset-x-0 top-0 rotate-180 overflow-hidden" style={{ height: h(16) }}><Wave d={WAVE_PATHS[1]} color="--bd-wave-1" height="100%" duration={80} opacity={.7} className="bottom-0" /></div>
    <Wave d={WAVE_PATHS[0]} color="--bd-wave-1" height={h(30)} duration={90} className="bottom-0" />
    <Wave d={WAVE_PATHS[1]} color="--bd-wave-2" height={h(22)} duration={65} reverse className="bottom-0" />
    <Wave d={WAVE_PATHS[2]} color="--bd-wave-3" height={h(14)} duration={45} className="bottom-0" />
  </div>
}
