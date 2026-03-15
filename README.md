# PerfectBlend

Create the perfect blend of data to fix class bias in computer vision datasets before fine-tuning models. 

PerfectBlend inspects a COCO-format dataset, identifies class imbalances with with AI-powered, context-aware analysis, and rebalances the dataset through downsampling and data augmentation. 

## What it does

- **Connect** a local COCO dataset by directory path
- **Visualize** per-image class distribution as an interactive packed bubble chart using D3.js
- **Analyze** class bias using Gemini + RailTracks, grounded in real-world domain citations
- **Adjust** AI-suggested annotation targets before applying any chances so that you stay in control
- **Rebalance** via downsampling majority classes and augmenting minority classes; visualize and view the new exported balanced dataset

## Tech stack

```
Frontend   React · TypeScript · Tailwind CSS · D3.js
Backend    Python · FastAPI · RailTracks · Gemini API · Albumentations
```

## Setup

**Backend** — run from the `api/` directory:

```bash
cd api
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env          # then fill in your API keys
uvicorn main:app --reload
```

**Frontend** — run from the project root:

```bash
npm install
npm run dev
```

## Environment variables

Create `api/.env` and fill in:

```
GEMINI_API_KEY=your_key
GEMINI_MODEL=your_model      # e.g. gemini-3-flash
```

## Test dataset

`skin_dataset/` is included — a pre-split COCO dataset with train/valid/test splits ready to use. Point the app at the absolute path to `skin_dataset/` to walk try out PerfectBlend.

## Dataset format

Your dataset must follow this structure:

```
your_dataset/
├── train/
│   ├── _annotations.coco.json
│   └── images (*.jpg / *.png / *.webp)
├── valid/
│   ├── _annotations.coco.json
│   └── images
└── test/
    ├── _annotations.coco.json
    └── images
```

Note: only the `train/` folder will be rebalanced.
