import type { Current, DailyPoint } from "../api/types";
import { compassDirection, formatClock } from "../lib/format";

export default function Stats({ current, today }: { current: Current; today?: DailyPoint }) {
  const rain = Math.round(current.precipMm * 10) / 10;
  return (
    <section className="stats" aria-labelledby="stats-title">
      <h2 id="stats-title" className="visually-hidden">
        Conditions
      </h2>
      <dl className="stats-list">
        <div>
          <dt>Humidity</dt>
          <dd>{Math.round(current.humidityPct)}%</dd>
        </div>
        <div>
          <dt>Wind</dt>
          <dd>
            {Math.round(current.windKph)} km/h {compassDirection(current.windDirDeg)}
          </dd>
        </div>
        <div>
          <dt>Rain</dt>
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
