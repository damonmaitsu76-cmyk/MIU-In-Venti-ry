import { Circle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { STOCK_STATUS } from '@/lib/inventoryConfig'

export default function StatusBadge({ status }) {
  const details = STOCK_STATUS[status] || STOCK_STATUS.ok
  return <Badge variant={details.variant}><Circle className="size-2 fill-current" />{details.label}</Badge>
}
