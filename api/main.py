"""FastAPI application for PerfectBlend — COCO dataset rebalancing tool."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import os
from dotenv import load_dotenv
load_dotenv()

# Fix broken SSL_CERT_FILE env var (e.g. leftover from old RailsInstaller)
_ssl_cert = os.environ.get("SSL_CERT_FILE", "")
if _ssl_cert and not os.path.exists(_ssl_cert):
    os.environ.pop("SSL_CERT_FILE", None)

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from analyzer import analyze
from models import (
    AnalyzeRequest,
    AnalysisResponse,
    ConnectRequest,
    ConnectResponse,
    CategoryInfo,
    ParseResponse,
    RebalanceRequest,
    SplitInfo,
)
from parser import parse_coco
from rebalancer import rebalance

# ── App setup ───────────────────────────────────────────────────────

app = FastAPI(title="PerfectBlend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Module-level state
_dataset_path: Path | None = None

KNOWN_SPLITS = ("train", "test", "valid")


# ── Helpers ─────────────────────────────────────────────────────────

def _find_splits(root: Path) -> list[SplitInfo]:
    """Discover dataset splits under *root*."""
    splits: list[SplitInfo] = []
    for name in KNOWN_SPLITS:
        split_dir = root / name
        ann_file = split_dir / "_annotations.coco.json"
        if not ann_file.exists():
            continue
        with open(ann_file, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        splits.append(
            SplitInfo(
                name=name,
                image_count=len(data.get("images", [])),
                annotation_count=len(data.get("annotations", [])),
            )
        )
    return splits


def _get_categories(root: Path) -> list[CategoryInfo]:
    """Read categories from the first available split."""
    for name in KNOWN_SPLITS:
        ann_file = root / name / "_annotations.coco.json"
        if ann_file.exists():
            with open(ann_file, "r", encoding="utf-8") as fh:
                data = json.load(fh)
            return [
                CategoryInfo(id=cat["id"], name=cat["name"])
                for cat in data.get("categories", [])
            ]
    return []


# ── Endpoints ───────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/dataset/connect", response_model=ConnectResponse)
async def connect_dataset(req: ConnectRequest):
    global _dataset_path

    root = Path(req.path)
    if not root.exists() or not root.is_dir():
        raise HTTPException(status_code=400, detail=f"Path does not exist or is not a directory: {req.path}")

    splits = _find_splits(root)
    if not splits:
        raise HTTPException(status_code=400, detail="No valid splits found. Expected subdirectories with _annotations.coco.json.")

    _dataset_path = root
    categories = _get_categories(root)

    return ConnectResponse(path=str(root), splits=splits, categories=categories)


@app.get("/api/dataset/parse", response_model=ParseResponse)
async def parse_dataset(split: str = Query(..., description="Split name (train, test, valid, or balanced)")):
    if _dataset_path is None:
        raise HTTPException(status_code=400, detail="No dataset connected. Call /api/dataset/connect first.")

    if split == "balanced":
        # Look for balanced_dataset directory next to the dataset
        balanced_dir = _dataset_path.parent / "balanced_dataset"
        if not balanced_dir.exists():
            # Also try inside the dataset path
            balanced_dir = _dataset_path / "balanced_dataset"
        ann_file = balanced_dir / "_annotations.coco.json"
    else:
        ann_file = _dataset_path / split / "_annotations.coco.json"

    if not ann_file.exists():
        raise HTTPException(status_code=404, detail=f"Annotation file not found: {ann_file}")

    bubbles, distribution = parse_coco(ann_file)
    return ParseResponse(bubbles=bubbles, distribution=distribution, split=split)


@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze_dataset(req: AnalyzeRequest):
    result = await analyze(purpose=req.purpose, distribution=req.distribution)
    return result


@app.post("/api/rebalance")
async def rebalance_dataset(req: RebalanceRequest):
    if _dataset_path is None:
        raise HTTPException(status_code=400, detail="No dataset connected.")

    # Default to the train split for rebalancing
    train_dir = _dataset_path / "train"
    if not (train_dir / "_annotations.coco.json").exists():
        # Fallback: use first available split
        for name in KNOWN_SPLITS:
            candidate = _dataset_path / name
            if (candidate / "_annotations.coco.json").exists():
                train_dir = candidate
                break
        else:
            raise HTTPException(status_code=400, detail="No split with annotations found.")

    output = Path(req.output_path)

    # SSE streaming with structured progress
    progress_queue: asyncio.Queue[dict] = asyncio.Queue()
    total_steps = len(req.targets) + 2  # targets + writing + done

    step_counter = {"n": 0}

    async def _progress(msg: str) -> None:
        step_counter["n"] += 1
        await progress_queue.put({
            "step": "Rebalancing",
            "progress": min(step_counter["n"], total_steps),
            "total": total_steps,
            "message": msg,
        })

    async def _run_rebalance():
        try:
            await rebalance(
                dataset_path=train_dir,
                targets=req.targets,
                output_path=output,
                progress_callback=_progress,
            )
            await progress_queue.put({
                "step": "Complete",
                "progress": total_steps,
                "total": total_steps,
                "message": "Blending complete!",
            })
        except Exception as exc:
            await progress_queue.put({
                "step": "Error",
                "progress": 0,
                "total": total_steps,
                "message": f"Error: {exc}",
            })

    async def _event_stream():
        task = asyncio.create_task(_run_rebalance())
        while True:
            data = await progress_queue.get()
            yield f"data: {json.dumps(data)}\n\n"
            if data["step"] in ("Complete", "Error"):
                break
        await task

    return StreamingResponse(_event_stream(), media_type="text/event-stream")
