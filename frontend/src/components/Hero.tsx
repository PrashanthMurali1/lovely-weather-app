import type { Current, Place } from "../api/types";
import { formatFetchedTime } from "../lib/format";
import { describeWeather } from "../lib/weatherCodes";

interface Props {
  place: Place;
  current: Current;
  fetchedAt: string;
}

export default function Hero({ place, current, fetchedAt }: Props) {
  const { label, icon } = describeWeather(current.weatherCode, current.isDay);
  return (
    <section className="hero" aria-labelledby="hero-title">
      <h2 id="hero-title" className="hero-place">
        {place.name}
        {place.admin ? <span className="hero-admin">, {place.admin}</span> : null}
      </h2>
      <p className="hero-temp">{Math.round(current.tempC)}°</p>
      <p className="hero-condition" data-icon={icon}>
        {label}
      </p>
      <p className="hero-feels">Feels like {Math.round(current.feelsLikeC)}°</p>
      <p className="hero-updated">Updated {formatFetchedTime(fetchedAt)}</p>
    </section>
  );
}
