/**
 * Minimal accessible SVG bar chart, extracted from the dashboard's Analytics
 * section (#479) so other time-series views can reuse it. The referral
 * dashboard's volume-over-time chart (#469) uses this instead of adding a
 * charting dependency — no chart library exists in package.json, and this is
 * the in-house "charting library" already used elsewhere in the app.
 *
 * Generic over the datum type so callers bring their own bucket shape (only
 * `date`/`label` are required); `formatValue` is explicit rather than
 * baked in, since different callers format volume vs. a plain count.
 */
export interface BarChartDatum {
  /** Used as the React key. */
  date: string;
  /** Short display label shown in the per-bar tooltip, e.g. "Aug 1". */
  label: string;
}

export interface BarChartProps<T extends BarChartDatum> {
  buckets: T[];
  valueOf: (bucket: T) => number;
  /** Formats a value for the per-bar tooltip, e.g. `(v) => v.toLocaleString()`. */
  formatValue: (value: number) => string;
  ariaLabel: string;
  color: string;
}

/** Each bar carries a <title> with its value, for the accessible tooltip. */
export function BarChart<T extends BarChartDatum>({ buckets, valueOf, formatValue, ariaLabel, color }: BarChartProps<T>) {
  const max = Math.max(...buckets.map(valueOf), 1);
  const width = 600;
  const height = 140;
  const gap = 2;
  const slot = width / buckets.length;
  const barWidth = Math.max(2, slot - gap * 2);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      className="w-full h-36"
      preserveAspectRatio="none"
    >
      {buckets.map((bucket, index) => {
        const value = valueOf(bucket);
        const barHeight = (value / max) * (height - 8);
        return (
          <rect
            key={bucket.date}
            x={index * slot + gap}
            y={height - barHeight - 4}
            width={barWidth}
            height={value > 0 ? Math.max(barHeight, 1) : 0}
            rx={1}
            fill={color}
          >
            <title>{`${bucket.label}: ${formatValue(value)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
