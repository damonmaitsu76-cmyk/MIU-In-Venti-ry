import logoMark from '@/assets/miu-logo-badge.svg'
import { cn } from '@/lib/utils'

// The SVG embeds a padded 500px PNG; the opaque artwork spans about 61% of it.
// `size` is the visible circle diameter, with the image centered over its box.
const VISIBLE_RATIO = 0.61
const CENTER_X = 0
const CENTER_Y = 0

export default function LogoBadge({ size = 48, alt = '', className }) {
  const box = typeof size === 'number' ? `${size}px` : size
  return (
    <span
      className={cn('relative inline-block shrink-0', className)}
      style={{ width: box, height: box }}
    >
      <img
        src={logoMark}
        alt={alt}
        draggable={false}
        className="absolute top-1/2 left-1/2 h-auto max-w-none select-none"
        style={{
          width: `calc(${box} / ${VISIBLE_RATIO})`,
          transform: `translate(${-50 - CENTER_X * 100}%, ${-50 - CENTER_Y * 100}%)`,
        }}
      />
    </span>
  )
}
