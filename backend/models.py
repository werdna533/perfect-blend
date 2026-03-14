"""Pydantic schemas for the PerfectBlend API."""

from __future__ import annotations

from pydantic import BaseModel


# ── Dataset connection ──────────────────────────────────────────────

class SplitInfo(BaseModel):
    name: str
    image_count: int
    annotation_count: int


class CategoryInfo(BaseModel):
    id: int
    name: str


class ConnectRequest(BaseModel):
    path: str


class ConnectResponse(BaseModel):
    path: str
    splits: list[SplitInfo]
    categories: list[CategoryInfo]


# ── Parsing ─────────────────────────────────────────────────────────

class BubbleRecord(BaseModel):
    image_id: int
    image_name: str
    class_name: str
    class_id: int
    count: int


class ClassDistribution(BaseModel):
    class_name: str
    class_id: int
    count: int


class ParseResponse(BaseModel):
    bubbles: list[BubbleRecord]
    distribution: list[ClassDistribution]
    split: str


# ── AI analysis ─────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    purpose: str
    distribution: list[ClassDistribution]


class ClassAnalysis(BaseModel):
    class_name: str
    current_count: int
    target_count: int
    strategy: str
    rationale: str


class Citation(BaseModel):
    text: str
    url: str | None = None


class AnalysisResponse(BaseModel):
    analysis: str
    classes: list[ClassAnalysis]
    citations: list[Citation]


# ── Rebalancing ─────────────────────────────────────────────────────

class RebalanceTarget(BaseModel):
    class_name: str
    target_count: int
    strategy: str


class RebalanceRequest(BaseModel):
    targets: list[RebalanceTarget]
    output_path: str
