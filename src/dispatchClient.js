import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
export const native = Capacitor.isNativePlatform();
export const host = (
  import.meta.env.VITE_VICTORIA_API ||
  (native ? localStorage.getItem("vt-server") : "") ||
  ""
).replace(/\/$/, "");
export async function request(token, endpoint, body) {
  const url = (host || location.origin) + "/dispatch/" + endpoint;
  const method = body === undefined ? "GET" : "POST";
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: "Bearer " + token } : {}),
  };
  const resp = native
    ? await CapacitorHttp.request({
        url,
        method,
        headers,
        data: body,
        readTimeout: 27000,
      })
    : await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(27000),
      });
  const data = native ? (typeof resp.data === "string" ? JSON.parse(resp.data) : resp.data) : await resp.json();
  if (resp.status >= 400)
    throw Object.assign(Error(data.error), { status: resp.status });
  return data;
}
export async function enablePush(key, api) {
  if (native) {
    const info = await api("info");
    if (!info.nativePush?.[Capacitor.getPlatform()])
      throw Error(
        "La central aún no tiene configurados los avisos para este dispositivo.",
      );
    if ((await PushNotifications.requestPermissions()).receive !== "granted")
      throw Error("Permiso de notificaciones denegado.");
    return new Promise((resolve, reject) => {
      const handles = [];
      const done = (err) => {
        clearTimeout(timer);
        handles.forEach((h) => h.remove());
        err ? reject(err) : resolve();
      };
      const timer = setTimeout(
        () => done(Error("No se pudo activar push en este dispositivo.")),
        15000,
      );
      Promise.all([
        PushNotifications.addListener("registration", (t) =>
          api("push", {
            token: t.value,
            platform: Capacitor.getPlatform(),
          }).then(() => done(), done),
        ),
        PushNotifications.addListener("registrationError", () =>
          done(Error("Push no disponible.")),
        ),
      ])
        .then((h) => {
          handles.push(...h);
          return PushNotifications.register();
        })
        .catch(done);
    });
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window))
    throw Error("Push requiere HTTPS y un navegador compatible.");
  if ((await Notification.requestPermission()) !== "granted")
    throw Error("Permiso de notificaciones denegado.");
  await navigator.serviceWorker.register("/dispatch-sw.js");
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: Uint8Array.from(
        atob(key.replace(/-/g, "+").replace(/_/g, "/")),
        (c) => c.charCodeAt(0),
      ),
    }));
  await api("push", sub.toJSON());
}
