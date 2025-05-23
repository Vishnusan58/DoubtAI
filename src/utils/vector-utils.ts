/**
 * Utility functions for vector operations in embedding processes
 */

/**
 * Normalize a vector using L2 normalization (Euclidean norm)
 * This is equivalent to the Python normalize_l2 function in your script
 */
export function normalizeL2(vector: number[]): number[] {
  // Calculate the L2 norm (Euclidean norm)
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));

  // Return normalized vector or original if norm is zero
  return norm === 0 ? vector : vector.map(val => val / norm);
}
