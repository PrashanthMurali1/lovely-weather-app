import type { HourlyPoint } from "../api/types";
import { formatClock, formatRainChance } from "../lib/format";
import { describeWeather } from "../lib/weatherCodes";

export default function HourlyStrip({ hourly }: { hourly: HourlyPoint[] }) {
  return (
    <section className="hourly" aria-labelledby="hourly-title">
      <h2 id="hourly-title">Hourly</h2>
      <ol className="hourly-list">
        {hourly.map((h) => (
          <li key={h.time} className="hourly-item">
            <span className="hourly-time">{formatClock(h.time)}</span>
            <span className="hourly-condition">{describeWeather(h.weatherCode, true).label}</span>
            <span className="hourly-temp">{Math.round(h.tempC)}°</span>
            <span className="hourly-rain">
              <span className="visually-hidden">Chance of rain </span>
              {formatRainChance(h.precipProbPct, h.precipMm)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
