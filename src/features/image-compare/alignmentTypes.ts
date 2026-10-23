export type Matrix3 = [number, number, number, number, number, number, number, number, number];
export interface Point { x: number; y: number }
export interface AlignmentMatch { source: Point; target: Point }
export interface AlignmentCandidate {
  id: string; sourceRevision: string; mode: "affine" | "homography"; profile: "strict" | "lenient"; inverted: boolean;
  matrix: Matrix3; matches: number; trainingMatches: number; inliers: number; inlierRatio: number; holdoutCount: number; holdoutMedianError: number;
  sourceCoverage: number; targetCoverage: number; overlapRatio: number;
}
