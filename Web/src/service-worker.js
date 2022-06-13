import {
  pageCache,
  imageCache,
  staticResourceCache,
  offlineFallback,
} from 'workbox-recipes';
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { RouteMatchCallbackOptions } from 'workbox-core';

// Add custom service worker logic, such as a push notification serivce, or json request cache.
self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});


try {
  //@ts-ignore
  const filesToCacheManifest = self.__WB_MANIFEST; // array of {revision: string, url: string}

  // Add the "/" path to the precache manifest as well.
  const indexCache = filesToCacheManifest.find(f => f.url === "index.html");
  if (indexCache) {
    const indexCacheClone = {
      revision: indexCache.revision,
      url: "/"
    };
    precacheAndRoute(filesToCacheManifest.concat([indexCacheClone]));
  } else {
    precacheAndRoute(filesToCacheManifest);
  }
}
catch (err) {
  console.info("if you are in development mode this error is expected: ", err);
}

// Page cache recipe: https://developers.google.com/web/tools/workbox/modules/workbox-recipes#page_cache
// This is a network-first stragety for HTML pages. If the page doesn't respond in 3 seconds, it falls back to cache.
pageCache({
  networkTimeoutSeconds: 3,
  warmCache: [
    "/",
    "/browse/newest",
    "/browse/songs",
    "/browse/artists"],
});

// Static resource recipe: https://developers.google.com/web/tools/workbox/modules/workbox-recipes#static_resources_cache
// This is a stale-while-revalidate strategy for CSS, JS, and web workers.
// By default, this recipe matches styles, scripts, and workers.
// We override matchCallback to also include fonts and our JSON strings
const staticResourceDestinations = [
  "style",
  "script",
  "worker",
  "font"
]
staticResourceCache({
  matchCallback: e => staticResourceDestinations.some(dest => dest === e.request.destination)
});

// Image cache recipe: https://developers.google.com/web/tools/workbox/modules/workbox-recipes#image_cache
// This is a cache-first strategy for all images. We specify a max number of images and max age of image.
imageCache({
  maxAgeSeconds: 60 * 60 * 24 * 14, // 14 days: 60 seconds * 60 minutes in an hour * 24 hours in a day * 14 days
  maxEntries: 1000
});

// For our API calls to fetch apps, we use StaleWhileRevalidate strategy.
// This strategy loads from the cache first for fast UI updates. Meanwhile,
// we do a network request in the background to refresh the cache.
// These cache results remain valid for a short period of time before we invalidate them.
const apiCallPrefixes = [
  "/chords/get?", // Getting a specific chord sheet
  "/chords/getNew", // fetching new chord sheets
  "/chords/getbysongname", // chords by song name
  "/chords/getallartists", // list of all artists
  "/chords/getbyartistname", // list of artists sorted by name
  "/chords/search", // searches
];
/**
 *
 * @param {RouteMatchCallbackOptions} e
 * @returns Whether the route is a cachable API route.
 */
function isCachableApiRoute(e) {
  const host = e.url.host?.toLowerCase() || "";
  const isApiRoute = host === "api.messianicchords.com";
  const relativePath = e.url.pathname.toLowerCase();
  const result = isApiRoute && apiCallPrefixes.some(apiUrl => relativePath.startsWith(apiUrl));
  console.log(result ? "api cache hit" : "api cache miss", e.request.url);
  return result;
}

registerRoute(
  isCachableApiRoute,
  new StaleWhileRevalidate({
    cacheName: "api-cache",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days. OK to cache these longer as we have a StaleWhileRevalidate, meaning we show results from cache instantly while refreshing cache in background.
      })
    ]
  })
)

// Offline page recipe https://developers.google.com/web/tools/workbox/modules/workbox-recipes#offline_fallback
offlineFallback();