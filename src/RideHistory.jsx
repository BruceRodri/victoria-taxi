import { useState } from "react";
import { Star, History, Search, ChevronDown, MapPin } from "lucide-react";
import RideMap from "./RideMap";
import { money } from "./FareTicket";
export const statusLabel = (s, en) =>
  ({
    waiting: ["Buscando conductor", "Finding a driver"],
    accepted: ["En camino a recogerte", "On the way to pickup"],
    arrived: ["En el punto de recogida", "At pickup"],
    in_progress: ["Viaje en curso", "Ride in progress"],
    completed: ["Finalizado", "Completed"],
    cancelled: ["Cancelado", "Cancelled"],
  })[s]?.[en ? 1 : 0] || s;
export function rideStatus(r,en){
  if(r.status!=="cancelled")return statusLabel(r.status,en);
  const role=r.cancelledRole || (r.cancelledBy===r.driverName?"driver":r.cancelledBy===r.passengerName?"passenger":null);
  if(!role)return statusLabel(r.status,en);
  return role==="driver"?(en?"Cancelled by driver":"Cancelado por el conductor"):(en?"Cancelled by passenger":"Cancelado por el pasajero");
}
export function TripPeople({r,en}){
  return <span className="vt-trip-people">{[[en?"Passenger":"Pasajero",r.passengerName],[en?"Driver":"Conductor",r.driverName],[en?"Vehicle":"Vehículo",r.vehicle]].map(([label,value])=><span key={label}><small>{label}</small><strong>{value||(en?"Unassigned":"Sin asignar")}</strong></span>)}</span>;
}
export function RouteList({ r, en }) {
  return (
    <ol className="dispatch-stops">
      {[
        { destination: r.origin },
        ...(r.segments?.length ? r.segments : [{ destination: r.destination }]),
      ].map((s, i) => (
        <li key={i}>
          <i />
          <span>
            <small>
              {i === 0
                ? en
                  ? "Pickup"
                  : "Recogida"
                : i === (r.segments?.length || 1)
                  ? en
                    ? "Destination"
                    : "Destino"
                  : (en ? "Stop" : "Parada") + " " + i}
            </small>
            <strong>{s.destination}</strong>
          </span>
        </li>
      ))}
    </ol>
  );
}
function Record({ r, me, en, run,initialOpen }) {
  const [open, setOpen] = useState(!!initialOpen),
    [stars, rate] = useState(0),
    [comment, setComment] = useState(""),
    [help, setHelp] = useState("");
  return (
    <article className="record">
      <button
        className="record-head"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <MapPin size={20} />
        <span>
          <strong>{r.destination}</strong>
          <small>
            {new Date(r.created).toLocaleDateString(en ? "en-US" : "es-US")} ·{" "}
            {rideStatus(r,en)}
          </small>
        </span>
        {me.role==="admin"&&<TripPeople r={r} en={en}/>}
        <b>{money(r.fare)}</b>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="record-body">
          <RouteList r={r} en={en} />
          {me.role!=="admin"&&<TripPeople r={r} en={en}/>}
          <p>
            {r.distance} mi · {r.minutes} min ·{" "}
            {en ? "Cash estimate" : "Estimación en efectivo"}
          </p>
          {r.trail?.length > 1 && (
            <p>{en ? "Recorded GPS track" : "Recorrido registrado por GPS"}</p>
          )}
          <RideMap
            ride={r.trail?.length > 1 ? { ...r, path: r.trail } : r}
            lang={en ? "en" : "es"}
          />
          {r.reason && (
            <p>
              <strong>{rideStatus(r,en)}</strong><br/>{r.cancelledBy} · {r.reason}<br/>{r.ended && new Date(r.ended).toLocaleString(en?"en-US":"es-US")} {r.cancelledStage && " · "+statusLabel(r.cancelledStage,en)}
            </p>
          )}
          {me.role==="admin" && r.status==="completed" && !r.review && <p>{en?"No passenger review yet.":"El pasajero aún no ha dejado una reseña."}</p>}
          {r.review ? (
            <p>
              <strong>{en?"Ride rating":"Puntuación del viaje"}</strong> · {r.review.stars>0?"★ "+r.review.stars+"/5":(en?"Not rated":"Sin puntuación")}<br/>
              <strong>{en?"Passenger comment":"Comentario del pasajero"}</strong> · {r.review.comment||(en?"No comment":"Sin comentario")}
            </p>
          ) : (
            me.role === "passenger" &&
            r.status === "completed" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run("review", { id: r.id, stars, comment });
                }}
              >
                <h3>{en ? "Rate this ride" : "¿Cómo estuvo tu viaje?"}</h3>
                <div className="stars">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      type="button"
                      key={n}
                      aria-pressed={n === stars}
                      aria-label={n + "/5"}
                      onClick={() => rate(n)}
                    >
                      <Star fill={n <= stars ? "currentColor" : "none"} />
                    </button>
                  ))}
                </div>
                <textarea
                  maxLength={1000}
                  aria-label={en ? "Review" : "Reseña"}
                  placeholder={en ? "Optional review" : "Tu reseña (opcional)"}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <button disabled={!stars&&!comment.trim()} className="outline">
                  {en ? "Submit review" : "Publicar reseña"}
                </button>
              </form>
            )
          )}
          {r.help?.map((h, i) => (
            <p key={i}>
              {h.from} · {h.text}
            </p>
          ))}
          {me.role !== "admin" && (
            <details>
              <summary>
                {en ? "Report a problem" : "Reportar un problema"}
              </summary>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await run("help", { id: r.id, message: help }))
                    setHelp("");
                }}
              >
                <textarea
                  required
                  maxLength={1000}
                  aria-label={
                    en ? "Describe the problem" : "Describe el problema"
                  }
                  value={help}
                  onChange={(e) => setHelp(e.target.value)}
                />
                <button className="outline">
                  {en ? "Send to dispatch" : "Enviar a administración"}
                </button>
              </form>
            </details>
          )}
        </div>
      )}
    </article>
  );
}
export function HistoryList({ trips, me, en, run,focusId,registerView=false,initialStatus="" }) {
  const [query, find] = useState(""),
    [status, filter] = useState(initialStatus),
    [day, date] = useState(""),
    [driver, setDriver] = useState(""),
    [endDay, setEndDay] = useState("");
  const list = trips.filter(
    (r) =>
      (me.role === "admin" || ["completed", "cancelled"].includes(r.status)) &&
      (!status || (status==="live"?!["completed","cancelled"].includes(r.status):r.status===status)) &&
      (!driver || (r.driverName || "").toLowerCase().includes(driver.trim().toLowerCase())) &&
      (!day || new Intl.DateTimeFormat("sv-SE", { timeZone: "America/New_York" }).format(r.created) >= day) &&
      (!endDay || new Intl.DateTimeFormat("sv-SE", { timeZone: "America/New_York" }).format(r.created) <= endDay) &&
      [r.driverName, r.passengerName, r.origin, r.destination,...(r.segments||[]).map(s=>s.destination), r.vehicle]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <section className="panel dispatch-history">
      {registerView?<section className="register-toolbar" aria-label={en?"Trip filters":"Filtros de viajes"}>
        <label className="register-search"><Search size={19}/><input aria-label={en?"Search passenger or address":"Buscar pasajero o dirección"} placeholder={en?"Search passenger or address…":"Buscar pasajero o dirección…"} value={query} onChange={e=>find(e.target.value)}/></label>
        <div className="register-controls">
          <label>{en?"Driver":"Conductor"}<input placeholder={en?"All drivers":"Todos los conductores"} value={driver} onChange={e=>setDriver(e.target.value)}/></label>
          <label>{en?"Trip status":"Estado del viaje"}<select value={status} onChange={e=>filter(e.target.value)}><option value="">{en?"All statuses":"Todos los estados"}</option><option value="live">{en?"All active rides":"Todos los activos"}</option>{["waiting","accepted","arrived","in_progress","completed","cancelled"].map(k=><option key={k} value={k}>{statusLabel(k,en)}</option>)}</select></label>
          <label>{en?"From":"Desde"}<input aria-label={en?"Start date (New Jersey)":"Desde (Nueva Jersey)"} type="date" max={endDay||undefined} value={day} onChange={e=>date(e.target.value)}/></label>
          <label>{en?"To":"Hasta"}<input aria-label={en?"End date (New Jersey)":"Hasta (Nueva Jersey)"} type="date" min={day||undefined} value={endDay} onChange={e=>setEndDay(e.target.value)}/></label>
        </div>
        <div className="register-count"><strong>{list.length} {en?"rides":"viajes"}</strong>{(query||driver||status||day||endDay)&&<button type="button" onClick={()=>{find("");setDriver("");filter("");date("");setEndDay("");}}>{en?"Clear filters":"Limpiar filtros"}</button>}</div>
      </section>:<>
      <div className="panel-title">
        <History />
        <h2>{en ? "Ride history" : "Historial de viajes"}</h2>
      </div>
      <details className="vt-filters"><summary>{en?"Filter trips":"Filtrar viajes"}</summary><div className="history-filters">
        {me.role === "admin" && <label>{en ? "Driver name" : "Nombre del conductor"}<input value={driver} onChange={(e) => setDriver(e.target.value)} placeholder={en ? "Search driver" : "Buscar conductor"} /></label>}
        <label>
          <Search size={15} />
          {en ? "Search" : "Buscar"}
          <input
            value={query}
            onChange={(e) => find(e.target.value)}
            placeholder={en ? "Name or address" : "Nombre o dirección"}
          />
        </label>
        <label>
          {en ? "Status" : "Estado"}
          <select value={status} onChange={(e) => filter(e.target.value)}>
            <option value="">{en ? "All" : "Todos"}</option>
            {(me.role === "admin"
              ? [
                  "waiting",
                  "accepted",
                  "arrived",
                  "in_progress",
                  "completed",
                  "cancelled",
                ]
              : ["completed", "cancelled"]
            ).map((s) => (
              <option key={s} value={s}>
                {statusLabel(s, en)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {en ? "From date (New Jersey)" : "Desde (fecha de Nueva Jersey)"}
          <input
            type="date"
            value={day}
            onChange={(e) => date(e.target.value)}
          />
        </label>
        <label>{en ? "To date (New Jersey)" : "Hasta (fecha de Nueva Jersey)"}<input type="date" min={day || undefined} value={endDay} onChange={(e) => setEndDay(e.target.value)} /></label>
        {(driver||query||status||day||endDay)&&<button type="button" className="outline" onClick={()=>{setDriver("");find("");filter("");date("");setEndDay("");}}>{en?"Clear filters":"Limpiar filtros"}</button>}
      </div>
      </details><small>{list.length} {en?"rides":"viajes"}</small></>}
      {list.length ? (
        [...list].sort((a,b)=>Number(b.id===focusId)-Number(a.id===focusId)).map((r) => <Record initialOpen={r.id===focusId} key={r.id} r={r} me={me} en={en} run={run} />)
      ) : (
        <p className="list-empty">
          {en ? "No matching rides." : "No hay viajes que coincidan."}
        </p>
      )}
    </section>
  );
}
