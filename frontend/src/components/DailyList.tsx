import type { DailyPoint } from "../api/types";
import { formatDay, formatRainChance } from "../lib/format";
import { tempBand } from "../lib/scales";
import { describeWeather } from "../lib/weatherCodes";
import Icon from "./Icon";

export default function DailyList({ daily }: { daily: DailyPoint[] }) {
  return (
    <section className="daily" aria-labelledby="daily-title">
      <div className="section-head">
        <h2 id="daily-title">7-day forecast</h2>
      </div>
      <ol className="daily-list">
        {daily.map((d) => (
          <li key={d.date} className="daily-item">
            <span className="daily-day">{formatDay(d.date)}</span>
            <span className="daily-condition">{describeWeather(d.weatherCode, true).label}</span>
            <span className="daily-rain">
              <Icon name="drop" />
              <span className="visually-hidden">Chance of rain </span>
              {formatRainChance(d.precipProbPct, d.precipSumMm)}
            </span>
            <span className="daily-temps">
              <span className="visually-hidden">High </span>
              <span className="daily-high" data-band={tempBand(d.tempMaxC)}>
                {Math.round(d.tempMaxC)}°
              </span>
              <span className="visually-hidden"> Low </span>
              <span className="daily-low">{Math.round(d.tempMinC)}°</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
