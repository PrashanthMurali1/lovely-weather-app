import { QueryClient } from "@tanstack/react-query";

// offlineFirst: always run queryFn so the service worker's cached forecast is
// consulted even when the browser reports offline.
export function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { networkMode: "offlineFirst" } } });
}
