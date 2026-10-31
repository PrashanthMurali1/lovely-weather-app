import type { Current, DailyPoint } from "../api/types";
import { formatClock } from "../lib/format";

export default function Stats({ current, today }: { current: Current; today?: DailyPoint }) {
  const rain = Math.round(current.precipMm * 10) / 10;
  return (
    <section className="stats" aria-labelledby="stats-title">
      <h2 id="stats-title" className="visually-hidden">
        Conditions
      </h2>
      <dl className="stats-list">
        <div>
          <dt>Rain now</dt>
          <dd>{rain} mm</dd>
        </div>
        {today ? (
          <>
            <div>
              <dt>Sunrise</dt>
              <dd>{formatClock(today.sunrise)} IST</dd>
            </div>
            <div>
              <dt>Sunset</dt>
              <dd>{formatClock(today.sunset)} IST</dd>
            </div>
          </>
        ) : null}
      </dl>
    </section>
  );
}
