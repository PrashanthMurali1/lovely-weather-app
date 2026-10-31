import { registerSW } from "virtual:pwa-register";

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  registerSW({ immediate: true });
}
