import { useCallback, useEffect, useRef, useState } from "react";

import { Capacitor, registerPlugin } from "@capacitor/core";
import {Chat,Inbox,Review} from "./TripScreens";
import { ChevronDown, Menu, PhoneCall, MessageCircle } from "lucide-react";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Geolocation } from "@capacitor/geolocation";

import {
  Banknote,
  CarFront,
  History,
  Navigation,
  MapPin,
  Radio,
  ArrowRight,
  Bell,
  UserRound,
  LayoutDashboard,
} from "lucide-react";

import { Header } from "./Shell";

import DispatchAdmin, { LoginFields } from "./DispatchAdmin";

import { HistoryList, RouteList, statusLabel } from "./RideHistory";

import RideCall from "./RideCall";

import { DriverForm } from "./DriverForm";
import {Profile,Resubmit} from "./AccountFeatures";

import { ShiftStatus, useDriverShift } from "./DriverShift";

import { request, native, enablePush, host } from "./dispatchClient";

import RideMap from "./RideMap";

import AddressField from "./AddressField";

import { useMapAddresses } from "./useMapAddresses";

import { useDrivingRoute } from "./routing";

import { FareTicket, money, priceRide } from "./FareTicket";

import { airportRide } from "./demo";

import "./dispatch.css";
import "./trip-screens.css";
import {PushNotifications} from "@capacitor/push-notifications";

const driverWindow=Capacitor.getPlatform()==="android"?registerPlugin("DriverWindow"):null;
const androidAlerts = Capacitor.getPlatform()==="android" ? registerPlugin("TripAlerts") : null;
function replyLabel(reply,en) {
  return reply==="outside" ? (en?"I'm outside":"Ya estoy afuera") : (en?"I'm coming out":"Estoy saliendo");
}
function Access({ demo, en, login, legacy }) {
  const [mode, setMode] = useState("login"),
    [role, setRole] = useState("passenger"),
    [name, setName] = useState(""),
    [credentials, setCreds] = useState({ email: "", password: "" }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);

  const tr = (es, eng) => (en ? eng : es);

  async function submit(endpoint, body) {
    if (busy) return;

    setBusy(true);

    setError("");

    try {
      const result = await request("", endpoint, body);

      if (typeof result?.token !== "string" || !result.token) throw Error(tr("La central no pudo confirmar tu sesión. Intenta ingresar con tu correo.", "The server could not confirm your session. Try signing in with your email."));
      login(result.token, endpoint === "register" && role === "driver");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="dispatch-access">
      <div className="access-cover">
        <span>
          <MapPin size={16} /> Newark · New Jersey
        </span>

        <h1>
          Victoria
          <br />
          <em>Taxi</em>
        </h1>
      </div>

      <section className="access-card">
        <nav className="dispatch-tabs">
          {["login", "register"].map((m) => (
            <button
              key={m}

              className={mode === m ? "selected" : ""}

              onClick={() => {
                setMode(m);

                setError("");
              }}
            >
              {m === "login"
                ? tr("Entrar", "Sign in")
                : tr("Crear cuenta", "Sign up")}
            </button>
          ))}
        </nav>

        {mode === "register" && (
          <div className="register-intro">
            <h2>{tr("Únete a Victoria Taxi", "Join Victoria Taxi")}</h2>

            <p>
              {tr(
                "¿Cómo quieres usar la aplicación?",
                "How would you like to use the app?",
              )}
            </p>

            <div
              className="register-roles"
              role="group"
              aria-label={tr("Tipo de cuenta", "Account type")}
            >
              {[
                [
                  "passenger",
                  UserRound,
                  tr("Pasajero", "Passenger"),
                  tr("Quiero solicitar viajes", "I want to request rides"),
                ],
                [
                  "driver",
                  CarFront,
                  tr("Conductor", "Driver"),
                  tr("Quiero conducir", "I want to drive"),
                ],
              ].map(([value, Icon, title, description]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={role === value}
                  onClick={() => {
                    setRole(value);
                    setError("");
                  }}
                >
                  <Icon size={21} />
                  <span>
                    <strong>{title}</strong>
                    <small>{description}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === "register" && role === "driver" ? (
          <DriverForm
            en={en}
            credentialsFields={
              <LoginFields en={en} credentials={credentials} set={setCreds} />
            }

            onSubmit={(v) => submit("register", { ...v, ...credentials, role })}
          />
        ) : (
          <form
            className="access-form"
            onSubmit={(e) => {
              e.preventDefault();

              submit(mode, { ...credentials, name, role });
            }}
          >
            <h2>
              {mode === "register"
                ? tr("Tus datos", "Your details")
                : tr("Bienvenido de nuevo", "Welcome back")}
            </h2>

            <p>
              {mode === "register"
                ? tr(
                    "Completa tus datos para empezar a viajar.",
                    "Enter your details to start riding.",
                  )
                : tr("Ingresa para continuar.", "Sign in to continue.")}
            </p>

            {mode === "register" && (
              <label>
                {tr("Nombre completo", "Full name")}
                <input
                  value={name}
                  required
                  maxLength={100}
                  autoComplete="name"
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            )}

            <LoginFields en={en} credentials={credentials} set={setCreds} />

            <button className="primary full" disabled={busy}>
              {mode === "register"
                ? tr("Crear cuenta de pasajero", "Create passenger account")
                : tr("Iniciar sesión", "Sign in")}{" "}
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {error && <p role="alert">{error}</p>}

        {demo && mode === "login" && (
          <section className="preview-profiles">
            <h2>{tr("Perfiles de prueba", "Test profiles")}</h2>

            {[
              [
                "passenger",

                "Sofía Reyes",

                tr("Pasajera", "Passenger"),

                UserRound,
              ],

              ["driver", "Diego Torres", tr("Conductor", "Driver"), CarFront],

              ...(native
                ? []
                : [
                    [
                      "admin",

                      "Valeria Cruz",

                      tr("Administración", "Administration"),

                      LayoutDashboard,
                    ],
                  ]),
            ].map(([role, name, label, Icon]) => (
              <button
                key={role}

                disabled={busy}

                onClick={() => submit("demo", { role })}
              >
                <i>
                  <Icon size={20} />
                </i>

                <span>
                  <strong>{name}</strong>

                  <small>{label}</small>
                </span>

                <ArrowRight size={16} />
              </button>
            ))}

            <button className="text-action" onClick={legacy}>
              {en ? "Previous local demo" : "Abrir demo local anterior"}
            </button>
          </section>
        )}
      </section>
    </main>
  );
}

function Booking({ data, en, run, busy, api, reload }) {
  const [form, setForm] = useState({origin:"",destination:"",originPoint:null,destinationPoint:null});
  const [pickupNote,setPickupNote]=useState("");
  const [editRequest,editMap]=useState(0);
  const [confirming, setConfirming] = useState(false);
  const [favoriteName,setFavoriteName]=useState("");
  const [favoriteError,setFavoriteError]=useState("");

  const pickupField = <label className="vt-meeting-field">
    {en ? "Pickup instructions (optional)" : "Referencia de recogida (opcional)"}
    <input maxLength={240} value={pickupNote} onChange={e=>setPickupNote(e.target.value)}
      placeholder={en ? "E.g. Market Street exit, by the clock" : "Ej. Salida de Market Street, junto al reloj"}/>
  </label>;
  const address = useMapAddresses(setForm, en);

  const { route, loading, error, retry } = useDrivingRoute(
    form.originPoint,

    form.destinationPoint,

    true, api,
  );

  const quote = route && priceRide(route.distance, data.rates);

  return (
    <div className="dispatch-grid">
      <RideMap
        lang={en ? "en" : "es"}

        picker pickupField={pickupField} editRequest={editRequest} ride={{ ...form, ...route }}

        onPick={(...args)=>{setConfirming(false);address.select(...args);}}
      />

      <form
        className="panel booking-sheet"

        onSubmit={(e) => {
          e.preventDefault();

          if (quote) setConfirming(true);
        }}
      >
        <span className="sheet-icon">
          <Navigation />
        </span>
        <h2>{en ? "Where to?" : "¿A dónde vamos?"}</h2>
        {["origin", "destination"].map((k) => (
          <AddressField
            key={k}

            en={en}

            label={
              k === "origin"
                ? en
                  ? "Pickup"
                  : "Recogida"
                : en
                  ? "Destination"
                  : "Destino"
            }

            value={form[k]}

            confirmed={!!form[k + "Point"]}

            onEdit={(v, p) => {setConfirming(false); address.edit(k, v, p);}}

            mapStatus={address.status[k]}

            onManual={(v) => address.acceptManual(k, v)}

            onSelect={(n, p) => {setConfirming(false); address.select(k, p, n);}}
          />
        ))}
        {data.me.favorites?.length>0 && <label>{en?"Saved places":"Lugares guardados"}<select defaultValue="" onChange={e=>{const place=data.me.favorites[Number(e.target.value)];if(place){setForm(f=>({...f,destination:place.name,destinationPoint:place.point}));setConfirming(false);}e.target.value="";}}><option value="">{en?"Choose a destination":"Elegir destino"}</option>{data.me.favorites.map((place,i)=><option key={i} value={i}>{place.label} · {place.name}</option>)}</select></label>}
        {form.destinationPoint && <details><summary>{en?"Save this destination":"Guardar este destino"}</summary><label>{en?"Place name":"Nombre del lugar"}<input maxLength={40} value={favoriteName} onChange={e=>setFavoriteName(e.target.value)} placeholder={en?"Home, work…":"Casa, trabajo…"}/></label><button type="button" className="outline" disabled={!favoriteName.trim()} onClick={async()=>{try{await api("favorites",{favorites:[...(data.me.favorites||[]),{label:favoriteName.trim(),name:form.destination,point:form.destinationPoint}]});await reload();setFavoriteName("");setFavoriteError("");}catch(e){setFavoriteError(e.message);}}}>{en?"Save place":"Guardar lugar"}</button>{favoriteError&&<p role="alert">{favoriteError}</p>}{data.me.favorites?.map((place,i)=><button type="button" className="text-action" key={i} onClick={async()=>{try{await api("favorites",{favorites:data.me.favorites.filter((_,index)=>index!==i)});await reload();}catch(e){setFavoriteError(e.message);}}}>{en?"Remove":"Eliminar"} {place.label}</button>)}</details>}
        {quote && <FareTicket en={en} fare={quote} />}{" "}
        {loading && (
          <p role="status">{en ? "Calculating route…" : "Calculando ruta…"}</p>
        )}
        {error==="point" && <button className="outline" type="button" onClick={()=>editMap(x=>x+1)}>{en?"Move point on map":"Mover el punto en el mapa"}</button>}
        {error && <p role="alert">{error==="point"?(en?"No driving route. Move the point on the map.":"Sin ruta en auto. Mueve el punto en el mapa."):error==="offline"?(en?"Offline. Your locations are saved.":"Sin conexión. Conservamos tus puntos."):(en?"Routing temporarily unavailable.":"El servicio de rutas no responde por el momento.")}</p>}
        {error && (
          <button className="outline" type="button" onClick={retry}>
            {en ? "Retry route" : "Reintentar ruta"}
          </button>
        )}
        {confirming && quote && <section className="route-notice" role="dialog" aria-label={en ? "Confirm trip" : "Confirmar viaje"}><h3>{en ? "Confirm your trip" : "Confirma tu viaje"}</h3><p>{en ? "Pickup" : "Recogida"}: <strong>{form.origin}</strong></p>{pickupField}<p>{en ? "Destination" : "Destino"}: <strong>{form.destination}</strong></p><p>{route.distance} mi · {route.minutes} min · {money(quote.total)}</p><button type="button" className="outline" onClick={()=>setConfirming(false)}>{en?"Edit":"Editar"}</button><button type="button" className="primary" disabled={busy} onClick={async()=>{if(await run("create",{...form,pickupNote,expectedTotal:quote.total}))setConfirming(false);}}>{en?"Confirm request":"Confirmar solicitud"}</button></section>}
        <button className="primary full" disabled={!quote || busy || confirming}>
          {en ? "Request ride" : "Solicitar viaje"} <ArrowRight size={17} />
        </button>
      </form>
    </div>
  );
}

function unreadMessages(ride,me){
  const received=ride.messages.filter(m=>m.senderId?m.senderId!==me.id:m.from!==me.name).length;
  return Math.max(0,received-Number(localStorage.getItem("vt-read-"+me.id+"-"+ride.id)||0));
}
function DriverMiniMap({ride,en,api}){
  const driving=ride.status==="in_progress";
  const stop=ride.segments?.[ride.stopsReached||0];
  const destination=driving?(stop?.destination||ride.destination):ride.origin;
  const destinationPoint=driving?(stop?.destinationPoint||ride.destinationPoint):ride.originPoint;
  const {route}=useDrivingRoute(ride.driverPoint,destinationPoint,Boolean(ride.driverPoint),api);
  return <div className="vt-mini-map"><RideMap approach driverPoint={ride.driverPoint} lang={en?"en":"es"} ride={{destination,destinationPoint,path:route?.path}}/>
    <strong>{driving?(en?"Next stop":"Siguiente parada"):(en?"Pickup":"Recogida")} · {destination}</strong></div>;
}

function ActiveRide({ r, me, en, run, openChat, busy, api }) {
  const passenger = me.role === "passenger",
    assigned = r.status !== "waiting";

  const [stop, setStop] = useState({ name: "", point: null }),
    [showStop, show] = useState(false),
    [reason, why] = useState(""),
    [cancel, setCancel] = useState(false),
    [reasonChoice, setReasonChoice] = useState("");

  const [pickStop,pickOnMap]=useState(false);
  const stopAddress=useMapAddresses(setStop,en);
  const unread=unreadMessages(r,me);
  const extra = useDrivingRoute(r.destinationPoint, stop.destinationPoint, showStop,api);
  const approaching=passenger && r.status==="accepted";
  const travelCard=passenger && assigned;
  const [expanded,setExpanded]=useState(false);
  const [now,tick]=useState(Date.now);
  useEffect(()=>{const timer=setInterval(()=>tick(Date.now()),5000);return ()=>clearInterval(timer);},[]);
  const age=r.driverFixTime?Math.max(0,Math.floor((now-r.driverFixTime)/1000)):null;
  const stale=age!==null && age>=120;
  const stopIndex=r.stopsReached||0;
  const next=r.segments?.[stopIndex];
  const intermediate=r.segments?.length>1 && stopIndex<r.segments.length-1;
  const arrival=useDrivingRoute(r.driverPoint,r.originPoint,approaching && !stale && !!r.driverPoint,api);
  const vehicle=(r.vehicle||"").split(" · ");
  const plate=vehicle.length>1?vehicle.pop():"";
  const [identity,setIdentity]=useState(null);
  useEffect(()=>{
    if(!travelCard || !r.driverId)return;
    let live=true;
    api("ride-vehicle/"+r.id).then(data=>{if(live)setIdentity(data);}).catch(()=>{});
    return ()=>{live=false;};
  },[travelCard,r.id,r.driverId,api]);
  const portrait=identity?.portrait || (r.driverId==="demo-driver"?"/demo-driver.webp":null);
  const driverName=r.driverName || (en?"Your driver":"Tu conductor");

  const total = extra.route
    ? Math.round((r.fare + extra.route.distance * r.rates.perMile) * 100) / 100
    : null;

  const tr = (es, eng) => (en ? eng : es);

  const nearEnd =
    !stale && r.driverPoint &&
    Math.hypot(
      (r.driverPoint[0] - r.destinationPoint[0]) * 111320,

      (r.driverPoint[1] - r.destinationPoint[1]) *
        111320 *
        Math.cos((r.destinationPoint[0] * Math.PI) / 180),
    ) <= 100;

  const action = (a, b = {}) => run(a, { ...b, id: r.id });

  const contactButtons=<div className="vt-contact-pair">
    <button type="button" onClick={()=>openChat(r.id)}><MessageCircle size={18}/>{tr("Mensajes","Messages")}{unread>0&&<b className="vt-unread" aria-live="polite">{unread}</b>}</button>
    <button type="button" onClick={()=>window.dispatchEvent(new CustomEvent("vt-place-call",{detail:r.id}))}><PhoneCall size={18}/>{tr("Llamar","Call")}</button>
  </div>;
  return (
    <div className={"dispatch-grid"+(travelCard?" vt-live-layout":"")}>
      <RideMap ride={approaching?{origin:r.origin,originPoint:r.originPoint,path:arrival.route?.path}:r} approach={approaching} driverPoint={r.driverPoint} lang={en ? "en" : "es"} />

      <section className={"panel booking-sheet"+(travelCard?" vt-driver-sheet":"")+(travelCard&&r.status==="arrived"?" vt-pickup-arrived":"")}>
        {travelCard && <>
          <div className="vt-live-head"><small><i/>{approaching?tr("Conductor en camino","Driver on the way"):statusLabel(r.status,en)}</small>
          <h2>{approaching?(arrival.route?(en?"Arriving in about ":"Llega en unos ")+arrival.route.minutes+" min":tr("Va a recogerte","On the way to you")):r.status==="arrived"?tr("Tu conductor llegó","Your driver is here"):tr("Viaje en curso","Ride in progress")}</h2>
          <p><MapPin size={15}/>{r.status==="in_progress"?r.destination:r.origin}</p></div>
          <div className="vt-driver-line"><span className="vt-driver-avatar">{portrait?<img src={portrait} alt={driverName}/>:driverName.split(/\s+/).slice(0,2).map(x=>x[0]).join("")}</span><div><strong>{driverName}</strong><small>{vehicle.join(" · ")}</small></div>{plate&&<b className="vt-plate">{plate}</b>}</div>
          {identity?.photo && <details className="vt-vehicle-photo"><summary>{tr("Ver foto del vehículo","View vehicle photo")}</summary><img alt={vehicle.join(" · ")} src={identity.photo}/></details>}
          {age!==null && <p className="vt-fix-age" role="status">{stale?tr("GPS sin actualizar · Última posición conocida","GPS delayed · Last known position"):tr("Ubicación actualizada","Location updated")} · {en?"":"hace "}{age<60?age+" s":Math.floor(age/60)+" min"}{en?" ago":""}</p>}
          {approaching && !stale && !arrival.route && <small className="vt-eta-note">{r.driverPoint?(arrival.error?tr("Tiempo de llegada no disponible","Arrival estimate unavailable"):tr("Calculando la llegada…","Estimating arrival…")):tr("Esperando la ubicación del conductor","Waiting for driver location")}</small>}
          {contactButtons}
          <button type="button" className="vt-expand" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?tr("Ocultar detalles","Hide details"):tr("Detalles y opciones del viaje","Ride details and options")}<ChevronDown size={17}/></button>
        </>}
        {!travelCard && <>
        <span className="dispatch-state">
          <Radio size={16} />

          {!passenger && !assigned
            ? tr("Solicitud cercana", "Nearby request")
            : statusLabel(r.status, en)}
        </span>

        <h2>
          {passenger
            ? r.driverName || tr("Buscando tu conductor", "Finding your driver")
            : r.passengerName}
        </h2>

        {r.vehicle && <p>{r.vehicle}</p>}

        <div className="trip-progress" aria-hidden="true">
          {["waiting", "accepted", "arrived", "in_progress"].map((k, i) => (
            <i
              key={k}

              className={
                i <=
                ["waiting", "accepted", "arrived", "in_progress"].indexOf(
                  r.status,
                )
                  ? "done"
                  : ""
              }
            />
          ))}
        </div>

        </>}
        {r.pickupNote && ["waiting","accepted","arrived"].includes(r.status) && (passenger || assigned) &&
          <section className="vt-meeting-card"><MapPin size={20}/><div>
            <small>{tr("Punto de encuentro","Meeting point")}</small><strong>{r.origin}</strong>
            <p>{r.pickupNote}</p></div></section>}
        {r.status==="arrived" && (passenger || assigned) && <section className="vt-arrival-card">
          <strong>{passenger ? tr("Avísale a tu conductor","Update your driver") : tr("Respuesta del pasajero","Passenger update")}</strong>
          {r.pickupReply && <p role="status">{passenger ? tr("Enviaste","You sent")+" · " : ""}{replyLabel(r.pickupReply,en)}</p>}
          {passenger && <div>{["outside","coming"].map(reply=><button type="button" key={reply}
            className="outline" aria-pressed={r.pickupReply===reply} disabled={busy || r.pickupReply===reply}
            onClick={()=>action("pickupReply",{reply})}>{replyLabel(reply,en)}</button>)}</div>}
          {!passenger && !r.pickupReply && <p>{tr("Esperando al pasajero","Waiting for the passenger")}</p>}
        </section>}
        {r.segments?.length>1 && <section className="vt-itinerary-update">
          <small>{tr("Parada añadida","Stop added")} · {r.segments.at(-1).destination}</small>
          <strong>{intermediate?tr("Siguiente parada","Next stop"):tr("Destino final","Final destination")} · {next?.destination}</strong>
          {intermediate && <span>{tr("Destino final","Final destination")} · {r.destination}</span>}
          <b>{tr("Total del viaje","Trip total")} · {money(r.fare)}</b>
          {!passenger && intermediate && r.status==="in_progress" && <button disabled={busy} className="outline" onClick={()=>action("reachStop",{index:stopIndex})}>{tr("Marcar parada alcanzada","Mark stop reached")}</button>}
        </section>}
        <div className="vt-trip-body" hidden={travelCard&&!expanded}>
        <RouteList r={r} en={en} />

        <div className="ride-estimate">
          <Banknote />

          <span>{tr("Estimación en efectivo", "Cash estimate")}</span>

          <b>{money(r.fare)}</b>
        </div>

        {!passenger && (
          <button
            className="primary full"

            disabled={busy || (r.status === "in_progress" && !nearEnd)}

            onClick={() =>
              action(
                {
                  waiting: "accept",

                  accepted: "arrive",

                  arrived: "start",

                  in_progress: "finish",
                }[r.status],
              )
            }
          >
            {
              {
                waiting: tr("Aceptar viaje", "Accept ride"),

                accepted: tr("He llegado", "I've arrived"),

                arrived: tr("Iniciar viaje", "Start ride"),

                in_progress: tr(
                  "Finalizar en el destino",

                  "Finish at destination",
                ),
              }[r.status]
            }
          </button>
        )}

        {!passenger && r.status === "waiting" && <><p>{en?"This offer is available for 60 seconds.":"Esta solicitud está disponible durante 60 segundos."}</p><button className="outline full" disabled={busy} onClick={()=>action("decline")}>{en?"Decline request":"Rechazar solicitud"}</button></>}
        {!passenger && r.status === "in_progress" && !nearEnd && (
          <small>
            {tr(
              "Se habilita a 100 m del destino con GPS reciente.",

              "Available within 100 m of the destination with a recent GPS fix.",
            )}
          </small>
        )}

        {passenger && assigned && (
          <>
            <button className="outline" onClick={() => show(!showStop)}>
              {tr("Añadir parada", "Add stop")}
            </button>

            {showStop && (
              <div>
                <AddressField en={en} label={tr("Nueva parada","New stop")} value={stop.destination||""}
                  confirmed={!!stop.destinationPoint} mapStatus={stopAddress.status.destination}
                  onManual={value=>stopAddress.acceptManual("destination",value)}
                  onEdit={(name,preserve)=>stopAddress.edit("destination",name,preserve)}
                  onSelect={(name,point)=>{pickOnMap(false);stopAddress.select("destination",point,name);}}/>
                <button className="outline" onClick={()=>pickOnMap(!pickStop)}><MapPin size={16}/>{pickStop?tr("Cerrar mapa","Close map"):tr("Elegir parada en el mapa","Choose stop on map")}</button>
                {pickStop && <RideMap picker singleStop ride={{origin:r.destination,originPoint:r.destinationPoint,destination:stop.destination,destinationPoint:stop.destinationPoint}} lang={en?"en":"es"}
                  onPick={(_,point,name)=>{stopAddress.select("destination",point,name);pickOnMap(false);}}/>}

                {extra.loading && <p>…</p>}

                {extra.error && (
                  <button className="outline" onClick={extra.retry}>
                    {tr("Reintentar ruta", "Retry route")}
                  </button>
                )}

                {total !== null && (
                  <>
                    <section className="stop-quote" aria-live="polite">
                      <div className="stop-place"><span><MapPin size={19}/></span><div><small>{tr("Nueva parada","New stop")}</small><strong>{stop.destination}</strong></div></div>
                      <dl><div><dt>{tr("Importe actual","Current fare")}</dt><dd>{money(r.fare)}</dd></div>
                      <div><dt>{tr("Tramo adicional","Additional leg")} <small>{extra.route.distance} mi</small></dt><dd>+{money(total-r.fare)}</dd></div>
                      <div className="stop-final"><dt>{tr("Total con la parada","Total with stop")}</dt><dd>{money(total)}</dd></div></dl>
                    </section>
                    <button
                      className="primary"

                      disabled={busy}

                      onClick={async () => {
                        if (
                          await action("stop", {
                            destination: stop.destination,

                            destinationPoint: stop.destinationPoint,

                            expectedTotal: total,
                          })
                        ) {
                          show(false);

                          setStop({});pickOnMap(false);
                        }
                      }}
                    >
                      {tr("Confirmar parada", "Confirm stop")}
                    </button>
                  </>
                )}
              </div>
            )}

            <button
              className="outline"

              disabled={busy}

              onClick={() => {
                if (
                  confirm(
                    tr("¿Finalizar el viaje ahora?", "Finish the ride now?"),
                  )
                )
                  action("finish");
              }}
            >
              {tr("Finalizar viaje", "End ride")}
            </button>
          </>
        )}

        {assigned && !travelCard && contactButtons}

        {(passenger || assigned) && r.status !== "in_progress" && (
          <>
            <button className="text-action" onClick={() => setCancel(!cancel)}>
              {tr("Cancelar viaje", "Cancel ride")}
            </button>

            {cancel && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();

                  action("cancel", { reason: reasonChoice === "other" ? reason : reasonChoice });
                }}
              >
                <label>{tr("Motivo de cancelación", "Reason for cancellation")}<select required value={reasonChoice} onChange={e=>setReasonChoice(e.target.value)}><option value="">{tr("Selecciona un motivo","Select a reason")}</option>{[tr("Cambio de planes","Plans changed"),tr("El tiempo de espera es largo","Wait is too long"),tr("Punto de recogida incorrecto","Incorrect pickup location")].map(x=><option key={x} value={x}>{x}</option>)}<option value="other">{tr("Otro motivo","Other reason")}</option></select></label>
                {reasonChoice === "other" && <label>
                  {tr("Explica el motivo", "Explain the reason")}

                  <textarea
                    required

                    maxLength={500}

                    value={reason}

                    onChange={(e) => why(e.target.value)}
                  />
                </label>}

                <button className="outline" disabled={busy || !reasonChoice || (reasonChoice === "other" && !reason.trim())}>
                  {tr("Confirmar cancelación", "Confirm cancellation")}
                </button>
              </form>
            )}
          </>
        )}
        </div>
      </section>
    </div>
  );
}

function DriverDesk({ data, en, api, demo, reload }) {
  const ok = data.me.status === "approved";

  const shift = useDriverShift(ok, en);

  const [web, setWeb] = useState(false),
    [simulate, sim] = useState(false),
    [notice, setNotice] = useState("");

  const fix = shift.fix;

  useEffect(() => {
    let alive = true,
      watch,
      timer;

    const publish = async (f) => {
      try {
        await api("presence", { fix: f });

        if (alive) {
          setNotice("");

          await reload();
        }
      } catch (e) {
        if (alive) setNotice(e.message);
      }
    };

    if (ok && (simulate || web || shift.enabled)) {
      if (simulate) {
        const ping = () =>
          publish({ point: airportRide.originPoint, time: Date.now() });

        ping();

        timer = setInterval(ping, 30000);
      } else if (native) {
        if (fix) publish(fix);

        timer = setInterval(async () => {
          try {
            const p = await Geolocation.getCurrentPosition({
              enableHighAccuracy: true,

              maximumAge: 0,

              timeout: 15000,
            });

            if (alive)
              await publish({
                point: [p.coords.latitude, p.coords.longitude],

                time: p.timestamp,
              });
          } catch {
            if (alive)
              setNotice(en ? "Waiting for GPS…" : "Esperando señal GPS…");
          }
        }, 45000);
      } else if (navigator.geolocation) {
        const ok = (p) => {
          if (alive)
            publish({
              point: [p.coords.latitude, p.coords.longitude],

              time: p.timestamp,
            });
        };

        const failed = () => {
          if (alive)
            setNotice(
              en
                ? "Allow location to receive offers."
                : "Permite el acceso al GPS para recibir solicitudes.",
            );
        };

        const options = {
          enableHighAccuracy: true,

          maximumAge: 0,

          timeout: 15000,
        };

        watch = navigator.geolocation.watchPosition(ok, failed, options);

        timer = setInterval(
          () => navigator.geolocation.getCurrentPosition(ok, failed, options),

          45000,
        );
      } else setNotice(en ? "GPS unavailable" : "GPS no disponible");
    } else if (ok) void api("presence", { fix: null }).catch(() => {});

    return () => {
      alive = false;

      clearInterval(timer);

      if (watch !== undefined) navigator.geolocation.clearWatch(watch);
    };
  }, [ok, web, simulate, shift.enabled, fix, api, reload, en]);

  if (!ok)
    return (
      <div className="panel">
        {data.me.status === "rejected" && <Resubmit en={en} api={api} reload={reload}/>}
        <h2>
          {data.me.status === "pending"
            ? en
              ? "Documents under review"
              : "Documentos en revisión"
            : en
              ? "Application rejected"
              : "Solicitud rechazada"}
        </h2>

        <p>
          {data.me.status === "pending"
            ? en
              ? "Your documents were sent. Wait for dispatch to review your application."
              : "Enviamos tus documentos. Espera la decisión del administrador."
            : data.me.rejectionReason}
        </p>
      </div>
    );

  const on = simulate || web || shift.enabled;

  return (
    <section className="shift-desk">
      <CarFront />
      <div>
        <strong>
          {on
            ? en
              ? "On shift"
              : "En turno"
            : en
              ? "Off shift"
              : "Fuera de turno"}
        </strong>

        <small>{data.me.vehicle}</small>
      </div>
      <button
        className="outline"

        onClick={() => {
          if (simulate) sim(false);
          else if (native) shift.toggle();
          else setWeb(!web);
        }}
      >
        {on
          ? en
            ? "End shift"
            : "Cerrar turno"
          : en
            ? "Start shift"
            : "Iniciar turno"}
      </button>
      {demo && !on && (
        <button className="text-action" onClick={() => sim(true)}>
          {en ? "Test GPS at Newark Penn" : "Probar GPS en Newark Penn"}
        </button>
      )}
      {native && <ShiftStatus shift={shift} en={en} showTest={false} />}{" "}
      {notice && <p role="alert">{notice}</p>}
    </section>
  );
}

export default function Dispatch({ legacy, configure }) {
  const [token, setToken] = useState(
      () => localStorage.getItem("vt-session") || "",
    ),
    [en, setEn] = useState(false),
    [demo, setDemo] = useState(false),
    [data, setData] = useState(null),
    [tab, nav] = useState("ride"),
    [error, report] = useState(""),
    [offline, network] = useState(false),
    [busy, lock] = useState(false),
    [note, setNote] = useState(""),
    [showSubmission, setShowSubmission] = useState(() => localStorage.getItem("vt-driver-submitted") === "1");

  const [focusId,focus]=useState(""),[reviewId,review]=useState(""),[menu,setMenu]=useState(false);
  const openChat=id=>{focus(id);nav("chat");};
  const previousTrips = useRef(null);
  useEffect(() => {
    if (!data || data.me.role === "admin") return;
    if(data.me.role==="passenger"){
      const key="vt-review-pending-"+data.me.id;
      const last=data.trips.find(r=>r.id===localStorage.getItem(key));
      if(last?.status==="completed" && !last.review)review(last.id);
      const live=data.trips.find(r=>!["completed","cancelled"].includes(r.status));
      if(live)localStorage.setItem(key,live.id);
    }
    const previous = previousTrips.current;
    previousTrips.current = {user:data.me.id, statuses:new Map(data.trips.map(r=>[r.id,r.status]))};
    if (previous?.user !== data.me.id) return;
    const messages = {
      accepted: en ? "Your driver accepted the trip." : "Tu conductor aceptó el viaje.",
      arrived: en ? "Your driver is at pickup." : "Tu conductor llegó al punto de recogida.",
      in_progress: en ? "Your ride has started." : "Tu viaje ha comenzado.",
      completed: en ? "Trip completed. Your summary is in History." : "Viaje finalizado. Puedes ver el resumen en tu historial.",
      cancelled: en ? "The ride was cancelled." : "El viaje fue cancelado."
    };
    for (const trip of data.trips) {
      const before=previous.statuses.get(trip.id);
      if (!before || before===trip.status || !messages[trip.status]) continue;
      if (data.me.role==="driver" && !["completed","cancelled"].includes(trip.status)) continue;
      if(trip.status==="completed" && data.me.role==="passenger" && !trip.review)review(trip.id);
      const body=messages[trip.status];
      setNote(body);
      if(native && !data.hasPush && !(androidAlerts && data.me.role==="passenger")) {
        void LocalNotifications.checkPermissions().then(permission=>{
          if(permission.display==="granted") return LocalNotifications.schedule({notifications:[{id:Math.floor(Math.random()*2000000000)+1,title:"Victoria-Taxi",body,actionTypeId:trip.status==="arrived"?"VT_ARRIVAL":undefined,extra:{rideId:trip.id}}]});
        }).catch(()=>{});
      }
    }
  },[data,en]);
  const serial = useRef(0),
    guard = useRef(false);

  const api = useCallback((path, body) => request(token, path, body), [token]);

  function login(value, submitted = false) {
    if (submitted) localStorage.setItem("vt-driver-submitted", "1");
    if (!value) localStorage.removeItem("vt-driver-submitted");
    setShowSubmission(submitted);
    serial.current++;

    setData(null);review("");focus("");setMenu(false);

    setToken(value);

    value
      ? localStorage.setItem("vt-session", value)
      : localStorage.removeItem("vt-session");

    nav("ride");

    report("");

    setNote("");
  }

  const reload = useCallback(async () => {
    if (!token) return;

    const n = ++serial.current;

    try {
      const snap = await api("state");

      if (n !== serial.current) return;

      if (!snap?.me?.role || !Array.isArray(snap.trips)) throw Error("Invalid account response");
      if (native && snap.me.role === "admin") {
        login("");

        report("Abre el panel del administrador en la web.");

        return;
      }

      setData((prev) =>
        JSON.stringify(prev) === JSON.stringify(snap) ? prev : snap,
      );

      network(false);
    } catch (e) {
      if (n === serial.current) {
        if (e.status === 401) login("");
        else network(true);
      }
    }
  }, [api, token]);

  useEffect(() => {
    document.documentElement.lang = en ? "en" : "es";
  }, [en]);

  useEffect(() => {
    request("", "info")
      .then((v) => setDemo(v.demo))

      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) return;

    reload();

    let stopped = false;

    let socket;

    let retryTimer;

    let backoff = 1000;

    function connect() {
      if (stopped) return;

      const url = new URL((host || location.origin) + "/dispatch/live");

      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

      try {
        socket = new WebSocket(url);
      } catch {
        retryTimer = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 30000);
        return;
      }

      socket.onopen = () => {
        backoff = 1000;
        socket.send(token);
      };

      socket.onmessage = () => reload();

      socket.onclose = () => {
        if (!stopped) {
          retryTimer = setTimeout(connect, backoff + Math.random() * 500);

          backoff = Math.min(backoff * 2, 30000);
        }
      };

      socket.onerror = () => socket.close();
    }

    const localAndroidTest = native && location.protocol === "https:" && host.startsWith("http:");
    if (!localAndroidTest) connect();
    const timer = setInterval(reload, localAndroidTest ? 3000 : 15000);

    const visible = () => {
      if (!document.hidden) reload();
    };

    window.addEventListener("online", reload);

    document.addEventListener("visibilitychange", visible);

    return () => {
      stopped = true;

      serial.current++;

      clearTimeout(retryTimer);

      clearInterval(timer);

      socket?.close();

      window.removeEventListener("online", reload);

      document.removeEventListener("visibilitychange", visible);
    };
  }, [reload, token]);

  async function send(action, body) {
    await api("action", { action, ...body });

    await reload();
  }

  async function run(action, body) {
    if (guard.current) return false;

    guard.current = true;

    lock(true);

    report("");

    setNote("");

    try {
      if(action==="create" && !localStorage.getItem("vt-alert-prompt-"+data.me.id)){
        localStorage.setItem("vt-alert-prompt-"+data.me.id,"1");
        await enableAlerts();
      }
      await send(action, body);

      if (["finish", "cancel"].includes(action)) nav("history");

      if (["rates", "review", "help", "decision"].includes(action))
        setNote(en ? "Saved" : "Guardado");

      return true;
    } catch (e) {
      report(e.message);

      await reload();

      return false;
    } finally {
      guard.current = false;

      lock(false);
    }
  }

  async function leave() {
    if (token) {
      try {
        await api("logout", {});
        if(androidAlerts) await androidAlerts.stop().catch(()=>{});
      } catch (e) {
        report(e.message);

        return;
      }
    }

    login("");
  }

  function confirmLogout(){if(window.confirm(en?"Sign out of Victoria-Taxi?":"¿Cerrar sesión en Victoria-Taxi?"))void leave();}
  async function enableAlerts(){
                    try {
                      if(native) {
                        const permission=await LocalNotifications.requestPermissions();
                        if(permission.display==="granted"){
                          const info=await api("info");
                          if(!info.nativePush?.[Capacitor.getPlatform()]){
                            setNote(en?"Trip alerts enabled while connected to dispatch.":"Notificaciones permitidas. Mantén conexión con la PC durante el viaje.");
                            return;
                          }
                        }
                      }
                      await enablePush(data.pushKey, api);

                      setNote(
                        en ? "Notifications enabled" : "Avisos activados",
                      );
                    } catch (e) {
                      report(e.message);
                    }
  }
  const me = data?.me,
    admin = me?.role === "admin",
    passenger = me?.role === "passenger";

  const active =
    data?.trips.filter((r) => !["completed", "cancelled"].includes(r.status)) ||
    [];
  const tabUnread=me && tab!=="chat"?active.reduce((n,r)=>n+unreadMessages(r,me),0):0;
  const tracked = active.find(r=>passenger || r.driverId===me?.id);
  const [compact,setCompact]=useState(false);
  const miniRide=me?.role==="driver" && tracked?.driverId===me.id ? tracked : null;
  useEffect(()=>{
    const mode=e=>setCompact(Boolean(e.compact));
    window.addEventListener("vt-driver-window",mode);
    return ()=>window.removeEventListener("vt-driver-window",mode);
  },[]);
  const eligible=Boolean(miniRide);
  useEffect(()=>{
    driverWindow?.configure({enabled:eligible}).catch(()=>{});
  },[eligible]);
  const alertRide = tracked?.id;
  const [noticeTarget,setNoticeTarget]=useState(()=>{const id=new URLSearchParams(location.search).get("trip")||"";return id.includes("/")?"":id;});
  useEffect(()=>{
    if(!token)return;
    const opened=e=>{const info=e.notification?.data || e.notification?.extra || {};if(!info.rideId)return;
      if(info.callId && ["answer","decline"].includes(e.actionId))sessionStorage.setItem("vt-call-"+info.callId,e.actionId);
      setNoticeTarget(["outside","coming"].includes(e.actionId)?e.actionId+"/"+info.rideId:info.rideId);void reload();
    };
    const openedRide=()=>{if(androidAlerts&&!document.hidden)void androidAlerts.openedRide().then(v=>{if(v.rideId)setNoticeTarget(v.rideId);}).catch(()=>{});};
    openedRide();window.addEventListener("vt-open-trip",openedRide);document.addEventListener("visibilitychange",openedRide);
    const web=e=>{if(e.data?.rideId)setNoticeTarget(e.data.rideId);};
    navigator.serviceWorker?.addEventListener("message",web);
    navigator.serviceWorker?.ready.then(reg=>reg.active?.postMessage({type:"arrival-ready"})).catch(()=>{});
    const handles=native?[PushNotifications.addListener("pushNotificationActionPerformed",opened),LocalNotifications.addListener("localNotificationActionPerformed",opened)]:[];
    return ()=>{window.removeEventListener("vt-open-trip",openedRide);document.removeEventListener("visibilitychange",openedRide);navigator.serviceWorker?.removeEventListener("message",web);handles.forEach(h=>h.then(x=>x.remove()).catch(()=>{}));};
  },[token,reload]);
  useEffect(()=>{
    if(!noticeTarget || !data)return;
    const [reply,id]=noticeTarget.split("/");
    if(id && ["outside","coming"].includes(reply)){
      setNoticeTarget("");
      history.replaceState(history.state,"",location.pathname+location.hash);
      const ride=data.trips.find(t=>t.id===id);
      if(ride && passenger){
        focus(id);nav("ride");
        void api("action",{action:"pickupReply",id,reply}).then(reload).catch(e=>report(e.message));
      }
      return;
    }
    const chat=noticeTarget.startsWith("chat/");
    const r=data.trips.find(t=>t.id===(chat?noticeTarget.slice(5):noticeTarget));
    if(r){focus(r.id);nav(["completed","cancelled"].includes(r.status)?"history":chat?"chat":"ride");setNoticeTarget("");}
  },[noticeTarget,data,passenger,api,reload]);
  useEffect(()=>{
    if(tab!=="chat" || !me || !focusId)return;
    const chat=data.trips.find(r=>r.id===focusId);
    const mark=()=>{if(chat && !document.hidden)localStorage.setItem("vt-read-"+me.id+"-"+chat.id,String(chat.messages.filter(m=>m.senderId?m.senderId!==me.id:m.from!==me.name).length));};
    mark();document.addEventListener("visibilitychange",mark);
    return ()=>document.removeEventListener("visibilitychange",mark);
  },[tab,focusId,data,me]);
  const initialStatus = useRef(null);
  initialStatus.current = tracked?.status;
  useEffect(()=>{
    if(!androidAlerts || !alertRide)return;
    let alive=true;
    async function startTracking(){
      if(document.hidden)return;
      try {
        const permission=await LocalNotifications.requestPermissions();
        if(alive && permission.display!=="granted")report(en?"Enable notifications in device Settings to receive background ride and call alerts.":"Activa las notificaciones en los ajustes del celular para recibir avisos y llamadas en segundo plano.");
        if(alive && permission.display==="granted") await androidAlerts.start({host:host || location.origin,token,ride:alertRide,messageCount:String(tracked.messages.filter(m=>m.senderId?m.senderId!==me.id:m.from!==me.name).length),role:me.role,systemAlerts:String(!data.hasPush),status:initialStatus.current,lang:en?"en":"es"});
      } catch { if(alive) report(en?"Could not start ride alerts.":"No se pudieron iniciar los avisos del viaje."); }
    }
    startTracking();
    document.addEventListener("visibilitychange",startTracking);
    return ()=>{alive=false;document.removeEventListener("visibilitychange",startTracking);};
  },[alertRide,token,en]);

  return (
    <div className="dispatch-app">
      {compact && miniRide && <DriverMiniMap ride={miniRide} en={en} api={api}/>}
      <Header
        en={en}

        toggleLang={() => setEn(!en)}

        goHome={() => nav("ride")}

        connected
      />

      {!token ? (
        <><Access legacy={legacy} demo={demo} en={en} login={login} />{native&&<button className="outline" onClick={configure}>{en?"Change dispatch server":"Cambiar central"}</button>}</>
      ) : showSubmission ? (
        <main className="dispatch-main"><section className="panel submission-confirmation" role="status">
          <span className="sheet-icon"><CarFront size={24}/></span>
          <h1>{en ? "Application sent" : "Solicitud enviada"}</h1>
          <p>{en ? "Your documents were sent successfully. The administrator will review them and you can check your approval status here." : "Tus documentos fueron enviados correctamente. El administrador revisará tu solicitud y podrás consultar aquí si fue aprobada."}</p>
          <button className="primary" onClick={() => {localStorage.removeItem("vt-driver-submitted");setShowSubmission(false);}}>{en ? "Continue" : "Continuar"}</button>
        </section></main>
      ) : (
        <main className="dispatch-main">
          <div className="dispatch-top">
            <div>
              <span className="city-line">
                <MapPin size={14} /> New Jersey
              </span>

              <h1>
                {admin
                  ? en
                    ? "Dispatch dashboard"
                    : "Centro de operaciones"
                  : passenger
                    ? (en ? "Hello, " : "Hola, ") +
                      (me?.name.split(" ")[0] || "")
                    : me
                      ? en
                        ? "Driver dashboard"
                        : "Mi jornada"
                      : "Victoria-Taxi"}
              </h1>
            </div>

            <div className="vt-menu"><button className="vt-icon" aria-label={en?"Menu":"Menú"} aria-expanded={menu} onClick={()=>setMenu(!menu)}><Menu/></button>{menu&&<aside className="menu-drawer"><strong>Victoria-Taxi</strong>{native&&<button onClick={configure}>{en?"Dispatch server":"Central"}</button>}<button onClick={()=>{setEn(!en);setMenu(false);}}>{en?"Español":"English"}</button>{!admin&&<button onClick={()=>{nav("profile");setMenu(false);}}>{en?"My profile":"Mi perfil"}</button>}{admin&&<button onClick={confirmLogout}>{en?"Sign out":"Cerrar sesión"}</button>}<button onClick={()=>setMenu(false)}>{en?"Close menu":"Cerrar menú"}</button></aside>}</div>
          </div>

          {offline && (
            <p className="dispatch-alert" role="status">
              {en
                ? "Reconnecting to dispatch…"
                : "Reconectando con la central…"}{" "}
              <button onClick={reload}>{en ? "Retry" : "Reintentar"}</button>{native&&<button onClick={configure}>{en?"Change server":"Cambiar central"}</button>}
            </p>
          )}

          {error && (
            <p className="dispatch-alert" role="alert">
              {error}
            </p>
          )}

          {note && <p role="status">{note}</p>}

          {!data ? (
            <p>{en ? "Loading account…" : "Cargando cuenta…"}</p>
          ) : admin ? (
            <DispatchAdmin
              data={data}

              en={en}

              api={api}

              run={run}

              reload={reload}
            />
          ) : (
            <>
              <nav className="dispatch-tabs vt-bottom">{[
                ["ride",CarFront,passenger?(en?"My ride":"Mi viaje"):(en?"Shift":"Turno")],
                ["history",History,en?"History":"Historial"],["alerts",Bell,en?"Alerts":"Avisos"],["profile",UserRound,en?"Profile":"Mi perfil"]
              ].map(([page,Icon,label])=><button key={page} className={(page===tab||(page==="ride"&&tab==="chat"))?"selected":""} onClick={()=>{focus("");nav(page);setMenu(false);}}><Icon size={19}/>{label}{page==="ride" && tab!=="ride" && tabUnread>0 && <b className="vt-tab-unread">{tabUnread}</b>}</button>)}</nav>

              {active.filter(r=>r.driverId && r.status!=="waiting").map(r=>
                <RideCall key={r.id} ride={r} me={me} en={en} api={api} send={(action,body)=>send(action,{...body,id:r.id})}/>
              )}
              {!passenger && (
                <div hidden={tab !== "ride"}>
                  <DriverDesk
                    data={data}

                    en={en}

                    api={api}

                    demo={demo && me.id === "demo-driver"}

                    reload={reload}

                    report={report}
                  />
                </div>
              )}

              {reviewId && data.trips.some(r=>r.id===reviewId&&!r.review) && <Review key={reviewId} ride={data.trips.find(r=>r.id===reviewId)} en={en} run={run} done={()=>{localStorage.removeItem("vt-review-pending-"+me.id);review("");}}/>}
              {tab==="alerts"?<Inbox api={api} trips={data.trips} en={en} offline={offline} enable={enableAlerts} open={item=>{focus(item.rideId);const live=active.some(r=>r.id===item.rideId);nav(live?(item.kind==="message"?"chat":"ride"):"history");}}/>:
              tab==="chat" && active.some(r=>r.id===focusId)?<Chat key={focusId} ride={active.find(r=>r.id===focusId)} me={me} en={en} offline={offline} send={send} back={()=>nav("ride")}/>:
              tab === "profile" ? <Profile leave={confirmLogout} me={me} en={en} api={api} reload={reload}/> : tab === "history" ? (
                <HistoryList focusId={focusId} trips={data.trips} me={me} en={en} run={run} />
              ) : active.length ? (
                active.map((r) => (
                  <ActiveRide
                    api={api}

                    key={r.id}

                    r={r}

                    me={me}

                    en={en}

                    run={run}

                    openChat={openChat}

                    busy={busy || offline}
                  />
                ))
              ) : passenger ? (
                <Booking data={data} en={en} run={run} busy={busy || offline} api={api} reload={reload} />
              ) : (
                me.status === "approved" && (
                  <section className="dispatch-empty">
                    <Radio />

                    <h2>{en ? "Nearby requests" : "Solicitudes cercanas"}</h2>

                    <p>
                      {en
                        ? "Offers appear here during your shift, within 10 miles of your location."
                        : "Durante tu turno verás aquí las solicitudes a 10 millas o menos de tu ubicación."}
                    </p>
                  </section>
                )
              )}
            </>
          )}
        </main>
      )}
    </div>
  );
}
