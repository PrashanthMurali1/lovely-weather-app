import type { CSSProperties } from "react";
import type { DailyPoint } from "../api/types";
import { formatDay, formatRainChance } from "../lib/format";
import { describeWeather } from "../lib/weatherCodes";
import WeatherIcon from "./WeatherIcon";
import Icon from "./Icon";

export default function DailyList({ daily }: { daily: DailyPoint[] }) {
  const min = Math.min(...daily.map(d => d.tempMinC));
  const max = Math.max(...daily.map(d => d.tempMaxC));
  const spread = max - min;
  return (
    <section className="daily surface" aria-labelledby="daily-title">
      <div className="section-head"><h2 id="daily-title"><span className="visually-hidden">7-day forecast: </span>The week ahead</h2><p>Daily low & high</p></div>
      <ol className="daily-list">
        {daily.map(d => {
          const range: CSSProperties = { left: `${spread > 0 ? ((d.tempMinC - min) / spread) * 100 : 0}%`, width: `${spread > 0 ? ((d.tempMaxC - d.tempMinC) / spread) * 100 : 100}%` };
          return (
            <li key={d.date} className="daily-item">
              <time className="daily-day" dateTime={d.date}>{formatDay(d.date)}</time>
              <WeatherIcon code={d.weatherCode} />
              <span className="daily-low"><span className="visually-hidden">Low </span>{Math.round(d.tempMinC)}°</span>
              <span className="temperature-range" aria-hidden="true"><span className="temperature-range-fill" style={range} /></span>
              <span className="daily-high"><span className="visually-hidden">High </span>{Math.round(d.tempMaxC)}°</span>
              <span className="daily-detail"><span className="daily-condition">{describeWeather(d.weatherCode, true).label}</span><span className="daily-rain"><Icon name="drop" /><span className="visually-hidden">Precipitation forecast </span>{formatRainChance(d.precipProbPct, d.precipSumMm)}</span></span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
