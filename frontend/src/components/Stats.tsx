import type { ReactNode } from "react";
import type { Current, DailyPoint } from "../api/types";
import { compassDirection, formatClock, formatRainChance } from "../lib/format";
import { forecastTime } from "../lib/weatherScene";
import SunPath from "./SunPath";

function ConditionMetric({ label, value, detail }: { label: string; value: ReactNode; detail: string }) {
  return <div className="condition-metric"><dt>{label}</dt><dd>{value}<span className="metric-description">{detail}</span></dd></div>;
}
const solarLabel = (value: string) => Number.isFinite(forecastTime(value)) ? formatClock(value) : "Unavailable";

export default function Stats({ current, today }: { current: Current; today?: DailyPoint }) {
  return (
    <section className="stats surface" aria-labelledby="stats-title">
      <div className="section-head"><h2 id="stats-title">A closer look</h2><p>Current conditions</p></div>
      <dl className="stats-list">
        <ConditionMetric label="Precipitation" value={<>{Math.round(current.precipMm * 10) / 10}<span className="metric-unit"> mm</span></>} detail="Current interval" />
        <ConditionMetric label="Wind" value={<>{Math.round(current.windKph)}<span className="metric-unit"> km/h</span></>} detail={`From ${compassDirection(current.windDirDeg)}`} />
        <ConditionMetric label="Humidity" value={`${Math.round(current.humidityPct)}%`} detail="Relative humidity" />
        {today ? <ConditionMetric label={today.precipProbPct === null ? "Rainfall" : "Rain chance"} value={formatRainChance(today.precipProbPct, today.precipSumMm)} detail="Today's forecast" /> : null}
      </dl>
      {today ? <div className="solar"><SunPath time={current.time} today={today} /><dl className="solar-times"><div><dt>Sunrise</dt><dd>{solarLabel(today.sunrise)}</dd></div><div><dt>Sunset</dt><dd>{solarLabel(today.sunset)}</dd></div></dl></div> : null}
    </section>
  );
}
