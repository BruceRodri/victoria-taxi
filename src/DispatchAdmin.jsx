import { useEffect, useState } from "react";
import { DriverForm, DriverDocuments } from "./DriverForm";
import {VehicleEditor} from "./AccountFeatures";
import {Activity, ArrowUpRight, CarFront, ChevronRight, ClipboardCheck, LayoutDashboard, MapPin, Route, SlidersHorizontal, UsersRound} from "lucide-react";
import "./operations.css";
import { HistoryList, rideStatus } from "./RideHistory";
import {PasswordInput} from "./TripScreens";
import { money } from "./FareTicket";
import { words } from "./words";
export function LoginFields({ en, credentials, set }) {
  return (
    <>
      <label>
        {en ? "Email" : "Correo electrónico"}
        <input
          type="email"
          required
          autoComplete="username"
          value={credentials.email}
          onChange={(e) => set({ ...credentials, email: e.target.value })}
        />
      </label>
      <label>
        {en ? "Password" : "Contraseña"}
        <PasswordInput en={en}
          minLength={10}
          required
          autoComplete="off"
          value={credentials.password}
          onChange={(e) => set({ ...credentials, password: e.target.value })}
        />
      </label>
    </>
  );
}
export default function DispatchAdmin({ data, en, api, run, reload }) {
  const [tab, setTab] = useState("overview"),
    [selected, select] = useState(""),
    [docs, setDocs] = useState(null),
    [err, error] = useState(""),
    [reason, setReason] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState(""),
    [add, setAdd] = useState(false),
    [credentials, setCreds] = useState({ email: "", password: "" });
  const [fileTab,filePage]=useState("documents"),[tripGroup,group]=useState("all"),[focusTrip,setFocusTrip]=useState(""),[sample,setSample]=useState("5");
  const [rates, setRates] = useState(data.rates);
  const t = words[en ? "en" : "es"],
    d = data.drivers.find((x) => x.id === selected);
  useEffect(() => {
    let alive = true;
    setDocs(null);
    error("");
    setReason("");
    if (selected)
      api("documents/" + selected)
        .then((v) => {
          if (alive) setDocs(v);
        })
        .catch((e) => {
          if (alive) error(e.message);
        });
    return () => {
      alive = false;
    };
  }, [selected, api]);
  const labels = {
    pending: en ? "Pending" : "Pendiente",
    approved: en ? "Approved" : "Aprobado",
    rejected: en ? "Rejected" : "Rechazado",
  };
  const filtered = data.drivers.filter(
    (x) =>
      (!filter || x.status === filter) &&
      [x.name, x.plate, x.vehicle]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const tr=(es,english)=>en?english:es;
  const [now,tick]=useState(Date.now);
  useEffect(()=>{const timer=setInterval(()=>tick(Date.now()),15000);return ()=>clearInterval(timer);},[]);
  const attention=data.trips.filter(r=>r.status==="waiting" && now-r.created>=300000 || ["accepted","in_progress"].includes(r.status) && r.driverFixTime && now-r.driverFixTime>=120000);
  const pending=data.drivers.filter(x=>x.status==="pending");
  const live=r=>!["cancelled","completed"].includes(r.status);
  const ids=[["overview",LayoutDashboard,tr("Resumen","Overview")],["trips",Route,tr("Viajes","Trips")],["drivers",UsersRound,tr("Conductores","Drivers")],["rates",SlidersHorizontal,tr("Tarifas","Fares")]];
  function go(page){setTab(page);select("");setFocusTrip("");group("all");setFilter("");setQuery("");setAdd(false);}
  function openFile(id){filePage("documents");select(id);}
  return (
    <div className="ops-shell"><nav className="ops-nav" aria-label={tr("Administración","Administration")}>{ids.map(([key,Icon,label])=><button key={key} aria-current={tab===key?"page":undefined} onClick={()=>go(key)}><Icon size={18}/>{label}{key==="drivers"&&pending.length>0&&<b>{pending.length}</b>}</button>)}</nav>
    <div className="ops-work">
    {tab==="overview"&&<>
      <div className="ops-cover"><div><small>New Jersey</small><h2>{tr("Resumen de operaciones","Operations overview")}</h2><time>{new Intl.DateTimeFormat(en?"en-US":"es-US",{weekday:"long",day:"numeric",month:"long",timeZone:"America/New_York"}).format(new Date())}</time></div></div>
      <div className="ops-metrics">{[[Activity,tr("Viajes activos","Active trips"),data.trips.filter(live).length,()=>{go("trips");group("live");}],[ClipboardCheck,tr("Solicitudes pendientes","Pending applications"),pending.length,()=>{go("drivers");setFilter("pending");}],[CarFront,tr("Conductores aprobados","Approved drivers"),data.drivers.filter(x=>x.status==="approved").length,()=>{go("drivers");setFilter("approved");}]].map(([Icon,label,n,action])=><button key={label} onClick={action}><Icon size={20}/><strong>{n}</strong><span>{label}</span><ArrowUpRight size={15}/></button>)}</div>
      {attention.length>0 && <section className="ops-attention"><h2>{tr("Requieren atención","Needs attention")} <small>{attention.length}</small></h2>{attention.map(r=><button key={r.id} onClick={()=>{go("trips");setFocusTrip(r.id);}}><span><strong>{r.status==="waiting"?tr("Esperando conductor","Waiting for driver"):tr("Sin actualización GPS","No GPS update")} · {Math.floor((now-(r.status==="waiting"?r.created:r.driverFixTime))/60000)} min</strong><small>{r.passengerName} · {r.origin}</small></span><ChevronRight size={17}/></button>)}</section>}
      <section className="ops-recent"><div className="row"><h2>{tr("Últimos viajes","Recent trips")}</h2><button className="outline" onClick={()=>go("trips")}>{tr("Ver todos","View all")}</button></div>
      <div className="recent-deck">{data.trips.slice(0,5).map(r=><button className="recent-journey" key={r.id} onClick={()=>{go("trips");setFocusTrip(r.id);}}>
        <span className="journey-caption"><time>{new Date(r.created).toLocaleString(en?"en-US":"es-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/New_York"})}</time><em className={"journey-status "+r.status}>{rideStatus(r,en)}</em></span>
        <span className="journey-endpoints"><span>{r.origin}</span><strong>{r.destination}</strong></span>
        <span className="journey-foot"><span className="journey-people">
          <span><small>{tr("Pasajero","Passenger")}</small><strong>{r.passengerName||tr("Sin registrar","Not recorded")}</strong></span>
          <span><small>{tr("Conductor","Driver")}</small><strong>{r.driverName||tr("Sin asignar","Unassigned")}</strong></span>
        </span><b>{money(r.fare)}</b><ChevronRight size={16}/></span>
      </button>)}</div>{!data.trips.length&&<p>{tr("Aún no hay viajes registrados.","No trips recorded yet.")}</p>}</section>
    </>}
    {tab==="trips"&&<section className="ops-trip-register"><h2 className="ops-title">{tr("Registro de viajes","Trip register")}</h2><HistoryList registerView initialStatus={tripGroup==="live"?"live":""} focusId={focusTrip} trips={data.trips} me={data.me} en={en} run={run}/></section>}
      {tab === "rates" && (
        <form
          className="panel ops-rates"
          onSubmit={(e) => {
            e.preventDefault();
            run("rates", {
              rates: Object.fromEntries(
                Object.entries(rates).map(([k, v]) => [k, Number(v)]),
              ),
            });
          }}
        >
          <h2>{t.rates}</h2>
          {Object.keys(rates).map((k) => (
            <label key={k}>
              {t[k]}
              <input
                type="number"
                required
                step=".01"
                min="0"
                max="10000"
                value={rates[k]}
                onChange={(e) => setRates({ ...rates, [k]: e.target.value })}
              />
            </label>
          ))}
          <section className="ops-preview"><small>{tr("Vista previa de la tarifa","Fare preview")}</small><label>{tr("Distancia del viaje (mi)","Trip distance (mi)")}<input type="number" min="0" step="any" value={sample} onChange={e=>setSample(e.target.value)}/></label><strong>{money(Number(rates.perMile)*Math.max(0,Number(sample))+Number(rates.weather)+Number(rates.traffic))}</strong><span>{tr("Importe estimado en efectivo","Estimated cash fare")}</span></section>
          <button className="primary">{t.save}</button>
        </form>
      )}
      {tab === "drivers" && (
        <section className="panel ops-drivers">
          <div className="row">
            <h2>{t.drivers}</h2>
            <button className="outline" onClick={() => setAdd(!add)}>
              {add ? (en ? "Close" : "Cerrar") : t.register}
            </button>
          </div>
          {add && (
            <>
              <DriverForm
                en={en}
                credentialsFields={<LoginFields en={en} credentials={credentials} set={setCreds} />}
                onSubmit={async (v) => {
                  await api("driver", { ...v, ...credentials });
                  setAdd(false);
                  setCreds({ email: "", password: "" });
                  await reload();
                }}
              />
            </>
          )}
          <div className="history-filters">
            <label>
              {en ? "Name or plate" : "Nombre o placa"}
              <input value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <label>
              {t.status}
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">{en ? "All" : "Todos"}</option>
                {Object.entries(labels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {filtered.map((x) => (
            <button
              key={x.id}
              className="driver-row"
              onClick={() => openFile(x.id)}
            >
              <span className="driver-avatar">{x.portrait?<img src={x.portrait} alt=""/>:x.name.split(" ").slice(0,2).map(n=>n[0]).join("")}</span>
              <span className="driver-identity">
                <strong>{x.name}</strong>
                <small>{x.vehicle}</small>
              </span>
              <span className={"review-pill " + x.status}>
                {labels[x.status]}
              </span><ChevronRight size={17}/>
            </button>
          ))}
          {!filtered.length && (
            <p>
              {en
                ? "No matching drivers."
                : "No hay conductores que coincidan."}
            </p>
          )}
          {d && (
            <div className="drawer-layer">
              <section
                className="driver-drawer"
                role="dialog"
                aria-modal="true"
              >
                <button className="outline" onClick={() => select("")}>
                  {en ? "Close" : "Cerrar"}
                </button>
                <h2>{d.name}</h2>
                <p>
                  {labels[d.status]} · {d.email}
                </p>
                <dl className="ops-vehicle-data">{[[tr("Marca","Make"),d.brand],[tr("Modelo","Model"),d.model],[tr("Color","Color"),d.color],[tr("Placa","Plate"),d.plate]].map(([label,v])=>v?<div key={label}><dt>{label}</dt><dd>{v}</dd></div>:null)}</dl>{!d.brand&&<p>{d.vehicle}</p>}
                <div className="ops-segments">{[["documents",tr("Solicitud","Application")],["vehicle",tr("Vehículo","Vehicle")],["history",tr("Viajes y reseñas","Trips & reviews")]].map(([key,label])=><button key={key} aria-pressed={fileTab===key} onClick={()=>filePage(key)}>{label}</button>)}</div>
                {fileTab==="vehicle"&&<VehicleEditor key={d.id} driver={d} en={en} api={api} reload={reload}/>}
                {fileTab==="history"&&<><h3>{en?"Ride history and reviews":"Historial de viajes y reseñas"}</h3>
                <HistoryList trips={data.trips.filter(r=>r.driverId===d.id)} me={data.me} en={en} run={run}/></>}
                {fileTab==="documents"&&<><h3>{en ? "Documents" : "Documentos"}</h3>
                {err ? (
                  <p role="alert">{err}</p>
                ) : docs ? (
                  Object.keys(docs).length ? (
                    <DriverDocuments
                      driver={{ documents: docs }}
                      en={en}
                      expanded
                    />
                  ) : (
                    <p>{en ? "No attachments" : "Sin archivos adjuntos"}</p>
                  )
                ) : (
                  <p>…</p>
                )}
                {d.rejectionReason && <p>{d.rejectionReason}</p>}
                <label>
                  {en ? "Reason for rejection" : "Motivo del rechazo"}
                  <textarea
                    maxLength={1000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <div className="actions">
                  {["rejected", "approved"].map((status) => (
                    <button
                      key={status}
                      className={status === "approved" ? "primary" : "outline"}
                      disabled={status === "rejected" && !reason.trim()}
                      onClick={async () => {
                        if (await run("decision", { id: d.id, status, reason }))
                          select("");
                      }}
                    >
                      {status === "approved" ? t.approve : t.reject}
                    </button>
                  ))}
                </div></>}
              </section>
            </div>
          )}
        </section>
      )}
    </div></div>
  );
}
