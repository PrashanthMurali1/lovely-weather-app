import type { HourlyPoint } from "../api/types";
import { formatClock, formatRainChance } from "../lib/format";
import { rainDensity } from "../lib/scales";
import { describeWeather } from "../lib/weatherCodes";

/** Quatrefoil motif centred in a 12-unit tile. */
function Quatrefoil({ className }: { className: string }) {
  return (
    <g className={className}>
      <ellipse cx="3.6" cy="6" rx="2.2" ry="1.3" />
      <ellipse cx="8.4" cy="6" rx="2.2" ry="1.3" />
      <ellipse cx="6" cy="3.6" rx="1.3" ry="2.2" />
      <ellipse cx="6" cy="8.4" rx="1.3" ry="2.2" />
    </g>
  );
}

function PrintPatterns() {
  return (
    <svg className="print-defs" aria-hidden="true" focusable="false" width="0" height="0">
      <defs>
        <pattern id="rain-print-1" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle className="print-ink" cx="8" cy="8" r="1.6" />
        </pattern>
        <pattern id="rain-print-2" width="12" height="12" patternUnits="userSpaceOnUse">
          <circle className="print-ink" cx="3" cy="3" r="1.7" />
          <circle className="print-ink" cx="9" cy="9" r="1.7" />
        </pattern>
        <pattern id="rain-print-3" width="12" height="12" patternUnits="userSpaceOnUse">
          <Quatrefoil className="print-ink" />
          <circle className="print-ink" cx="0" cy="0" r="1.3" />
          <circle className="print-ink" cx="12" cy="0" r="1.3" />
          <circle className="print-ink" cx="0" cy="12" r="1.3" />
          <circle className="print-ink" cx="12" cy="12" r="1.3" />
        </pattern>
        <pattern id="rain-print-4" width="12" height="12" patternUnits="userSpaceOnUse">
          <rect className="print-field" width="12" height="12" />
          <Quatrefoil className="print-resist" />
          <circle className="print-field" cx="6" cy="6" r="0.9" />
        </pattern>
      </defs>
    </svg>
  );
}

export default function HourlyStrip({ hourly }: { hourly: HourlyPoint[] }) {
  return (
    <section className="hourly" aria-labelledby="hourly-title">
      <div className="section-head">
        <h2 id="hourly-title">Hourly</h2>
        <p className="hourly-key">Denser print, likelier rain</p>
      </div>
      <PrintPatterns />
      <ol className="hourly-list">
        {hourly.map((h) => {
          const density = rainDensity(h.precipProbPct, h.precipMm);
          return (
            <li key={h.time} className="hourly-item">
              <span className="hourly-time">{formatClock(h.time)}</span>
              <svg className="hourly-print" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
                <rect className="print-ground" width="48" height="48" />
                {density > 0 ? <rect width="48" height="48" fill={`url(#rain-print-${density})`} /> : null}
              </svg>
              <span className="hourly-rain">
                <span className="visually-hidden">Chance of rain </span>
                {formatRainChance(h.precipProbPct, h.precipMm)}
              </span>
              <span className="hourly-temp">{Math.round(h.tempC)}°</span>
              <span className="hourly-condition visually-hidden">{describeWeather(h.weatherCode, true).label}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
