import type { DailyPoint, HourlyPoint } from "../api/types";
import { formatClock, formatRainChance } from "../lib/format";
import { describeWeather } from "../lib/weatherCodes";
import { solarProgress } from "../lib/weatherScene";
import WeatherIcon from "./WeatherIcon";

export default function HourlyStrip({ hourly, daily = [] }: { hourly: HourlyPoint[]; daily?: DailyPoint[] }) {
  return (
    <section className="hourly surface" aria-labelledby="hourly-title">
      <div className="section-head"><h2 id="hourly-title"><span className="visually-hidden">Hourly forecast: </span>The next 48 hours</h2><p>Hourly temperature & precipitation</p></div>
      <ol className="hourly-list" aria-label="Hourly temperatures and precipitation" tabIndex={0}>
        {hourly.map((h, i) => {
          const day = daily.find(d => d.date === h.time.slice(0, 10));
          const isDay = day ? solarProgress(h.time, day) !== null : true;
          const newDay = i === 0 || hourly[i - 1].time.slice(0, 10) !== h.time.slice(0, 10);
          return (
            <li key={h.time} className="hourly-item">
              <span className="hourly-date">{newDay ? new Date(`${h.time.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }) : <span aria-hidden="true">&nbsp;</span>}</span>
              <time className="hourly-time" dateTime={h.time}>{i === 0 ? "Now" : formatClock(h.time).replace(":00 ", " ")}</time>
              <WeatherIcon code={h.weatherCode} isDay={isDay} />
              <span className="hourly-condition visually-hidden">{describeWeather(h.weatherCode, isDay).label}</span>
              <span className="hourly-temp">{Math.round(h.tempC)}°</span>
              <span className="hourly-rain"><span className="visually-hidden">Precipitation forecast </span>{formatRainChance(h.precipProbPct, h.precipMm)}</span>
            </li>
          );
        })}
      </ol>
      <p className="hourly-hint">Scroll for the full outlook <span aria-hidden="true">→</span></p>
    </section>
  );
}
