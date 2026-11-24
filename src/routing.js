import { useEffect, useState } from "react";

const searches = new Map();
const routes = new Map();
let nextRequest = 0;

export async function searchPlaces(text, signal) {
  const query = text.trim().replace(/^whasinthon$/i, "Washington");
  const params = new URLSearchParams({ q: query, limit: "8", countrycode: "us", lang: "en" });
  const key = params.toString();
  if (searches.has(key)) return searches.get(key);
  const response = await fetch("https://photon.komoot.io/api/?" + params, { signal });
  if (!response.ok) throw new Error("Search unavailable");
  const { features } = await response.json();
  const choices = features.filter(f => f.properties.countrycode?.toUpperCase() === "US").map(f => {
    const p = f.properties;
    const street = [p.housenumber, p.street].filter(Boolean).join(" ");
    const name = [...new Set([p.name, street, p.city, p.county, p.state, p.postcode].filter(Boolean))].join(", ");
    const [lng, lat] = f.geometry.coordinates;
    return { name: name || p.country, point: [lat, lng] };
  });
  searches.set(key, choices);
  return choices;
}

async function drivingRoute(key, signal) {
  if (routes.has(key)) return routes.get(key);
  const start = Math.max(Date.now(), nextRequest);
  nextRequest = start + 1050;
  await new Promise(resolve => setTimeout(resolve, Math.max(0, start - Date.now())));
  if (signal.aborted) throw new Error("Routing cancelled");
  const url = "https://router.project-osrm.org/route/v1/driving/" + key +
    "?overview=simplified&geometries=geojson&radiuses=1000;1000&steps=false";
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Routing unavailable");
  const data = await response.json();
  const route = data.routes?.[0];
  if (data.code !== "Ok" || !(route?.distance > 0) || !(route.duration > 0) || !route.geometry?.coordinates?.length) {
    throw new Error("No driving route");
  }
  const result = {
    distance: Math.max(0.01, Math.round(route.distance / 1609.344 * 100) / 100),
    minutes: Math.max(1, Math.round(route.duration / 60)),
    path: route.geometry.coordinates.map(([lng, lat]) => [lat, lng])
  };
  routes.set(key, result);
  return result;
}

export function useDrivingRoute(origin, destination, enabled, api) {
  const key = enabled && origin && destination
    ? [origin, destination].map(([lat, lng]) => lng.toFixed(6) + "," + lat.toFixed(6)).join(";")
    : null;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    let disposed = false;
    const timeout = setTimeout(() => controller.abort(), 20000);
    const timer = setTimeout(() => {
      (api ? api("route",{from:origin,to:destination}) : drivingRoute(key, controller.signal))
        .then(route => { if (!disposed) setResult({ key, attempt, route }); })
        .catch(err => { if (!disposed) setResult({ key, attempt, error: err.status===422?"point":!navigator.onLine?"offline":"service" }); }).finally(() => clearTimeout(timeout));
    }, 200);
    return () => { disposed = true; clearTimeout(timeout); clearTimeout(timer); controller.abort(); };
  }, [key, attempt, api]);
  const current = key && result?.key === key && result.attempt === attempt ? result : null;
  return { route: current?.route, error: current?.error, loading: Boolean(key && !current), retry: () => setAttempt(n => n + 1) };
}
