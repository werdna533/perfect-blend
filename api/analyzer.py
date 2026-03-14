"""AI-powered dataset analysis using watsonx.ai (primary) and Gemini (backup)."""

from __future__ import annotations

import json
import os
import re
from typing import Any

import requests

from models import AnalysisResponse, Citation, ClassAnalysis, ClassDistribution


# ── Helpers ─────────────────────────────────────────────────────────

def _extract_json(text: str) -> dict[str, Any]:
    """Extract JSON from a response that may contain markdown code fences."""
    # Try stripping ```json ... ``` fences first
    fenced = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", text, re.DOTALL)
    payload = fenced.group(1).strip() if fenced else text.strip()
    return json.loads(payload)


def _build_prompt(purpose: str, distribution: list[ClassDistribution]) -> str:
    dist_table = "\n".join(
        f"  - {d.class_name} (id={d.class_id}): {d.count} annotations"
        for d in distribution
    )
    return f"""You are an expert MLOps data-quality engineer.

A user has a COCO-format computer-vision dataset with the following class distribution:
{dist_table}

The dataset will be used for: {purpose}

Analyze the dataset for class imbalance and bias. Consider REAL-WORLD domain context — for
example, if the classes represent species, consider natural species abundance; if they
represent medical conditions, consider disease prevalence; and so on.

Guidelines:
- Prefer UPSAMPLING minority classes over downsampling majority classes, unless the dataset
  is very large (>10 000 images per class).
- Aim for a distribution that makes sense for the stated fine-tuning purpose, NOT
  necessarily a perfectly uniform distribution.
- For each class, specify a concrete target annotation count, the strategy
  ("upsample", "downsample", or "keep"), and a short rationale.
- Provide a brief (2-4 sentence) overall strategy blurb.

Respond with ONLY a JSON object (no markdown fences) in this exact schema:
{{
  "analysis": "<overall strategy blurb>",
  "classes": [
    {{
      "class_name": "<name>",
      "current_count": <int>,
      "target_count": <int>,
      "strategy": "upsample | downsample | keep",
      "rationale": "<why>"
    }}
  ]
}}
"""


# ── watsonx.ai ──────────────────────────────────────────────────────

def _call_watsonx(prompt: str) -> str | None:
    """Call IBM watsonx.ai Granite model over HTTP. Returns raw text or None on failure."""
    api_key = os.environ.get("WATSONX_API_KEY")
    project_id = os.environ.get("WATSONX_PROJECT_ID")
    url = os.environ.get("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")

    if not api_key or not project_id:
        return None

    try:
        token_response = requests.post(
            "https://iam.cloud.ibm.com/identity/token",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data={
                "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
                "apikey": api_key,
            },
            timeout=30,
        )
        token_response.raise_for_status()
        access_token = token_response.json()["access_token"]

        generation_response = requests.post(
            f"{url.rstrip('/')}/ml/v1/text/generation?version=2024-05-31",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            json={
                "model_id": "ibm/granite-3-8b-instruct",
                "input": prompt,
                "project_id": project_id,
                "parameters": {
                    "max_new_tokens": 2048,
                    "temperature": 0.3,
                    "repetition_penalty": 1.05,
                },
            },
            timeout=120,
        )
        generation_response.raise_for_status()
        payload = generation_response.json()
        results = payload.get("results", [])
        if not results:
            return None
        return results[0].get("generated_text")
    except Exception as exc:  # noqa: BLE001
        print(f"[analyzer] watsonx error: {exc}")
        return None


# ── Gemini ──────────────────────────────────────────────────────────

def _call_gemini_analysis(prompt: str) -> str | None:
    """Use Gemini as fallback for the full analysis."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None

    try:
        from google import genai

        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        return response.text
    except Exception as exc:  # noqa: BLE001
        print(f"[analyzer] Gemini analysis error: {exc}")
        return None


def _call_gemini_citations(analysis_text: str) -> list[Citation]:
    """Call Gemini with Google Search grounding to find supporting citations."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return []

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)

        citation_prompt = (
            f"The following is an AI-generated analysis of a computer-vision dataset's "
            f"class distribution:\n\n{analysis_text}\n\n"
            f"Find 2-4 real, authoritative sources (research papers, official docs, blog "
            f"posts) that support the reasoning above. For each, give a one-sentence "
            f"summary and the URL.\n\n"
            f"Respond with ONLY a JSON array:\n"
            f'[{{"text": "<summary>", "url": "<url>"}}, ...]'
        )

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=citation_prompt,
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
            ),
        )

        raw = response.text
        items = _extract_json(raw) if raw else []
        if isinstance(items, dict):
            items = items.get("citations", [])
        if not isinstance(items, list):
            return []

        return [
            Citation(text=item.get("text", ""), url=item.get("url"))
            for item in items
            if isinstance(item, dict) and item.get("text")
        ]
    except Exception as exc:  # noqa: BLE001
        print(f"[analyzer] Gemini citations error: {exc}")
        return []


# ── Public API ──────────────────────────────────────────────────────

async def analyze(
    purpose: str,
    distribution: list[ClassDistribution],
    use_watsonx: bool = True,
) -> AnalysisResponse:
    """Run AI-powered dataset analysis.

    1. Try watsonx (if enabled), then enrich with Gemini citations.
    2. If watsonx fails, fall back to Gemini for everything.
    """
    prompt = _build_prompt(purpose, distribution)
    raw_text: str | None = None

    # Step 1 — primary model
    if use_watsonx:
        raw_text = _call_watsonx(prompt)

    # Step 2 — fallback
    if raw_text is None:
        raw_text = _call_gemini_analysis(prompt)

    if raw_text is None:
        # Complete failure — return a sensible default
        return AnalysisResponse(
            analysis="Unable to reach any AI provider. Please check your API keys.",
            classes=[
                ClassAnalysis(
                    class_name=d.class_name,
                    current_count=d.count,
                    target_count=d.count,
                    strategy="keep",
                    rationale="AI unavailable — no change suggested.",
                )
                for d in distribution
            ],
            citations=[],
        )

    # Parse the JSON response
    try:
        parsed = _extract_json(raw_text)
    except json.JSONDecodeError:
        return AnalysisResponse(
            analysis=raw_text[:500],
            classes=[
                ClassAnalysis(
                    class_name=d.class_name,
                    current_count=d.count,
                    target_count=d.count,
                    strategy="keep",
                    rationale="Could not parse AI response.",
                )
                for d in distribution
            ],
            citations=[],
        )

    analysis_text = parsed.get("analysis", "")
    classes = [
        ClassAnalysis(
            class_name=c["class_name"],
            current_count=c["current_count"],
            target_count=c["target_count"],
            strategy=c["strategy"],
            rationale=c.get("rationale", ""),
        )
        for c in parsed.get("classes", [])
    ]

    # Step 3 — enrich with citations via Gemini + Google Search grounding
    citations = _call_gemini_citations(analysis_text)

    return AnalysisResponse(
        analysis=analysis_text,
        classes=classes,
        citations=citations,
    )
