import './ProgressBar.css';

/**
 * Slim accent progress bar. Renders a determinate fill when `value` is given
 * (0..1), or an indeterminate sliding animation while work of unknown length
 * is running. Pair it with a visible text status; the bar itself is
 * presentational.
 */
export function ProgressBar({ value }: { value?: number }) {
  if (value === undefined) {
    return (
      <span className="progress-bar" aria-hidden="true">
        <span className="progress-bar__slider" />
      </span>
    );
  }
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <span className="progress-bar" aria-hidden="true">
      <span className="progress-bar__fill" style={{ width: `${String(pct)}%` }} />
    </span>
  );
}
