export interface DatasetMetadata {
  path: string;
  splits: SplitInfo[];
  categories: CategoryInfo[];
}

export interface SplitInfo {
  name: string;
  image_count: number;
  annotation_count: number;
}

export interface CategoryInfo {
  id: number;
  name: string;
}

export interface BubbleRecord {
  image_id: number;
  image_name: string;
  class_name: string;
  class_id: number;
  count: number;
}

export interface ClassDistribution {
  class_name: string;
  class_id: number;
  count: number;
}

export interface ParseResult {
  bubbles: BubbleRecord[];
  distribution: ClassDistribution[];
  split: string;
}

export interface ClassAnalysis {
  class_name: string;
  current_count: number;
  target_count: number;
  strategy: 'upsample' | 'downsample' | 'keep';
  rationale: string;
}

export interface AnalysisResult {
  analysis: string;
  classes: ClassAnalysis[];
  citations: Citation[];
}

export interface Citation {
  text: string;
  url?: string;
}

export interface RebalanceTarget {
  class_name: string;
  target_count: number;
  strategy: 'upsample' | 'downsample' | 'keep';
}

export interface RebalanceProgress {
  step: string;
  progress: number;
  total: number;
  message: string;
}

export type AppStep = 'connect' | 'visualize' | 'analyze' | 'rebalance' | 'results';
