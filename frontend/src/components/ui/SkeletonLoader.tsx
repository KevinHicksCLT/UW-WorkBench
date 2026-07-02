/** Props for {@link SkeletonLoader}. */
export interface SkeletonLoaderProps {
  /**
   * Number of shimmer blocks to render.
   * @default 1
   */
  count?: number;
  /** Pixel height of each block — rendered as an inline `style={{ height }}`, matching the markup it replaces. */
  height: number;
  /**
   * Class string for each block.
   * @default 'skeleton rounded-md'
   */
  itemClassName?: string;
  /**
   * Wrapper `<div>` class (e.g. `'space-y-2'`, `'grid grid-cols-2 gap-2'`).
   * When omitted, the blocks render without any wrapper element — preserving
   * the DOM of single bare-skeleton call sites.
   */
  className?: string;
}

/**
 * Shimmer placeholder — replaces the repeated
 * `Array.from({ length: n }).map(… <div className="skeleton …" style={{ height }} />)`
 * pattern. Each block renders `<div class="skeleton rounded-md" style="height: …px">`,
 * byte-identical to the markup it replaces.
 */
export function SkeletonLoader({ count = 1, height, itemClassName = 'skeleton rounded-md', className }: SkeletonLoaderProps) {
  const items = Array.from({ length: count }).map((_, i) => (
    <div key={i} className={itemClassName} style={{ height }} />
  ));
  return className ? <div className={className}>{items}</div> : <>{items}</>;
}
