"""AI-powered dataset analysis using RailTracks + Gemini (fallback)."""

from __future__ import annotations

import json
import os
import re
from typing import Any

from models import AnalysisResponse, Citation, ClassAnalysis, ClassDistribution

# Fix broken SSL_CERT_FILE env var (e.g. leftover from old RailsInstaller)
_ssl_cert = os.environ.get("SSL_CERT_FILE", "")
if _ssl_cert and not os.path.exists(_ssl_cert):
    os.environ.pop("SSL_CERT_FILE", None)


# ── Helpers ─────────────────────────────────────────────────────────

def _extract_json(text: str) -> Any:
    """Extract JSON from a response that may contain markdown code fences."""
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
- Use a COMBINATION of upsampling minority classes and downsampling majority classes where
  practical. Do not upsample-only if it would more than double the total dataset size.
- Prefer downsampling the majority when it has significantly more annotations than needed
  for the task — removing redundant majority examples is often better than flooding with
  synthetic minority examples.
- Aim for a distribution that makes sense for the stated fine-tuning purpose, NOT
  necessarily a perfectly uniform distribution.
- For each class, specify a concrete target annotation count, the strategy
  ("upsample", "downsample", or "keep"), and a short rationale.
- Provide a brief (2-4 sentence) overall strategy blurb.
- Use the search_recent_research tool to find relevant papers supporting your recommendations.

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


# ── RailTracks agent (primary) ───────────────────────────────────────

def _build_railtracks_agent():
    """Build a RailTracks agent with Gemini LLM + Gemini-grounded web search tool."""
    import railtracks as rt  # type: ignore[import-untyped]
    from google import genai  # type: ignore[import-untyped]
    from google.genai import types  # type: ignore[import-untyped]

    gemini_api_key = os.environ.get("GEMINI_API_KEY", "")
    gemini_model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

    @rt.function_node
    def search_recent_research(query: str) -> str:
        """Search for recent research papers and best practices on ML dataset balancing and class imbalance."""
        try:
            client = genai.Client(api_key=gemini_api_key)
            response = client.models.generate_content(
                model=gemini_model,
                contents=f"Find recent authoritative research on: {query}. Summarize key findings relevant to ML dataset class imbalance.",
                config=types.GenerateContentConfig(
                    tools=[types.Tool(google_search=types.GoogleSearch())],
                ),
            )
            return response.text or "No results found."
        except Exception as exc:
            return f"Search unavailable: {exc}"

    agent = rt.agent_node(
        name="dataset_bias_analyzer",
        tool_nodes=(search_recent_research,),
        llm=rt.llm.GeminiLLM(
            model_name=gemini_model,
            api_key=gemini_api_key,
            temperature=0.3,
        ),
        system_message=(
            "You are an expert MLOps data-quality engineer specializing in computer vision datasets. "
            "When asked to analyze class imbalance, use the search_recent_research tool to find "
            "supporting evidence for your recommendations before giving your final answer."
        ),
        max_tool_calls=1,
    )
    return agent, rt


async def _call_railtracks(prompt: str) -> tuple[str | None, list[Citation]]:
    """Run the RailTracks agent. Returns (raw_text, citations)."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None, []

    try:
        agent, rt = _build_railtracks_agent()
        raw = await rt.call(agent, prompt)
        text = str(raw) if raw else None
        if not text:
            return None, []
        # RailTracks wraps responses in LLMResponse(...) — unwrap it
        llm_match = re.match(r"^LLMResponse\((.*)\)$", text, re.DOTALL)
        if llm_match:
            text = llm_match.group(1).strip()
        return text, []
    except Exception as exc:
        print(f"[analyzer] RailTracks error: {type(exc).__name__}: {exc}")
        return None, []


# ── Gemini direct fallback ───────────────────────────────────────────

def _call_gemini_analysis(prompt: str) -> str | None:
    """Direct Gemini call as fallback."""
    api_key = os.environ.get("GEMINI_API_KEY")
    model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    if not api_key:
        return None

    try:
        from google import genai  # type: ignore[import-untyped]

        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(model=model, contents=prompt)
        return response.text
    except Exception as exc:
        print(f"[analyzer] Gemini fallback error: {type(exc).__name__}: {exc}")
        return None


def _call_gemini_citations(analysis_text: str) -> list[Citation]:
    """Fetch citations via Gemini + Google Search grounding."""
    api_key = os.environ.get("GEMINI_API_KEY")
    model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    if not api_key:
        return []

    try:
        from google import genai  # type: ignore[import-untyped]
        from google.genai import types  # type: ignore[import-untyped]

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
            model=model,
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
    except Exception as exc:
        print(f"[analyzer] Gemini citations error: {exc}")
        return []


# ── Public API ──────────────────────────────────────────────────────

async def analyze(
    purpose: str,
    distribution: list[ClassDistribution],
) -> AnalysisResponse:
    """Run AI-powered dataset analysis.

    1. Try RailTracks agent (Gemini LLM + Gemini-grounded web search tool).
    2. If that fails, fall back to direct Gemini call + Gemini citation search.
    """
    prompt = _build_prompt(purpose, distribution)

    # Step 1 — RailTracks agent
    raw_text, citations = await _call_railtracks(prompt)

    # Step 2 — fallback to direct Gemini
    if raw_text is None:
        raw_text = _call_gemini_analysis(prompt)

    if raw_text is None:
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
    except (json.JSONDecodeError, ValueError):
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

    # Fetch citations (no sleep needed — agent + citation = 3 calls max, within free tier)
    if not citations:
        citations = _call_gemini_citations(analysis_text)

    return AnalysisResponse(
        analysis=analysis_text,
        classes=classes,
        citations=citations,
    )
