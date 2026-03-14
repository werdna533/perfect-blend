"""COCO-format JSON parsing utilities."""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path

from models import BubbleRecord, ClassDistribution


def parse_coco(
    json_path: Path,
) -> tuple[list[BubbleRecord], list[ClassDistribution]]:
    """Parse a COCO-format annotation file.

    Returns
    -------
    bubbles
        One record per (image, class) pair with the annotation count.
    distribution
        Global per-class annotation counts.
    """
    with open(json_path, "r", encoding="utf-8") as fh:
        data = json.load(fh)

    # Build lookup maps
    categories = {cat["id"]: cat["name"] for cat in data.get("categories", [])}
    images = {img["id"]: img["file_name"] for img in data.get("images", [])}

    # Count annotations per (image_id, category_id)
    pair_counts: dict[tuple[int, int], int] = Counter()
    for ann in data.get("annotations", []):
        pair_counts[(ann["image_id"], ann["category_id"])] += 1

    # Build bubble records
    bubbles: list[BubbleRecord] = []
    for (image_id, category_id), count in pair_counts.items():
        bubbles.append(
            BubbleRecord(
                image_id=image_id,
                image_name=images.get(image_id, f"unknown_{image_id}"),
                class_name=categories.get(category_id, f"class_{category_id}"),
                class_id=category_id,
                count=count,
            )
        )

    # Global class distribution
    class_counts: dict[int, int] = defaultdict(int)
    for (_, category_id), count in pair_counts.items():
        class_counts[category_id] += count

    distribution: list[ClassDistribution] = [
        ClassDistribution(
            class_name=categories.get(cid, f"class_{cid}"),
            class_id=cid,
            count=total,
        )
        for cid, total in sorted(class_counts.items())
    ]

    return bubbles, distribution
