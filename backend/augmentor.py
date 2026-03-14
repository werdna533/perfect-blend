"""Image augmentation pipeline for COCO-format datasets."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import albumentations as A
import cv2
import numpy as np


def create_augmentation_pipeline() -> A.Compose:
    """Build an augmentation pipeline safe for segmentation masks.

    No rotation transforms are included — they would misalign polygon
    segmentation masks that are transformed independently.
    """
    return A.Compose(
        [
            A.HorizontalFlip(p=0.5),
            A.VerticalFlip(p=0.3),
            A.RandomBrightnessContrast(
                brightness_limit=0.2, contrast_limit=0.2, p=0.5
            ),
            A.HueSaturationValue(
                hue_shift_limit=10, sat_shift_limit=20, val_shift_limit=20, p=0.5
            ),
            A.GaussNoise(var_limit=(10, 50), p=0.3),
            A.Blur(blur_limit=3, p=0.2),
        ],
        bbox_params=A.BboxParams(
            format="coco",
            label_fields=["category_ids"],
            min_visibility=0.3,
        ),
    )


# ── Polygon <-> mask helpers ────────────────────────────────────────

def _segmentation_to_mask(
    segmentation: list[list[float]], height: int, width: int
) -> np.ndarray:
    """Convert COCO segmentation polygons to a binary mask."""
    mask = np.zeros((height, width), dtype=np.uint8)
    for polygon in segmentation:
        pts = np.array(polygon, dtype=np.float32).reshape(-1, 2)
        pts = pts.astype(np.int32)
        cv2.fillPoly(mask, [pts], 1)
    return mask


def _mask_to_segmentation(mask: np.ndarray) -> list[list[float]]:
    """Convert a binary mask back to COCO segmentation polygon lists."""
    contours, _ = cv2.findContours(
        mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    segmentation: list[list[float]] = []
    for contour in contours:
        if contour.shape[0] < 3:
            continue  # need at least 3 points for a polygon
        poly = contour.flatten().tolist()
        segmentation.append(poly)
    return segmentation


def _mask_to_bbox(mask: np.ndarray) -> list[float]:
    """Compute COCO-format bbox [x, y, w, h] from a binary mask."""
    ys, xs = np.where(mask > 0)
    if len(xs) == 0:
        return [0.0, 0.0, 0.0, 0.0]
    x_min, x_max = float(xs.min()), float(xs.max())
    y_min, y_max = float(ys.min()), float(ys.max())
    return [x_min, y_min, x_max - x_min, y_max - y_min]


# ── Public API ──────────────────────────────────────────────────────

def augment_image(
    image_path: Path,
    annotations: list[dict[str, Any]],
    pipeline: A.Compose,
    output_dir: Path,
    prefix: str,
) -> tuple[Path, list[dict[str, Any]]]:
    """Augment a single image along with its COCO annotations.

    Parameters
    ----------
    image_path
        Path to the source image file.
    annotations
        List of COCO annotation dicts belonging to this image.
    pipeline
        An albumentations Compose pipeline (from ``create_augmentation_pipeline``).
    output_dir
        Directory to write the augmented image into.
    prefix
        Unique prefix for the output filename (e.g. ``"aug_003_"``).

    Returns
    -------
    new_image_path
        Path to the saved augmented image.
    new_annotations
        Transformed annotation dicts (segmentation, bbox, area updated).
    """
    image = cv2.imread(str(image_path), cv2.IMREAD_COLOR)
    if image is None:
        raise FileNotFoundError(f"Cannot read image: {image_path}")
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    h, w = image.shape[:2]

    # Prepare masks, bboxes, category_ids
    masks: list[np.ndarray] = []
    bboxes: list[list[float]] = []
    category_ids: list[int] = []

    for ann in annotations:
        seg = ann.get("segmentation", [])
        mask = _segmentation_to_mask(seg, h, w) if seg else np.zeros((h, w), dtype=np.uint8)
        masks.append(mask)

        bbox = ann.get("bbox", [0, 0, 0, 0])
        # Clamp bbox to image bounds for albumentations
        x, y, bw, bh = bbox
        x = max(0.0, min(float(x), w - 1))
        y = max(0.0, min(float(y), h - 1))
        bw = max(1.0, min(float(bw), w - x))
        bh = max(1.0, min(float(bh), h - y))
        bboxes.append([x, y, bw, bh])
        category_ids.append(ann["category_id"])

    # Apply augmentation
    transformed = pipeline(
        image=image,
        masks=masks,
        bboxes=bboxes,
        category_ids=category_ids,
    )

    aug_image = transformed["image"]
    aug_masks = transformed["masks"]
    aug_bboxes = transformed["bboxes"]
    aug_cat_ids = transformed["category_ids"]

    # Save augmented image
    output_dir.mkdir(parents=True, exist_ok=True)
    out_name = f"{prefix}{image_path.name}"
    out_path = output_dir / out_name
    cv2.imwrite(str(out_path), cv2.cvtColor(aug_image, cv2.COLOR_RGB2BGR))

    # Build new annotations
    new_annotations: list[dict[str, Any]] = []
    for mask, bbox, cat_id in zip(aug_masks, aug_bboxes, aug_cat_ids):
        seg = _mask_to_segmentation(mask)
        if not seg:
            continue  # annotation vanished after transform
        new_bbox = _mask_to_bbox(mask)
        area = float(mask.sum())
        new_annotations.append(
            {
                "segmentation": seg,
                "bbox": new_bbox,
                "area": area,
                "category_id": cat_id,
                "iscrowd": 0,
            }
        )

    return out_path, new_annotations
