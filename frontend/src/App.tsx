import { useCallback, useEffect, useState } from "react";
import type { Place } from "./api/types";
import DailyList from "./components/DailyList";
import Footer from "./components/Footer";
import Hero from "./components/Hero";
import HourlyStrip from "./components/HourlyStrip";
import Icon from "./components/Icon";
import PrintBand from "./components/PrintBand";
import SearchSheet from "./components/SearchSheet";
import Stats from "./components/Stats";
import StatusBanner from "./components/StatusBanner";
import { useForecast } from "./hooks/useForecast";
import { useSavedPlaces } from "./hooks/useSavedPlaces";
import { DEFAULT_PLACE } from "./lib/defaults";

const FALLBACK_ATTRIBUTION = "Weather data by Open-Meteo.com";
const round2 = (n: number) => Math.round(n * 100) / 100;

function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export default function App() {
  const { recent } = useSavedPlaces();
  const [place, setPlace] = useState<Place>(() => recent[0] ?? DEFAULT_PLACE);
  const [searchOpen, setSearchOpen] = useState(false);
  const online = useOnline();
  const forecast = useForecast(place);

  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const selectPlace = useCallback((p: Place) => {
    setPlace(p);
    setSearchOpen(false);
  }, []);

  const locateMe = () => {
    try {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setPlace({
            id: -1,
            name: "My location",
            admin: null,
            lat: round2(pos.coords.latitude),
            lon: round2(pos.coords.longitude),
          }),
        () => {},
      );
    } catch {
      // unsupported or blocked: keep the current place
    }
  };

  const data = forecast.data;
  const nowHour = data ? data.current.time.slice(0, 13) : "";
  const upcoming = data ? data.hourly.filter((h) => h.time.slice(0, 13) >= nowHour).slice(0, 24) : [];

  return (
    <>
      <header className="app-header">
        <h1 className="app-title">
          <svg className="app-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <rect width="24" height="24" rx="2" className="app-mark-ground" />
            <g className="app-mark-motif" transform="translate(12 12)">
              {[0, 90, 180, 270].map((a) => (
                <path key={a} d="M0 -2.2Q3 -5.4 0 -8.6Q-3 -5.4 0 -2.2Z" transform={`rotate(${a})`} />
              ))}
            </g>
            <circle cx="12" cy="12" r="1.6" className="app-mark-heart" />
          </svg>
          India Weather
        </h1>
        <div className="app-actions">
          <button type="button" className="btn btn-quiet" title="Use my location" onClick={locateMe}>
            <Icon name="locate" />
            <span className="visually-hidden">Use my location</span>
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setSearchOpen(true)}>
            <Icon name="search" />
            <span>
              Search<span className="visually-hidden"> places</span>
            </span>
          </button>
        </div>
      </header>
      <main className="forecast">
        <StatusBanner
          offline={!online}
          stale={data?.stale ?? false}
          fetchedAt={data?.fetchedAt}
          error={forecast.isError ? forecast.error : null}
          onRetry={() => void forecast.refetch()}
        />
        {data ? (
          <>
            <Hero place={place} current={data.current} fetchedAt={data.fetchedAt} />
            <HourlyStrip hourly={upcoming.length > 0 ? upcoming : data.hourly.slice(0, 24)} />
            <Stats current={data.current} today={data.daily[0]} />
            <DailyList daily={data.daily.slice(0, 7)} />
          </>
        ) : forecast.isError ? (
          <div className="empty-field">
            <PrintBand />
            <p className="empty-title">No forecast yet</p>
            <p className="empty-body">
              We couldn’t load the weather for {place.name}. Tap Retry to try again.
            </p>
          </div>
        ) : (
          <p className="loading" role="status">
            Loading forecast…
          </p>
        )}
      </main>
      <Footer attribution={data?.attribution ?? FALLBACK_ATTRIBUTION} />
      <SearchSheet open={searchOpen} onClose={closeSearch} onSelect={selectPlace} />
    </>
  );
}
