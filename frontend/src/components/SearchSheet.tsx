import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { Place } from "../api/types";
import { useSavedPlaces } from "../hooks/useSavedPlaces";
import { useSearch } from "../hooks/useSearch";
import Icon from "./Icon";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (p: Place) => void;
  onLocate?: () => void;
  locating?: boolean;
  locationMessage?: string;
}

const label = (p: Place) => (p.admin ? `${p.name}, ${p.admin}` : p.name);

export default function SearchSheet({ open, onClose, onSelect, onLocate, locating, locationMessage }: Props) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const { saved, recent, save, remove, touch } = useSavedPlaces();
  const search = useSearch(q);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    return () => {
      setQ("");
      document.body.style.overflow = overflow;
      // Parent removes inert in its effect before focus returns to the opener.
      queueMicrotask(() => opener?.focus());
    };
  }, [open]);

  if (!open) return null;

  const isSaved = (p: Place) => saved.some((s) => s.id === p.id);
  const choose = (p: Place) => {
    touch(p);
    onSelect(p);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === "Tab" && dialogRef.current) {
      const items = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled])"),
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const renderItem = (p: Place) => (
    <li key={p.id} className="search-item">
      <button type="button" className="search-select" onClick={() => choose(p)}>
        {label(p)}
      </button>
      {isSaved(p) ? (
        <button type="button" className="search-toggle search-remove" aria-label={`Remove ${p.name}`} onClick={() => remove(p.id)}>
          Remove
        </button>
      ) : (
        <button type="button" className="search-toggle search-save" aria-label={`Save ${p.name}`} onClick={() => save(p)}>
          Save
        </button>
      )}
    </li>
  );

  const searching = q.trim().length >= 2;
  const savedNewestFirst = [...saved].reverse();

  return (
    <div className="search-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div
      className="search-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-title"
      ref={dialogRef}
      onKeyDown={onKeyDown}
    >
      <div className="search-top">
        <div className="search-header">
          <h2 id="search-title">Choose a place</h2>
          <button type="button" className="search-close" onClick={onClose}>
            <Icon name="close" />
            Close
          </button>
        </div>
      </div>
      <div className="search-panel">
        <label className="search-label" htmlFor="search-input">
          Search for a city
        </label>
        <div className="search-field">
          <Icon name="search" />
          <input
            id="search-input"
            ref={inputRef}
            type="search"
            autoComplete="off"
            placeholder="Pune, Kochi, Guwahati…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {onLocate ? <button className="search-locate btn" type="button" onClick={onLocate} disabled={locating} aria-busy={locating}><Icon name="locate" />{locating ? "Finding your location…" : "Use my location"}</button> : null}
        {locationMessage ? <p className="search-note" role="status">{locationMessage}</p> : null}
        {searching ? (
          <section className="search-results" aria-label="Search results" aria-live="polite">
            {search.data ? (
              search.data.length === 0 ? (
                <p className="search-note">No cities found</p>
              ) : (
                <ol>{search.data.map(renderItem)}</ol>
              )
            ) : search.isError ? (
              <p className="search-note">Search is unavailable. Try again.</p>
            ) : (
              <p className="search-note">Searching…</p>
            )}
          </section>
        ) : (
          <>
            {savedNewestFirst.length > 0 ? (
              <section aria-labelledby="saved-title">
                <h3 id="saved-title">Saved places</h3>
                <ol>{savedNewestFirst.map(renderItem)}</ol>
              </section>
            ) : null}
            {recent.length > 0 ? (
              <section aria-labelledby="recent-title">
                <h3 id="recent-title">Recent places</h3>
                <ol>{recent.map(renderItem)}</ol>
              </section>
            ) : null}
            {savedNewestFirst.length === 0 && recent.length === 0 ? (
              <p className="search-note">Type at least two letters of a city or town name.</p>
            ) : null}
          </>
        )}
      </div>
    </div>
    </div>
  );
}
