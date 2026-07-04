import type { RiskLevel } from '../types'
import { RISK_LABEL } from '../labels'

export function RiskBadge({ level, small }: { level: RiskLevel; small?: boolean }) {
  return (
    <span className={`risk-badge risk-${level} ${small ? 'risk-badge--sm' : ''}`}>
      {RISK_LABEL[level]}
    </span>
  )
}
