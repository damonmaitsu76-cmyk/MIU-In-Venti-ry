import { cn } from '@/lib/utils'

const SIZE_CLASSES = {
  lg: { i: 'text-3xl lg:text-6xl', tall: 'text-4xl lg:text-7xl', venti: 'text-3xl lg:text-6xl' },
  sm: { i: 'text-2xl', tall: 'text-2xl', venti: 'text-2xl' },
}

export default function Wordmark({ size = 'sm', tone = 'dark', className }) {
  const sizes = SIZE_CLASSES[size]
  const color = tone === 'light' ? 'text-[#f8e6c7]' : 'text-[#3d582b]'
  const shadow = tone === 'light' ? '[text-shadow:5px_5px_5px_#3a5429]' : ''

  return (
    <p className={cn('whitespace-nowrap leading-none', color, shadow, className)}>
      <span className={cn("font-['Nova_Mono']", sizes.i)}>I</span>
      <span className={cn("font-['Nova_Mono']", sizes.tall)}>n</span>
      <span className={cn("font-['Julee']", sizes.venti)}>venti</span>
      <span className={cn("font-['Nova_Mono']", sizes.i)}>R</span>
      <span className={cn("font-['Nova_Mono']", sizes.tall)}>y</span>
    </p>
  )
}
