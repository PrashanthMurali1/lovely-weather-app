import { useCallback, useEffect, useRef, useState } from "react";
import type { Place } from "./api/types";
import DailyList from "./components/DailyList";
import Footer from "./components/Footer";
import Hero from "./components/Hero";
import HourlyStrip from "./components/HourlyStrip";
import Icon from "./components/Icon";
import WeatherScene from "./components/WeatherScene";
import WeatherIcon from "./components/WeatherIcon";
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
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const pageRef = useRef<HTMLDivElement>(null);
  const online = useOnline();
  const forecast = useForecast(place);
  useEffect(() => {
    if (pageRef.current) pageRef.current.inert = searchOpen;
  }, [searchOpen]);
  useEffect(() => {
    const update = () => { document.documentElement.dataset.pageHidden = String(document.hidden); };
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const selectPlace = useCallback((p: Place) => {
    setPlace(p);
    setSearchOpen(false);
  }, []);

  const locateMe = () => {
    if (locating) return;
    const failed = () => {
      setLocating(false);
      setLocationMessage("Couldn't get your location. Your selected city is unchanged; you can search instead.");
    };
    try {
      if (!navigator.geolocation) { failed(); return; }
      setLocating(true);
      setLocationMessage("Finding your location…");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPlace({
            id: -1,
            name: "My location",
            admin: null,
            lat: round2(pos.coords.latitude),
            lon: round2(pos.coords.longitude),
          });
          setLocating(false);
          setLocationMessage("");
          setSearchOpen(false);
        },
        failed,
        { timeout: 10_000, maximumAge: 300_000 },
      );
    } catch {
      failed();
    }
  };

  const data = forecast.data;
  const today = data?.daily.find(d => d.date === data.current.time.slice(0, 10));

  return (
    <>
      <WeatherScene current={data?.current} today={today} />
      <div className="app-content" ref={pageRef}>
      <header className="app-header">
        <h1 className="app-title">
          <WeatherIcon code={0} />
          India Weather
        </h1>
        <div className="app-actions">
          <button type="button" className="btn btn-quiet" title="Use my location" onClick={locateMe} disabled={locating} aria-busy={locating}>
            <Icon name="locate" />
            <span className="visually-hidden">Use my location</span>
          </button>
          <button type="button" className="btn btn-primary" aria-label="Search places" onClick={() => setSearchOpen(true)}>
            <Icon name="search" />
            <span>
              Search<span className="visually-hidden"> places</span>
            </span>
          </button>
        </div>
      </header>
      <main className="forecast">
        {locationMessage ? <p className="location-message" role="status">{locationMessage}</p> : null}
        <StatusBanner
          offline={!online}
          stale={data?.stale ?? false}
          fetchedAt={data?.fetchedAt}
          error={forecast.isError ? forecast.error : null}
          onRetry={() => void forecast.refetch()}
        />
        {data ? (
          <>
            <Hero place={place} current={data.current} fetchedAt={data.fetchedAt} today={today} />
            <HourlyStrip hourly={data.hourly} daily={data.daily} />
            <div className="forecast-details">
              <DailyList daily={data.daily.slice(0, 7)} />
              <Stats current={data.current} today={today} />
            </div>
          </>
        ) : forecast.isError ? (
          <div className="empty-field">
            <WeatherIcon code={3} />
            <p className="empty-title">No forecast yet</p>
            <p className="empty-body">
              We couldn’t load the weather for {place.name}. Tap Retry to try again.
            </p>
          </div>
        ) : (
          <div className="loading" role="status"><p>Loading forecast…</p><div className="loading-shape" aria-hidden="true" /><div className="loading-line" aria-hidden="true" /></div>
        )}
      </main>
      <Footer attribution={data?.attribution ?? FALLBACK_ATTRIBUTION} model={data?.model} />
      </div>
      <SearchSheet open={searchOpen} onClose={closeSearch} onSelect={selectPlace} onLocate={locateMe} locating={locating} locationMessage={locationMessage} />
    </>
  );
}
