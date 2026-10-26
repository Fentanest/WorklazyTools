import type {Bounds} from './types.ts';
export interface AlignmentFeatureRois {left?:Bounds;right?:Bounds}
export type Matrix3 = [number, number, number, number, number, number, number, number, number];
export interface Point { x: number; y: number }
export interface AlignmentMatch { source: Point; target: Point }
export interface AlignmentCandidate {
  id: string; sourceRevision: string; mode: "affine" | "homography"; profile: "strict" | "lenient"; inverted: boolean;
  holdoutSourceCoverage?:number;holdoutTargetCoverage?:number;
  featureRois?:{left:Bounds;right:Bounds};coverageReference?:"feature-roi"|"full-frame";originalDimensions?:{left:{width:number;height:number};right:{width:number;height:number}};
  matrix: Matrix3; matches: number; trainingMatches: number; inliers: number; inlierRatio: number; holdoutCount: number; holdoutMedianError: number;
  sourceCoverage: number; targetCoverage: number; overlapRatio: number;
}
