import { PackageOpen } from 'lucide-react'

export default function EmptyState({ children, icon: Icon = PackageOpen, className = '' }) {
  return <div className={`flex flex-col items-center justify-center text-center ${className}`}>
    <span className="mb-3 flex size-14 items-center justify-center rounded-full bg-matcha-100 text-matcha-800"><Icon aria-hidden="true" className="size-6" /></span>
    {children}
  </div>
}
