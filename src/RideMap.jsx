import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock3, Flag, Focus, MapPinned, Pencil, Route, Timer, X } from 'lucide-react';
import { CarFront, Check, Crosshair, MapPin } from 'lucide-react';
import { createRoot } from 'react-dom/client';
import { streetAt } from './useMapAddresses';
import L from 'leaflet';
import {Geolocation} from '@capacitor/geolocation';
import 'leaflet/dist/leaflet.css';
import './RideMap.css';

const copy = {
  es: { title: 'Ruta del viaje', origin: 'Recogida', destination: 'Destino', edit: 'Editar paradas', close: 'Terminar edición', hint: 'Toca el mapa para mover la parada seleccionada.', center: 'Usar el centro del mapa', fit: 'Ver toda la ruta', distance: 'Distancia', duration: 'Duración', arrival: 'Llegada aprox.', foot: 'Salida ahora · hora de Nueva York', tomorrow: 'mañana', error: 'Algunas calles no cargaron.', retry: 'Reintentar' },
  en: { title: 'Trip route', origin: 'Pickup', destination: 'Destination', edit: 'Edit stops', close: 'Finish editing', hint: 'Tap the map to move the selected stop.', center: 'Use map center', fit: 'Show entire route', distance: 'Distance', duration: 'Duration', arrival: 'Est. arrival', foot: 'Leaving now · New York time', tomorrow: 'tomorrow', error: 'Some streets could not load.', retry: 'Retry' }
};

function JourneyMetrics({ ride, lang, t }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const locale = lang === 'es' ? 'es-US' : 'en-US';
  const zone = 'America/New_York';
  const arrival = new Date(now + ride.minutes * 60000);
  const formatDay = new Intl.DateTimeFormat(locale, {timeZone:zone, month:'short', day:'numeric'});
  const nextDay = formatDay.format(now) !== formatDay.format(arrival);
  const hours = Math.floor(ride.minutes / 60);
  const rest = ride.minutes % 60;
  const duration = hours ? hours + ' h' + (rest ? ' ' + rest + ' min' : '') : rest + ' min';
  const arrivalTime = new Intl.DateTimeFormat(locale, {timeZone:zone,hour:'numeric',minute:'2-digit'}).format(arrival);
  return <div className="journey-readout">
    <dl>
      <div><dt><Route/>{t.distance}</dt><dd>{Number(ride.distance).toLocaleString(locale)} <small>mi</small></dd></div>
      <div><dt><Timer/>{t.duration}</dt><dd>{duration}</dd></div>
      <div><dt><Flag/>{t.arrival}</dt><dd><time dateTime={arrival.toISOString()}>{arrivalTime}</time></dd></div>
    </dl>
    <p><Clock3 size={13}/>{t.foot}{nextDay && ' · ' + formatDay.format(arrival)}</p>
  </div>;
}

export default function RideMap({ ride, lang, onPick, driverPoint, editRequest, picker=false, pickupField, singleStop=false, approach=false }) {
  const container = useRef(null);
  const map = useRef(null);
  const tiles = useRef(null);
  const [editing, setEditing] = useState(picker);
  const [stop, setStop] = useState(singleStop?'destination':'origin');
  useEffect(()=>{if(editRequest){setEditing(true);setStop("destination");container.current?.scrollIntoView({block:"center"});}},[editRequest]);
  const [mapReady,ready]=useState(false);
  const [street,setStreet]=useState(null);
  const confirmedCenter=useRef(null);
  const es=lang==="es";
  function chooseStop(key){
    setStop(key);setEditing(true);
    const point=ride[key+"Point"];
    if(point)map.current.setView(point,Math.max(map.current.getZoom(),15));
  }
  useEffect(()=>{
    if(!picker || !editing)return;
    const instance=map.current;
    let timer,controller;
    function clear(){clearTimeout(timer);controller?.abort();confirmedCenter.current=null;setStreet(null);}
    function lookup(){
      clear();
      const center=instance.getCenter().wrap(),point=[center.lat,center.lng];
      const request=new AbortController();controller=request;
      timer=setTimeout(async()=>{
        try{
          const name=await streetAt(point,AbortSignal.any([request.signal,AbortSignal.timeout(6000)]));
          if(!request.signal.aborted){confirmedCenter.current={point,name};setStreet(name);}
        }catch{if(!request.signal.aborted)setStreet("");}
      },400);
    }
    // The map instance is available after the mount effects have run.
    if(!instance)return;
    lookup();instance.on("movestart",clear).on("moveend",lookup);
    return ()=>{clearTimeout(timer);controller?.abort();instance.off("movestart",clear).off("moveend",lookup);};
  },[picker,editing,stop,mapReady]);
  useEffect(()=>{if(picker && !singleStop && ride.originPoint && ride.destinationPoint)setEditing(false);},[picker,ride.originPoint,ride.destinationPoint]);
  const [failed, setFailed] = useState(false);
  const [locating,setLocating] = useState(false);
  const [locationError,setLocationError] = useState(false);
  const myMarker = useRef(null);
  async function locate() {
    const instance=map.current;
    setLocating(true);setLocationError(false);
    try {
      const {coords}=await Geolocation.getCurrentPosition({enableHighAccuracy:true,timeout:15000,maximumAge:15000});
      if(map.current!==instance)return;
      const point=[coords.latitude,coords.longitude];
      myMarker.current?.remove();
      myMarker.current=L.circleMarker(point,{radius:7,color:"white",weight:3,fillColor:"#1677bc",fillOpacity:1}).addTo(instance);
      instance.setView(point,16);
    }catch{if(map.current===instance)setLocationError(true);}
    finally{if(map.current===instance)setLocating(false);}
  }
  const t = copy[lang];
  const { originPoint, destinationPoint, path } = ride;
  const canPick = Boolean(editing && onPick);
  const fitRoute = useCallback(() => {
    const points = [...(path || []), originPoint, destinationPoint,approach && driverPoint].filter(Boolean);
    if (points.length) map.current.fitBounds(L.latLngBounds(points), { padding: [42, 44], maxZoom: 16, animate:false });
  }, [originPoint, destinationPoint, path,approach,driverPoint]);

  useEffect(() => {
    const instance = L.map(container.current, { scrollWheelZoom: false, zoomControl:false, zoomSnap:0.25 }).setView([40.7357,-74.1724],12);
    map.current = instance;ready(true);
    if(singleStop && (destinationPoint||originPoint))instance.setView(destinationPoint||originPoint,16);
    L.control.zoom({position:'bottomright'}).addTo(instance);
    const layer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>', maxZoom:19
    });
    tiles.current = layer;
    layer.on('tileerror', () => setFailed(true)).addTo(instance);
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(container.current);
    return () => { observer.disconnect(); instance.remove(); map.current=null; };
  }, []);

  useEffect(() => {
    if (!canPick || picker) return;
    function select({ latlng }) {
      onPick(stop, [latlng.lat, latlng.wrap().lng]);
      if (stop === 'origin') setStop('destination');
      else setEditing(false);
    }
    const instance = map.current;
    instance.on('click', select);
    return () => { instance.off('click', select); };
  }, [canPick, stop, onPick,picker]);

  useEffect(() => {
    const group = L.layerGroup().addTo(map.current);
    if (path?.length) {
      L.polyline(path, { color:'#fff', weight:9, opacity:0.98, interactive:false }).addTo(group);
      L.polyline(path, { color:'#ad2140', weight:5, opacity:1, interactive:false }).addTo(group);
    }
    for (const [point, label, letter, name] of [[originPoint,t.origin,'A',ride.origin],[destinationPoint,t.destination,'B',ride.destination]]) {
      if (!point) continue;
      const icon = L.divIcon({className:'waypoint waypoint-' + letter, html:'<b>'+letter+'</b>',iconSize:[30,30],iconAnchor:[15,15]});
      const popup = document.createElement('span');
      popup.textContent = label + ' · ' + name;
      L.marker(point, { icon, title:popup.textContent, alt:label }).bindPopup(popup).addTo(group);
    }
    return () => { group.remove(); };
  }, [path, originPoint, destinationPoint, ride.origin, ride.destination, t]);

  useEffect(() => {
    if (!driverPoint) return;
    const symbol=document.createElement("span");
    const root=createRoot(symbol);root.render(<CarFront size={23}/>);
    const marker = L.marker(driverPoint,{title:es?"Tu conductor":"Your driver",icon:L.divIcon({className:"vt-car-marker",html:symbol,iconSize:[40,40],iconAnchor:[20,20]})})
      .bindTooltip(lang === "es" ? "Ubicación del conductor" : "Driver location").addTo(map.current);
    return () => { marker.remove();queueMicrotask(()=>root.unmount()); };
  }, [driverPoint, lang]);

  useEffect(() => { if(!picker || !editing)fitRoute(); }, [fitRoute,picker,editing]);

  return <section className={"ride-map itinerary-map"+(picker?" vt-picker":"")+(approach?" vt-approach":"")} aria-label={t.title}>
    {!picker && !approach && <div className="map-heading"><h2><MapPinned size={18}/>{t.title}</h2>
      {onPick && <button type="button" aria-expanded={editing} onClick={() => setEditing(!editing)}>
        {editing ? <X size={15}/> : <Pencil size={15}/>} {editing ? t.close : t.edit}</button>}
    </div>}
    {!picker && !approach && <button type="button" className="locate-me" disabled={locating} onClick={locate}><Focus size={16}/>{locating?(lang==="es"?"Buscando ubicación…":"Locating…"):(lang==="es"?"Mi ubicación":"My location")}</button>}
    {locationError && <p role="status">{lang==="es"?"Revisa el permiso de ubicación y vuelve a intentar.":"Check location permission and try again."}</p>}
    {canPick && !picker && <div className="map-editor">
      <div>{['origin','destination'].map(key => <button key={key} type="button" aria-pressed={stop === key} onClick={() => setStop(key)}>{t[key]}</button>)}</div>
      <small>{t.hint}</small>
      <button type="button" onClick={() => map.current.fire('click',{latlng:map.current.getCenter()})}>{t.center}</button>
    </div>}
    <div className={'map-stage' + (canPick ? ' is-editing' : '')}>
      <div className="street-map" ref={container} aria-label={t.title}/>
      {picker && !singleStop && <div className="vt-point-tabs">{["origin","destination"].map((key,i)=><button type="button" key={key} aria-pressed={editing && stop===key} onClick={()=>chooseStop(key)}><b>{ride[key+"Point"]?<Check size={12}/>:i+1}</b>{t[key]}</button>)}</div>}
      {approach && <div className="vt-map-tag"><i/>{es?"Camino a la recogida":"On the way to pickup"}</div>}
      {picker && editing && <div className="vt-map-pin" aria-hidden="true"><span>{stop==="origin"?"A":"B"}</span></div>}
      {(picker || approach) && <button type="button" className="vt-gps" disabled={locating} aria-label={es?"Mi ubicación":"My location"} title={es?"Mi ubicación":"My location"} onClick={locate}><Crosshair size={21}/></button>}
      {(!picker || !editing) && (originPoint || destinationPoint) && <button className="map-fit" type="button" aria-label={t.fit} title={t.fit} onClick={fitRoute}><Focus size={20}/></button>}
    </div>
    {picker && editing && <div className="vt-pin-sheet"><small><MapPin size={15}/>{es?"Mueve el mapa para ajustar":"Move the map to adjust"}</small>
      <strong aria-live="polite">{street || (street===null?(es?"Buscando la calle…":"Finding street…"):(es?"Punto seleccionado":"Selected point"))}</strong>
      {stop==="origin" && pickupField}
      <button className="primary" type="button" onClick={()=>{
        const c=map.current.getCenter().wrap(),known=confirmedCenter.current;
        const name=known && Math.abs(c.lat-known.point[0])+Math.abs(c.lng-known.point[1])<0.000001?known.name:undefined;
        onPick(stop,[c.lat,c.lng],name);
        if(stop==="origin" && !destinationPoint)chooseStop("destination");else setEditing(false);
      }}><Check size={17}/>{es?"Confirmar ":"Confirm "}{singleStop?(es?"nueva parada":"new stop"):t[stop].toLowerCase()}</button></div>}
    {!picker && !approach && <div className="waypoint-key"><span><b>A</b>{t.origin}</span><span><b>B</b>{t.destination}</span></div>}
    {path?.length > 0 && Number(ride.minutes) > 0 && <JourneyMetrics ride={ride} lang={lang} t={t}/>}
    {failed && <p role="status">{t.error} <button type="button" onClick={() => {setFailed(false);tiles.current.redraw();}}>{t.retry}</button></p>}
  </section>;
}
