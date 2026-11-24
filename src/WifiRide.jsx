import { useMapAddresses } from "./useMapAddresses";
import { useCallback, useEffect, useRef, useState } from "react";
import { App as MobileApp } from "@capacitor/app";
import { Capacitor, CapacitorHttp, registerPlugin } from "@capacitor/core";
import { nativeMobile, ShiftStatus, useDriverShift } from "./DriverShift";
import { airportRide } from "./demo";
import { useDrivingRoute } from "./routing";
import { FareTicket, money, priceRide } from "./FareTicket";
import RideMap from "./RideMap";
import AddressField from "./AddressField";
import { Header } from "./Shell";

const offers = registerPlugin("WifiOffers");
const rates = {perMile:3,weather:0,traffic:0};
async function api(pair, endpoint, body) {
  const url=pair.host+"/api/"+endpoint;
  const headers={Authorization:"Bearer "+pair.key,"Content-Type":"application/json"};
  const method=body?"POST":"GET";
  if(nativeMobile) {
    const res=await CapacitorHttp.request({url,method,headers,data:body,connectTimeout:4500,readTimeout:4500});
    if(res.status!==200) throw Error(res.data?.error || "Wi-Fi");
    return res.data;
  }
  const res=await fetch(url,{method,headers,body:body && JSON.stringify(body),signal:AbortSignal.timeout(5500)});
  if(!res.ok) throw Error((await res.json()).error || "Wi-Fi");
  return res.json();
}

export default function WifiRide({pair,leave,offer}) {
  const [en,setEn]=useState(false);
  const tr=(es,eng)=>en?eng:es;
  const passenger=pair.role==="passenger";
  const shift=useDriverShift(!passenger,en);
  const [webOnline,setWebOnline]=useState(false);
  const online=!passenger && (nativeMobile?shift.enabled:webOnline);
  const [state,setState]=useState(null), [connected,setConnected]=useState(false);
  const [busy,setBusy]=useState(false), [error,setError]=useState("");
  const [form,setForm]=useState({origin:"",destination:"",originPoint:null,destinationPoint:null}),[message,setMessage]=useState("");
  const [again,setAgain]=useState(false);
  const [extra,setExtra]=useState({name:"",point:null});
  const [offersFailed,setOffersFailed]=useState(false);
  const serial=useRef(0);
  const refresh=useCallback(async()=>{
    const sequence=++serial.current;
    try {
      const snap=await api(pair,"state");
      if(sequence===serial.current){setState(snap);setConnected(true);}
    } catch {if(sequence===serial.current)setConnected(false);}
  },[pair]);
  useEffect(()=>{
    let alive=true,timer;
    async function poll() {
      if(!alive)return;
      if(online && !nativeMobile) await api(pair,"action",{action:"heartbeat"}).catch(()=>{});
      if(alive)await refresh();
      if(alive)timer=setTimeout(poll,1500);
    }
    poll();
    return ()=>{alive=false;clearTimeout(timer);serial.current++;};
  },[refresh,pair,online]);
  useEffect(()=>{
    if(!online || Capacitor.getPlatform()!=="android")return;
    let active=true;
    offers.start({host:pair.host,key:pair.key}).then(()=>{if(active)setOffersFailed(false);}).catch(()=>{if(active)setOffersFailed(true);});
    return ()=>{active=false;void offers.stop().catch(()=>{});};
  },[online,pair]);
  useEffect(() => {
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    const listener = nativeMobile && MobileApp.addListener("appStateChange", ({isActive}) => {
      if (isActive) void refresh();
    });
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (listener) void listener.then(handle => handle.remove());
    };
  }, [refresh]);
  useEffect(() => { if (offer) void refresh(); }, [offer, refresh]);
  const ride=state?.ride;
  const active=ride && ["waiting","accepted","arrived","in_progress"].includes(ride.status);
  const compose=passenger && (!ride || (!active && again));
  const {route,loading,error:routeError,retry}=useDrivingRoute(form.originPoint,form.destinationPoint,compose);
  const extraRoute=useDrivingRoute(ride?.destinationPoint,extra.point,passenger && active && ride?.status!=="waiting");

  async function act(action,extra={}) {
    if(busy)return;
    setBusy(true);setError("");
    try{
      await api(pair,"action",{action,id:ride?.id,...extra});
      if(action==="create")setAgain(false);
      if(action==="message")setMessage("");
      await refresh();
    }catch(e){setError(e.message);await refresh();}finally{setBusy(false);}
  }
  const name=passenger?"Sofía Reyes":"Diego Torres";
  const status={waiting:tr("Buscando conductor","Looking for driver"),accepted:tr("Conductor en camino","Driver on the way"),arrived:tr("Conductor llegó","Driver arrived"),in_progress:tr("Viaje iniciado","Ride started"),completed:tr("Viaje finalizado","Ride completed"),cancelled:tr("Viaje cancelado","Ride cancelled")};
  const mapAddresses=useMapAddresses(setForm,en);
  const pick=mapAddresses.select;
  const pendingForDriver = !passenger && ride?.status === "waiting";
  const toggleShift = nativeMobile ? shift.toggle : () => setWebOnline(!webOnline);
  const switchLabel = online ? tr("Terminar turno","End shift") : tr("Iniciar turno","Start shift");
  return <><Header en={en} toggleLang={()=>setEn(!en)} goHome={leave}/>
    <main className="home wifi-room"><h1>{name} · {tr("Prueba Wi-Fi","Wi-Fi test")}</h1>
      <p role="status">{connected?tr("Conectado a la PC","Connected to PC"):tr("Buscando conexión con la PC…","Connecting to PC…")}
      {passenger && connected && (" · "+(state.driverOnline?tr("Diego disponible","Diego online"):tr("Esperando a Diego","Waiting for Diego")))}</p>
      {passenger && state?.join && <details open={!state.driverOnline && !active}><summary>{tr("Conectar el teléfono de Diego","Connect Diego’s phone")}</summary>
        <p>{tr("Escanea con la cámara del Android en la misma Wi-Fi.","Scan with the Android camera on the same Wi-Fi.")}</p>
        <img width="160" height="160" src="/pair.png" alt="QR Android"/><p><a href={state.join}>{state.join}</a></p>
      </details>}
      {!passenger && offer && connected && state && (ride?.id !== offer.id || ride?.status === "cancelled" || ride?.status === "completed") &&
        <p role="status">{tr("El viaje de ese aviso ya no está pendiente.","The ride in that alert is no longer pending.")}</p>}
      {pendingForDriver && <section className="panel incoming-offer" aria-label={tr("Solicitud pendiente","Pending request")}>
        <span className="pill waiting">{tr("Viaje de Sofía","Ride from Sofía")}</span>
        <h2>{tr("Nueva solicitud de viaje","New ride request")}</h2>
        <p><b>{tr("Recogida","Pickup")}</b><br/>{ride.origin}</p>
        <p><b>{tr("Destino","Destination")}</b><br/>{ride.destination}</p>
        <strong>{money(ride.fare)} USD</strong> · {ride.distance} mi · {ride.minutes} min
        {online ? <button className="primary full" disabled={busy||!connected} onClick={()=>act("accept")}>{tr("Aceptar viaje","Accept ride")}</button> :
          <button className="primary full" disabled={!connected} onClick={toggleShift}>{tr("Iniciar turno para aceptar","Start shift to accept")}</button>}
      </section>}
      {!passenger && <section className="panel">{(!pendingForDriver || online) && <button className="outline" onClick={toggleShift}>{switchLabel}</button>}
        {nativeMobile?<ShiftStatus shift={shift} en={en} showTest={false}/>:<p>{tr("Mantén esta página abierta para recibir el viaje.","Keep this page open to receive the ride.")}</p>}
        {offersFailed && <p>{tr("No se iniciaron los avisos. Reinicia el turno.","Alerts could not start. Restart your shift.")}</p>}</section>}
      {compose && <div className="two-col booking-layout"><RideMap lang={en?"en":"es"} ride={{...form,...route}} onPick={pick}/>
        <section className="panel"><h2>{tr("Pedir un viaje","Request a ride")}</h2>
          {["origin","destination"].map(k=><AddressField key={k} label={k==="origin"?tr("Recogida","Pickup"):tr("Destino","Destination")} en={en} value={form[k]} confirmed={!!form[k+"Point"]} onEdit={(v,preserve)=>mapAddresses.edit(k,v,preserve)} mapStatus={mapAddresses.status[k]} onManual={v=>mapAddresses.acceptManual(k,v)} onSelect={(n,p)=>pick(k,p,n)}/>)}
          {route && <FareTicket en={en} fare={priceRide(route.distance,rates)}/>}
          {loading && <p>{tr("Calculando ruta…","Calculating route…")}</p>}
          {routeError && <button onClick={retry}>{tr("Reintentar ruta","Retry route")}</button>}
          <button className="primary full" disabled={!connected||busy||!route} onClick={()=>act("create",{ride:{...form,...route}})}>{tr("Solicitar viaje","Request ride")}</button>
        </section></div>}
      {!compose && ride && <div className="two-col booking-layout">
        <RideMap lang={en?"en":"es"} ride={ride} driverPoint={shift.fix?.point}/>
        {!pendingForDriver && <section className="panel"><h2>{status[ride.status]}</h2><p>{ride.origin} → {ride.destination}</p><strong>{money(ride.fare)} USD</strong>
          {passenger && ride.status==="waiting" && <button className="outline full" disabled={busy||!connected} onClick={()=>act("cancel")}>{tr("Cancelar viaje","Cancel ride")}</button>}
          {ride.segments?.length>0 && <ol>{ride.segments.map((segment,i)=><li key={i}>{segment.destination} · {segment.distance} mi · {money(segment.fare)}</li>)}</ol>}
          {passenger && ["accepted","arrived","in_progress"].includes(ride.status) && <><AddressField en={en} label={tr("Añadir destino","Add destination")} value={extra.name} confirmed={!!extra.point} onEdit={name=>setExtra({name,point:null})} onSelect={(name,point)=>setExtra({name,point})}/>{extraRoute.route && <p>{tr("Total estimado con la parada","Estimated total with stop")}: {money(ride.fare+extraRoute.route.distance*3)} · +{extraRoute.route.distance} mi</p>}
          {extraRoute.loading && <p>{tr("Calculando nueva parada…","Calculating stop…")}</p>}
          {extraRoute.error && <button onClick={extraRoute.retry}>{tr("Reintentar","Retry")}</button>}
          <button className="outline" disabled={!extraRoute.route||busy||!connected} onClick={async()=>{await act("add-destination",{leg:{destination:extra.name,destinationPoint:extra.point}});setExtra({name:"",point:null});}}>{tr("Añadir al viaje","Add to ride")}</button><button className="outline full" disabled={busy||!connected} onClick={()=>act("finish")}>{tr("Finalizar viaje","Finish trip")}</button></>}
          {!passenger && ride.status==="accepted" && <button className="primary full" disabled={busy||!connected} onClick={()=>act("arrive")}>{tr("He llegado","I've arrived")}</button>}
          {!passenger && ride.status==="arrived" && <button className="primary full" disabled={busy||!connected} onClick={()=>act("start")}>{tr("Iniciar viaje","Start ride")}</button>}
          {["accepted","arrived","in_progress"].includes(ride.status) && <><h3>{tr("Mensajes","Messages")}</h3>{ride.messages.map((m,i)=><p key={i}><b>{m.role==="driver"?"Diego":"Sofía"}:</b> {m.text}</p>)}
            <form onSubmit={e=>{e.preventDefault();act("message",{message});}}><input aria-label={tr("Mensaje","Message")} maxLength={1000} value={message} onChange={e=>setMessage(e.target.value)}/><button className="outline" disabled={!message.trim()||busy||!connected}>{tr("Enviar","Send")}</button></form>
            {!passenger && ride.status==="in_progress" && <button className="primary full" disabled={busy||!connected||!shift.fix||!ride.destinationPoint || Date.now()-shift.fix.time>120000 || Math.hypot((shift.fix.point[0]-ride.destinationPoint[0])*111320,(shift.fix.point[1]-ride.destinationPoint[1])*111320*Math.cos(ride.destinationPoint[0]*Math.PI/180))>100} onClick={()=>act("finish",{fix:shift.fix})}>{tr("Finalizar viaje","Complete ride")}</button>}</>}
          {passenger && !active && <button className="primary full" onClick={()=>setAgain(true)}>{tr("Otro viaje","Another ride")}</button>}
        </section>}</div>}
      {!passenger && !ride && connected && <p>{online?tr("Esperando una solicitud de Sofía.","Waiting for a ride request."):tr("Inicia el turno para recibir viajes.","Start your shift to receive rides.")}</p>}
      {error && <p role="alert">{error}</p>}<button className="outline" onClick={leave}>{tr("Salir de la prueba","Leave test")}</button>
    </main></>;
}
