import { ApiError } from "../api/client";
import { formatFetchedWhen } from "../lib/format";
import Icon from "./Icon";

interface Props {
  offline: boolean;
  stale: boolean;
  fetchedAt?: string;
  error?: Error | null;
  onRetry: () => void;
}

function friendlyMessage(error: Error): string {
  if (!(error instanceof ApiError)) return "Can't reach the weather service.";
  if (error.code === "upstream_unavailable" || error.code === "upstream_rate_limited") {
    return "Weather data is temporarily unavailable.";
  }
  return "Something went wrong.";
}

export default function StatusBanner({ offline, stale, fetchedAt, error, onRetry }: Props) {
  if (error) {
    return (
      <div className="status-banner status-error" role="alert">
        <Icon name="alert" />
        <p>{friendlyMessage(error)}</p>
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }
  if (offline) {
    return (
      <div className="status-banner status-offline" role="status">
        <Icon name="offline" />
        <p>
          {fetchedAt
            ? `Offline, showing data from ${formatFetchedWhen(fetchedAt)}.`
            : "You're offline. Connect to load the forecast."}
        </p>
      </div>
    );
  }
  if (stale) {
    return (
      <div className="status-banner status-stale" role="status">
        <Icon name="clock" />
        <div className="status-text">
          <p>Showing older data — the weather service is unavailable.</p>
          {fetchedAt ? <p className="status-detail">From {formatFetchedWhen(fetchedAt)} IST.</p> : null}
        </div>
      </div>
    );
  }
  return null;
}
