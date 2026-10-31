import type { Current, DailyPoint, Place } from "../api/types";
import { formatClock, formatFetchedWhen } from "../lib/format";
import { describeWeather } from "../lib/weatherCodes";

interface Props { place: Place; current: Current; fetchedAt: string; today?: DailyPoint }

export default function Hero({ place, current, fetchedAt, today }: Props) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <h2 id="hero-title" className="hero-place">{place.name}</h2>
      <p className="hero-admin">{place.admin ? `${place.admin}, India` : "Your current location"}</p>
      <p className="hero-temp">{Math.round(current.tempC)}°</p>
      <p className="hero-condition">{describeWeather(current.weatherCode, current.isDay).label}</p>
      <div className="hero-summary">
        {today ? <p>High {Math.round(today.tempMaxC)}° <span aria-hidden="true">·</span> Low {Math.round(today.tempMinC)}°</p> : null}
        <p>Feels like {Math.round(current.feelsLikeC)}°</p>
      </div>
      <p className="hero-updated">Forecast as of {formatClock(current.time)} IST <span aria-hidden="true">·</span> Updated {formatFetchedWhen(fetchedAt)} IST</p>
    </section>
  );
}
