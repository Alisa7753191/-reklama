export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type InputType = 'text' | 'url' | 'image'

export interface LegalBasis {
  law: string
  article: string
  title: string
  summary: string
  url?: string | null
}

export interface Liability {
  koap_article: string
  title?: string | null
  fine_citizens?: string | null
  fine_officials?: string | null
  fine_legal?: string | null
  note?: string | null
  url?: string | null
}

export interface Practice {
  type: string
  reference: string
  summary: string
  url?: string | null
}

export interface Finding {
  id: string
  category: string
  title: string
  description: string
  evidence?: string | null
  risk_level: RiskLevel
  legal_basis: LegalBasis[]
  mitigation: string[]
  liability?: Liability | null
  practice: Practice[]
  source: string
  confidence?: number | null
}

export interface ReportMeta {
  input_type: InputType
  channel?: string
  llm_used: boolean
  llm_provider?: string | null
  rules_findings: number
  llm_findings: number
  warnings: string[]
}

export interface Report {
  overall_risk: RiskLevel
  summary: string
  detected_categories: string[]
  findings: Finding[]
  extracted_text: string
  disclaimer: string
  meta: ReportMeta
}
