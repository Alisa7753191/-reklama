"""Pydantic-модели: запросы, находки (риски) и итоговый отчёт."""
from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class RiskLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


# Числовой вес для агрегации итогового уровня риска.
RISK_ORDER = {
    RiskLevel.low: 1,
    RiskLevel.medium: 2,
    RiskLevel.high: 3,
    RiskLevel.critical: 4,
}


class InputType(str, Enum):
    text = "text"
    url = "url"
    image = "image"


class LegalBasis(BaseModel):
    law: str
    article: str
    title: str
    summary: str
    url: Optional[str] = None


class Liability(BaseModel):
    koap_article: str
    title: Optional[str] = None
    fine_citizens: Optional[str] = None
    fine_officials: Optional[str] = None
    fine_legal: Optional[str] = None
    note: Optional[str] = None
    url: Optional[str] = None


class Practice(BaseModel):
    type: str
    reference: str
    summary: str
    url: Optional[str] = None


class Finding(BaseModel):
    id: str
    category: str = Field(description="Машинный код группы риска")
    title: str
    description: str
    evidence: Optional[str] = Field(default=None, description="Цитата из рекламы")
    risk_level: RiskLevel
    legal_basis: List[LegalBasis] = Field(default_factory=list)
    mitigation: List[str] = Field(default_factory=list)
    liability: Optional[Liability] = None
    practice: List[Practice] = Field(default_factory=list)
    source: str = Field(description="rule | llm")
    confidence: Optional[float] = None


class AnalyzeRequest(BaseModel):
    input_type: InputType = InputType.text
    text: Optional[str] = None
    url: Optional[str] = None
    # Для изображений используется multipart-загрузка в отдельном эндпоинте.


class ReportMeta(BaseModel):
    input_type: InputType
    llm_used: bool
    llm_provider: Optional[str] = None
    rules_findings: int = 0
    llm_findings: int = 0
    warnings: List[str] = Field(default_factory=list)


class Report(BaseModel):
    overall_risk: RiskLevel
    summary: str
    detected_categories: List[str] = Field(default_factory=list)
    findings: List[Finding] = Field(default_factory=list)
    extracted_text: str = ""
    disclaimer: str
    meta: ReportMeta
