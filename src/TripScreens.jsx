import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Bell, ChevronRight, Eye, EyeOff, MessageCircle, PhoneMissed, Send, Star } from "lucide-react";
import { statusLabel } from "./RideHistory";

export function PasswordInput({en,...props}) {
  const [visible,setVisible]=useState(false);
  const Icon=visible?EyeOff:Eye;
  return <span className="password-field"><input {...props} type={visible?"text":"password"}/><button type="button" aria-label={visible?(en?"Hide password":"Ocultar contraseña"):(en?"Show password":"Mostrar contraseña")} aria-pressed={visible} onClick={()=>setVisible(!visible)}><Icon size={19}/></button></span>;
}
export function Review({ride,en,run,done}) {
  const [stars,rate]=useState(0),[comment,write]=useState(""),[saving,save]=useState(false);
  return <section className="panel vt-review" role="dialog" aria-label={en?"Rate your ride":"Califica tu viaje"}>
    <small>{en?"Ride completed":"Viaje finalizado"}</small><h2>{en?"How was your ride?":"¿Cómo estuvo tu viaje?"}</h2><p>{ride.destination}</p>
    <div className="stars">{[1,2,3,4,5].map(n=><button key={n} aria-label={n+"/5"} aria-pressed={n===stars} onClick={()=>rate(n===stars?0:n)}><Star fill={n<=stars?"currentColor":"none"}/></button>)}</div>
    <label>{en?"Optional comment":"Comentario opcional"}<textarea maxLength={1000} value={comment} onChange={e=>write(e.target.value)}/></label>
    <div className="vt-actions"><button className="outline" disabled={saving} onClick={done}>{en?"Not now":"Ahora no"}</button><button className="primary" disabled={saving||(!stars&&!comment.trim())} onClick={async()=>{save(true);if(await run("review",{id:ride.id,stars,comment}))done();save(false);}}>{en?"Send review":"Enviar reseña"}</button></div>
  </section>;
}
export function Chat({ride,me,en,offline,send,back}) {
  const key="vt-draft-"+me.id+"-"+ride.id;
  const [draft,setDraft]=useState(()=>{try{return JSON.parse(localStorage.getItem(key))||{text:""};}catch{return {text:""};}});
  const [busy,lock]=useState(false),[failure,fail]=useState(false);
  const end=useRef(null),guard=useRef(false);
  const peer=me.role==="driver"?ride.passengerName:ride.driverName;
  const delivered=draft.id && ride.messages.some(m=>m.clientId===draft.id && m.senderId===me.id);
  useEffect(()=>{if(delivered){setDraft({text:""});localStorage.removeItem(key);}},[delivered,key]);
  useEffect(()=>{end.current?.scrollIntoView({block:"nearest"});},[ride.messages.length,draft.id]);
  function update(v){setDraft(v);localStorage.setItem(key,JSON.stringify(v));}
  async function submit(e){e.preventDefault();if(guard.current||!draft.text.trim())return;
    const id=draft.id||globalThis.crypto?.randomUUID?.()||Date.now()+"-"+Math.random();
    update({...draft,id});if(offline)return;
    guard.current=true;lock(true);fail(false);
    try{await send("message",{id:ride.id,message:draft.text,clientId:id});update({text:""});}
    catch{fail(true);}finally{guard.current=false;lock(false);}
  }
  return <section className="panel vt-chat"><header><button className="vt-icon" aria-label={en?"Back to trip":"Volver al viaje"} onClick={back}><ArrowLeft/></button><div><strong>{peer}</strong><small>{me.role==="driver"?(en?"Passenger":"Pasajero"):(en?"Driver":"Conductor")}</small></div></header>
    <div className="vt-thread" role="log">{!ride.messages.length&&<p>{en?"Start a conversation about your ride.":"Escribe el primer mensaje del viaje."}</p>}
    {ride.messages.map((m,i)=><article key={m.clientId||i} className={(m.senderId?m.senderId===me.id:m.from===me.name)?"mine":""}><small>{m.from} · {new Date(m.time).toLocaleTimeString(en?"en-US":"es-US",{hour:"2-digit",minute:"2-digit"})}</small>{m.text}</article>)}
    {draft.id&&!delivered&&<article className="mine"><small>{en?"Pending delivery":"Pendiente de envío"}</small>{draft.text}</article>}<div ref={end}/></div>
    <form onSubmit={submit}><input aria-label={en?"Message":"Mensaje"} maxLength={1000} disabled={busy} placeholder={en?"Write a message…":"Escribe un mensaje…"} value={draft.text} onChange={e=>{update({text:e.target.value});fail(false);}}/><button className="primary" disabled={busy||!draft.text.trim()||(offline&&!!draft.id)}><Send size={17}/>{failure||draft.id?(en?"Retry":"Reintentar"):(en?"Send":"Enviar")}</button></form>
  </section>;
}
export function Inbox({api,trips,en,open,enable,offline}) {
  const [items,setItems]=useState(null),[error,setError]=useState(""),[attempt,retry]=useState(0);
  useEffect(()=>{let live=true;api("alerts").then(rows=>{if(live){setItems(rows);setError("");}}).catch(()=>{if(live)setError(en?"Could not load alerts.":"No se pudieron cargar los avisos.");});return()=>{live=false;};},[api,trips,en,attempt]);
  const names={message:en?"New ride message":"Mensaje del viaje",missed:en?"Missed call":"Llamada perdida",stop:en?"Stop added":"Nueva parada",accepted:en?"Ride accepted":"Viaje aceptado"};
  return <section className="panel vt-inbox"><h2>{en?"Alerts":"Avisos"}</h2><p>{offline?(en?"Reconnecting to dispatch…":"Reconectando con la central…"):(en?"Connected to dispatch":"Conectado con la central")}</p>
    <button className="outline" onClick={enable}><Bell size={16}/>{en?"Enable device notifications":"Activar notificaciones del dispositivo"}</button>
    {error?<p role="alert">{error} <button onClick={()=>retry(attempt+1)}>{en?"Retry":"Reintentar"}</button></p>:!items?<p>…</p>:!items.length?<p>{en?"Your ride updates will appear here.":"Aquí aparecerán los avisos de tus viajes."}</p>:items.map((item,i)=>{const Icon=item.kind==="missed"?PhoneMissed:item.kind==="message"?MessageCircle:Bell;return <button key={i} className="vt-notice" onClick={()=>open(item)}><Icon/><span><strong>{names[item.kind]||statusLabel(item.kind,en)}</strong><small>{item.destination} · {new Date(item.time).toLocaleString(en?"en-US":"es-US")}</small></span><ChevronRight size={16}/></button>;})}</section>;
}
