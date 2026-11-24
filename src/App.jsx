import { useMapAddresses } from "./useMapAddresses";
import { Overview, DriverReview } from "./Admin";
import { DriverForm } from "./DriverForm";
import { nativeMobile, ShiftStatus, useDriverShift } from "./DriverShift";
import AddressField from "./AddressField";
import { useDrivingRoute } from "./routing";
import { FareTicket, priceRide, money } from "./FareTicket";
import RideMap from "./RideMap.jsx";
import { useState, useEffect } from "react";

import "./index.css";

import { Profiles } from "./Profiles";
import { Header, Sidebar } from "./Shell";
import { profiles, airportRide, loadDemo, storageKey, demoData } from "./demo";
import { words } from "./words";


const TripCard = ({ item, actions, t, drivers }) => (
  <div className="trip-card">
    <div className="row">
      <span className={"pill " + item.status}>{t[item.status]}</span>
      <strong>{money(item.fare)}</strong>
    </div>
    <div className="route-line">
      <span>●</span>
      <div>
        <b>{item.origin}</b>
        <small>{t.origin}</small>
      </div>
    </div>
    <div className="route-line end">
      <span>◆</span>
      <div>
        <b>{item.destination}</b>
        <small>{t.destination}</small>
      </div>
    </div>
    {item.passengerName && (
      <p className="people">
        {t.passenger}: {item.passengerName}
        {item.driverId &&
          " · " +
            t.driver +
            ": " +
            (drivers.find((d) => d.id === item.driverId)?.name || "—")}
      </p>
    )}
    <div className="trip-meta">
      {item.distance} mi · {item.minutes} min · {t.cash}
    </div>
    {actions}
  </div>
);

export default function App() {
  const [lang, setLang] = useState("es"),
    [role, setRole] = useState(""),
    [tab, setTab] = useState("overview");
  const [data, setData] = useState(loadDemo);
  const [driverId, setDriverId] = useState("demo-diego");
  const en = lang === "en";
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  function enter(nextRole, id = "demo-diego") {
    shift.stop();
    setDriverId(id);
    setRole(nextRole);
    setTab("overview");
    setMsg("");
    setFeedback("");
    window.scrollTo(0, 0);
  }
  const [form, setForm] = useState({origin:"",destination:"",originPoint:null,destinationPoint:null});
  const [rates, setRates] = useState(data.rates),
    [msg, setMsg] = useState(""),
    [demoOnline, setOnline] = useState(true),
    [feedback, setFeedback] = useState("");
  const t = words[lang];
  const update = (next) => {
    localStorage.setItem(storageKey, JSON.stringify(next));
    setData(next);
  };
  const driver = data.drivers.find((d) => d.id === driverId);
  const shift = useDriverShift(role === "driver" && driver?.status === "approved", en);
  const online = nativeMobile ? shift.phase === "active" : demoOnline;
  const profile =
    role === "driver" && driverId !== "demo-diego"
      ? {
          name: driver?.name || words[lang].register,
          initials: driver?.name.slice(0, 1) || "+",
        }
      : profiles[role];
  const trip = data.trips.find(
    (x) =>
      x.status === "waiting" ||
      (x.status === "accepted" &&
        (role !== "driver" || x.driverId === driverId)),
  );
  const { route, loading, error: routeError, retry } = useDrivingRoute(
    form.originPoint, form.destinationPoint, role === "passenger" && !trip
  );
  const quote = route && priceRide(route.distance, data.rates);
  const stateLabel = (s) =>
    ({
      waiting: t.waiting,
      accepted: t.accepted,
      completed: t.completed,
      cancelled: t.cancelled,
      pending: t.pending,
      approved: t.approved,
      rejected: t.rejected,
    })[s] || s;
  const mapAddresses = useMapAddresses(setForm, en);
  const pickStop = mapAddresses.select;
  function handleRequest(e) {
    e.preventDefault();
    if (
      !form.origin.trim() ||
      !form.destination.trim() ||
      !route || !quote
    ) {
      setFeedback(t.required);
      return;
    }
    update({
      ...data,
      trips: [
        {
          ...form,
          ...route,
          id: Date.now(),
          passengerName: profiles.passenger.name,
          fare: quote.total,
          status: "waiting",
          messages: [],
        },
        ...data.trips,
      ],
    });
    setFeedback("");
  }
  function changeTrip(id, patch) {
    update({
      ...data,
      trips: data.trips.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    });
  }
  function sendMsg(e) {
    e.preventDefault();
    if (!msg.trim() || !trip) return;
    changeTrip(trip.id, {
      messages: [...trip.messages, { from: role, text: msg.trim() }],
    });
    setMsg("");
  }
  const Chat = () => (
    <div className="chat">
      <div className="row">
        <h3>{t.chat}</h3>
      </div>
      <div className="messages">
        {trip.messages.map((m, i) => (
          <div key={i} className={"bubble " + (m.from === role ? "mine" : "")}>
            <small>
              {m.from === "driver" ? t.driverName : t.passengerName}
            </small>
            {m.text}
          </div>
        ))}
      </div>
      <form className="chat-input" onSubmit={sendMsg}>
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder={t.placeholder}
        />
        <button className="primary">{t.sendMessage}</button>
      </form>
    </div>
  );

  return (
    <>
      <Header
        en={en}
        toggleLang={() => setLang(en ? "es" : "en")}
        goHome={() => enter("")}
      />
      {!role ? (
        <Profiles
          perMile={data.rates.perMile}
          t={t}
          en={en}
          enter={enter}
          otherDrivers={data.drivers.filter((d) => d.id !== "demo-diego")}
          register={() => {
            enter("driver", null);
          }}
        />
      ) : (
        <main className={"workspace workspace-" + role}>
          <Sidebar
            t={t}
            role={role}
            profile={profile}
            tab={tab}
            en={en}
            navigate={(next) => {
              setTab(next);
              setFeedback("");
            }}
            changeProfile={() => enter("")}
          />
          <section className="content">
            <div className="content-head">
              {(role === "passenger" || role === "driver") && <span className="mob-greeting">{en ? "Hello" : "Hola"}, {profile?.name?.split(" ")[0]} <span>✦</span></span>}
              <h1>
                {role === "admin"
                  ? t[tab]
                  : role === "passenger"
                    ? trip
                      ? t.active
                      : t.route
                    : t.driver}
              </h1>
            </div>
            {role === "passenger" && (
              <div className="two-col booking-layout">
                <RideMap
                  lang={lang}
                  ride={trip || { ...form, ...route, path: route?.path }}
                  onPick={trip ? undefined : pickStop}
                />
                <div>
                  {trip ? (
                    <>
                      <TripCard
                        t={t}
                        drivers={data.drivers}
                        item={trip}
                        actions={
                          trip.status === "waiting" && (
                            <button
                              className="outline full"
                              onClick={() =>
                                changeTrip(trip.id, { status: "cancelled" })
                              }
                            >
                              {t.cancel}
                            </button>
                          )
                        }
                      />
                      {trip.status === "waiting" && (
                        <button
                          className="primary full"
                          onClick={() => enter("driver")}
                        >
                          {en ? "Continue as Diego" : "Continuar como Diego"} →
                        </button>
                      )}
                      {trip.status === "accepted" && <><button className="outline full" onClick={()=>changeTrip(trip.id,{status:"completed"})}>{en?"Finish trip":"Finalizar viaje"}</button>{Chat()}</>}
                    </>
                  ) : (
                    <form className="panel" onSubmit={handleRequest}>
                      <div className="panel-title">
                        <h2>{en ? "Trip details" : "Detalles del viaje"}</h2>
                      </div>
                      {["origin", "destination"].map(key => (
                        <AddressField key={key} en={en} label={t[key]} value={form[key]}
                          confirmed={Boolean(form[key + "Point"])}
                          onEdit={(value, preserve) => mapAddresses.edit(key,value,preserve)}
                          mapStatus={mapAddresses.status[key]} onManual={value=>mapAddresses.acceptManual(key,value)}
                          onSelect={(name, point) => pickStop(key, point, name)} />
                      ))}
                      {route ? <>
                        
                        <FareTicket fare={quote} en={en} />
                      </> : <div className="route-notice" role="status">
                        {loading ? (en ? "Calculating driving route…" : "Calculando la ruta por carretera…") :
                          routeError ? (en ? "Could not calculate a driving route. Check both stops or retry." : "No se pudo calcular una ruta en auto. Revisa las paradas o reintenta.") :
                          (en ? "Confirm both stops to see the mileage and fare." : "Confirma las dos paradas para ver las millas y el precio.")}
                        {routeError && <button type="button" className="outline" onClick={retry}>{en ? "Retry" : "Reintentar"}</button>}
                      </div>}
                      {feedback && <p className="error">{feedback}</p>}
                      <button className="primary full" disabled={!route}>
                        {t.request} <span>↗</span>
                      </button>
                    </form>
                  )}
                </div>

              </div>
            )}
            {role === "driver" && (
              <div className="driver-layout"><div className="driver-welcome"><span className="driver-welcome-icon">✦</span><div><strong>{en ? "Ready for the road?" : "¿Listo para el camino?"}</strong><p>{en ? "Your next trip starts here." : "Tu próximo viaje empieza aquí."}</p></div></div>
                {!driver ? (
                  <DriverForm en={en} onSubmit={async details => {
                    const id = Date.now();
                    update({...data,drivers:[...data.drivers,{...details,id,status:"pending",vehicle:details.brand+" "+details.model+" · "+details.color+" · "+details.plate,license:""}]});
                    setDriverId(id);
                  }} />
                ) : (
                  <>
                    <div className="status-banner">
                      <div>
                        <span className="side-label">{driver.name}</span>
                        <h2>{stateLabel(driver.status)}</h2>
                      </div>
                      <span className="status-dot">●</span>
                    </div>
                    {driver.status === "rejected" && driver.rejectionReason && <div className="reason-box" role="status"><strong>{en ? "Reason for rejection" : "Motivo del rechazo"}</strong><p>{driver.rejectionReason}</p></div>}
                    {driver.status === "approved" && (
                      <>
                        <div className="row section-heading">
                          <div>
                            <h2>{t.available}</h2>
                          </div>
                          <button
                            className={"toggle " + (online ? "on" : "")}
                            onClick={() => nativeMobile ? shift.toggle() : setOnline(!online)}
                          >
                            <span /> {nativeMobile ? (shift.enabled ? (en ? "End shift" : "Terminar turno") : (en ? "Start shift" : "Iniciar turno")) : online ? t.online : t.offline}
                          </button>
                        </div>
                        {nativeMobile ? <><p className="route-notice">{en ? "Single-device demo. For requests from the PC, scan its QR and choose Connect as Diego." : "Este perfil es la demo individual. Para ver las solicitudes de la PC, escanea su QR y pulsa Conectar como Diego."}</p><ShiftStatus shift={shift} en={en}/></> : <p className="muted">{t.near}</p>}
                        {trip &&
                          (online || trip.status === "accepted") &&
                          (trip.originPoint || trip.destinationPoint) && (
                            <RideMap lang={lang} ride={trip} driverPoint={shift.fix?.point} />
                          )}
                        {trip && trip.status === "accepted" ? (
                          <>
                            <TripCard
                              t={t}
                              drivers={data.drivers}
                              item={trip}
                              actions={
                                <button
                                  className="primary full"
                                  disabled={!shift.fix || !trip.destinationPoint || Math.hypot((shift.fix.point[0]-trip.destinationPoint[0])*111320,(shift.fix.point[1]-trip.destinationPoint[1])*111320*Math.cos(trip.destinationPoint[0]*Math.PI/180))>100 || Date.now()-shift.fix.time>120000}
                                  onClick={() => { changeTrip(trip.id, {status:"completed"}); setFeedback("completed"); }}
                                >
                                  {t.finish} ↗
                                </button>
                              }
                            />
                            {Chat()}
                          </>
                        ) : trip && online ? (
                          <TripCard
                            t={t}
                            drivers={data.drivers}
                            item={trip}
                            actions={
                              <button
                                className="primary full"
                                onClick={() =>
                                  changeTrip(trip.id, {
                                    status: "accepted",
                                    driverId: driver.id,
                                  })
                                }
                              >
                                {t.accept} ↗
                              </button>
                            }
                          />
                        ) : (
                          <div className="empty">
                            {feedback === "completed"
                              ? t.completed
                              : online
                                ? t.none
                                : t.offline}
                            <button
                              className="outline"
                              onClick={() =>
                                feedback === "completed" && !nativeMobile
                                  ? enter("admin")
                                  : enter("passenger")
                              }
                            >
                              {feedback === "completed"
                                ? en
                                  ? "See ride in dashboard"
                                  : "Ver viaje en el panel"
                                : en
                                  ? "Open passenger profile"
                                  : "Abrir perfil de pasajero"}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            )}
            {role === "admin" && (
              <>
                <p className="admin-notice">ⓘ {t.adminNotice}</p>
                {tab === "overview" && <Overview data={data} en={en} t={t} TripCard={TripCard} navigate={setTab}/>}
                {tab === "drivers" && <DriverReview data={data} en={en} update={update}/>}
                {tab === "trips" && (
                  <div className="panel">
                    <div className="panel-title">
                      <h2>{t.allTrips}</h2>
                    </div>
                    {data.trips.length ? (
                      data.trips.map((x) => (
                        <TripCard
                          t={t}
                          drivers={data.drivers}
                          key={x.id}
                          item={x}
                        />
                      ))
                    ) : (
                      <div className="empty">{t.noTrips}</div>
                    )}
                  </div>
                )}
                {tab === "rates" && (
                  <form
                    className="panel rate-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      update({ ...data, rates });
                      setFeedback(t.saved);
                    }}
                  >
                    <div className="panel-title">
                      <h2>{en ? "Set the fare" : "Configurar la tarifa"}</h2>
                    </div>
                    <p className="muted">{t.ratesNote}</p>
                    {Object.keys(rates).map((x) => (
                      <label key={x}>
                        {t[x]}
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={rates[x]}
                          onChange={(e) =>
                            setRates({ ...rates, [x]: e.target.value })
                          }
                        />
                      </label>
                    ))}
                    <FareTicket fare={priceRide(airportRide.distance, rates)} en={en} preview />
                    {feedback && <p role="status">{feedback}</p>}
                    <button className="primary">{t.save} ↗</button>
                  </form>
                )}
                {tab === "settings" && (
                  <div className="panel">
                    <h2>{t.service}</h2>
                    <p>{t.serviceHint}</p>
                    <button
                      className="outline"
                      onClick={() => {
                        if (confirm(t.confirm)) {
                          localStorage.removeItem("victoria-taxi-demo");
                          const fresh = demoData();
                          setData(fresh);
                          setRates(fresh.rates);
                          setForm({origin:"",destination:"",originPoint:null,destinationPoint:null});
                          setOnline(true);
                                        setFeedback("");
                        }
                      }}
                    >
                      {t.clear}
                    </button>
                  </div>
                )}
              </>
            )}
            <footer>{t.notice}</footer>
          </section>
        </main>
      )}
    </>
  );
}
