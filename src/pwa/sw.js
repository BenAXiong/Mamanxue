/// <reference no-default-lib="true" />
import { clientsClaim } from "workbox-core";
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute, setCatchHandler } from "workbox-routing";
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";
import { RangeRequestsPlugin } from "workbox-range-requests";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

const APP_SHELL_CACHE = "mx-app-shell";
const AUDIO_CACHE = "mx-audio";
const DECKS_CACHE = "mx-decks";
const OTHER_ASSETS_CACHE = "mx-assets";

self.__WB_DISABLE_DEV_LOGS = true;

cleanupOutdatedCaches();

precacheAndRoute(self.__WB_MANIFEST ?? [], {
  cleanURLs: true,
  ignoreURLParametersMatching: [/^utm_/, /^fbclid$/],
  directoryIndex: "index.html",
});

const appShellHandler = createHandlerBoundToURL("/index.html");

registerRoute(
  new NavigationRoute(appShellHandler, {
    denylist: [/^\/api\//, /^\/__\/vite/],
  }),
);

// Cache application fonts and images with stale-while-revalidate.
registerRoute(
  ({ request }) =>
    request.destination === "style" ||
    request.destination === "font" ||
    request.destination === "image" ||
    request.destination === "script",
  new StaleWhileRevalidate({
    cacheName: OTHER_ASSETS_CACHE,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
      }),
    ],
  }),
);

// Runtime caching for MP3 assets with range support.
registerRoute(
  ({ request, url }) =>
    request.method === "GET" &&
    (request.destination === "audio" || url.pathname.endsWith(".mp3")),
  new CacheFirst({
    cacheName: AUDIO_CACHE,
    matchOptions: {
      ignoreSearch: true,
    },
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200, 206],
      }),
      new RangeRequestsPlugin(),
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  }),
);

// Runtime caching for decks JSON (stale-while-revalidate).
registerRoute(
  ({ request, url }) =>
    request.method === "GET" &&
    url.pathname.startsWith("/decks/") &&
    url.pathname.endsWith(".json"),
  new StaleWhileRevalidate({
    cacheName: DECKS_CACHE,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
      }),
    ],
  }),
);

// Network-first for JSON/requests that should stay fresh (e.g., build tags).
registerRoute(
  ({ request, url }) =>
    request.method === "GET" &&
    url.pathname === "/build.json",
  new NetworkFirst({
    cacheName: APP_SHELL_CACHE,
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
);

clientsClaim();

setCatchHandler(async ({ event }) => {
  if (event.request.destination === "document") {
    return appShellHandler({
      request: event.request,
    });
  }
  return Response.error();
});

self.addEventListener("message", (event) => {
  if (!event.data) {
    return;
  }
  if (event.data.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});
