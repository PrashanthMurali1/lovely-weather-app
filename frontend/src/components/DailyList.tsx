import type { DailyPoint } from "../api/types";
import { formatDay, formatRainChance } from "../lib/format";
import { describeWeather } from "../lib/weatherCodes";

export default function DailyList({ daily }: { daily: DailyPoint[] }) {
  return (
    <section className="daily" aria-labelledby="daily-title">
      <h2 id="daily-title">7-day forecast</h2>
      <ol className="daily-list">
        {daily.map((d) => (
          <li key={d.date} className="daily-item">
            <span className="daily-day">{formatDay(d.date)}</span>
            <span className="daily-condition">{describeWeather(d.weatherCode, true).label}</span>
            <span className="daily-rain">
              <span className="visually-hidden">Chance of rain </span>
              {formatRainChance(d.precipProbPct, d.precipSumMm)}
            </span>
            <span className="daily-temps">
              <span className="visually-hidden">High </span>
              {Math.round(d.tempMaxC)}°<span className="visually-hidden"> Low </span> / {Math.round(d.tempMinC)}°
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
