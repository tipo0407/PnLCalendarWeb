/** Shimmer skeleton placeholders shown while heavier views load. Decorative. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

/** Skeleton stand-in for the Trade Atlas panel (KPI row + chart blocks). */
export default function AtlasSkeleton() {
  return (
    <div className="atlas-skeleton" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <Skeleton className="sk-eyebrow" />
      <Skeleton className="sk-title" />
      <div className="sk-kpi-row">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="sk-kpi" />)}
      </div>
      <div className="sk-charts">
        <Skeleton className="sk-chart" />
        <Skeleton className="sk-chart" />
      </div>
    </div>
  );
}
