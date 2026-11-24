import { useEffect, useRef, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Geolocation } from "@capacitor/geolocation";

export const nativeMobile = Capacitor.isNativePlatform();
const tracker = registerPlugin("BackgroundGeolocation");
const alertId = 71001;

export function useDriverShift(eligible, en) {
  const [enabled, setEnabled] = useState(false);
  const [phase, setPhase] = useState("off");
  const [fix, setFix] = useState(null);
  const [notice, setNotice] = useState("");
  const language = useRef(en);
  useEffect(() => { language.current = en; }, [en]);

  useEffect(() => {
    if (!nativeMobile || !eligible || !enabled) return;
    let disposed = false;
    let watcherId;
    const english = language.current;
    const stopWatcher = async () => {
      if (watcherId != null) {
        const id = watcherId;
        watcherId = undefined;
        await tracker.removeWatcher({id});
      }
    };
    async function start() {
      try {
        if (Capacitor.getPlatform() === "android") {
          const permission = await LocalNotifications.requestPermissions();
          if (disposed) return;
          if (permission.display !== "granted") throw new Error("permission");
          const gps = await Geolocation.requestPermissions({permissions:["location"]});
          if (disposed) return;
          if (gps.location !== "granted" && gps.coarseLocation !== "granted") throw new Error("permission");
        }
        watcherId = await tracker.addWatcher({
          backgroundTitle: "Victoria-Taxi",
          backgroundMessage: english ? "Driver shift active. Open the app to go offline." : "Turno activo. Abre la app para desconectarte.",
          requestPermissions:true, stale:false, distanceFilter:20
        }, (location, error) => {
          if (disposed) return;
          if (error) {
            setPhase(error.code === "NOT_AUTHORIZED" ? "permission" : "error");
            setFix(null);
            setEnabled(false);
            return;
          }
          if (location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)) {
            setFix({point:[location.latitude,location.longitude],time:location.time ?? Date.now()});
            setPhase("active");
          }
        });
        if (disposed) await stopWatcher();
      } catch (error) {
        if (!disposed) {
          setPhase(error.message === "permission" || error.code === "OS-PLUG-GLOC-0003" ? "permission" : "error");
          setEnabled(false);
        }
      }
    }
    start();
    return () => {
      disposed = true;
      void stopWatcher().catch(() => setPhase("error"));
      void LocalNotifications.cancel({notifications:[{id:alertId}]}).catch(() => {});
    };
  }, [eligible, enabled]);

  function stop() {
    setEnabled(false);
    setPhase("off");
    setFix(null);
    setNotice("");
  }
  function toggle() {
    if (enabled) { stop(); return; }
    setPhase("starting");
    setNotice("");
    setEnabled(true);
  }
  async function testAlert() {
    try {
      const p = await LocalNotifications.requestPermissions();
      if (p.display !== "granted") { setNotice("permission"); return; }
      await LocalNotifications.schedule({notifications:[{
        id:alertId, isExactNotification:false, title:"Victoria-Taxi",
        body:en ? "Test alert for your driver shift." : "Aviso de prueba de tu turno de conductor.",
        schedule:{at:new Date(Date.now()+20000),allowWhileIdle:true}
      }]});
      setNotice("scheduled");
    } catch { setNotice("error"); }
  }
  return {enabled, phase, fix, notice, stop, toggle, testAlert};
}

export function ShiftStatus({shift, en, showTest = true}) {
  const words = en ? {
    off:"Going online enables location during your shift, even with the screen locked.",
    starting:"Waiting for a location fix…", active:"Last GPS update",
    permission:"Check location and notification permissions in Settings.",
    error:"Location unavailable. Check GPS and try again.", test:"Test a background alert",
    scheduled:"Test scheduled. Lock the screen. The system may delay delivery."
  } : {
    off:"Al ponerte disponible se activa la ubicación durante el turno, incluso con la pantalla bloqueada.",
    starting:"Esperando la primera ubicación…", active:"Última ubicación GPS",
    permission:"Revisa los permisos de ubicación y notificaciones en Ajustes.",
    error:"Ubicación no disponible. Revisa el GPS y reintenta.", test:"Probar aviso en segundo plano",
    scheduled:"Prueba programada. Bloquea la pantalla. El sistema puede retrasar el aviso."
  };
  return <section className="shift-status"><p role="status">{words[shift.phase]} {shift.fix && new Date(shift.fix.time).toLocaleTimeString(en?"en-US":"es-US")}</p>
    {shift.enabled && showTest && <button className="outline" onClick={shift.testAlert}>{words.test}</button>}
    {shift.notice && <p role="status">{words[shift.notice]}</p>}
  </section>;
}

