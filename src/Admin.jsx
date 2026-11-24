import { useState } from "react";
import { ArrowUpRight, CheckCircle2, CircleUserRound, ClipboardList, FileImage, Plus, Search, ShieldCheck, X } from "lucide-react";
import { DriverForm, DriverDocuments } from "./DriverForm";

export function Overview({data,en,navigate,TripCard,t}) {
  const pending=data.drivers.filter(d=>d.status==="pending").length;
  const approved=data.drivers.filter(d=>d.status==="approved").length;
  const cards=[
    {icon:ClipboardList,label:en?"Total rides":"Viajes totales",value:data.trips.length,sub:en?"Recorded rides":"Viajes registrados",tab:"trips"},
    {icon:CircleUserRound,label:en?"Pending review":"Pendientes de revisión",value:pending,sub:en?"Driver applications":"Solicitudes de conductores",tab:"drivers"},
    {icon:ShieldCheck,label:en?"Approved drivers":"Conductores aprobados",value:approved,sub:en?"Ready to drive":"Listos para conducir",tab:"drivers"}
  ];
  return <div className="admin-overview">
    <div className="overview-intro"><div><span className="admin-eyebrow">{en?"OPERATIONS OVERVIEW":"CENTRO DE OPERACIONES"}</span>
      <h2>{en?"Everything in its place.":"Todo bajo control."}</h2>
      <p>{en?"A clear view of your drivers and rides.":"Una vista clara de tus conductores y viajes."}</p></div>
      <div className="overview-stamp"><span>VICTORIA</span><strong>V<span>✦</span></strong><small>NEW JERSEY</small></div>
    </div>
    <div className="admin-metrics">{cards.map(({icon:Icon,label,value,sub,tab})=><button key={label} onClick={()=>navigate(tab)} className="metric-card">
      <span className="metric-head"><span className="metric-icon"><Icon size={20}/></span><ArrowUpRight size={18}/></span>
      <span className="metric-label">{label}</span><strong>{String(value).padStart(2,"0")}</strong><span className="metric-sub">{sub}</span>
    </button>)}</div>
    <div className="overview-columns"><section className="admin-section">
      <div className="section-top"><div><span className="admin-eyebrow">{en?"RECENT ACTIVITY":"ACTIVIDAD RECIENTE"}</span><h3>{en?"Recent rides":"Últimos viajes"}</h3></div>
      <button className="link-action" onClick={()=>navigate("trips")}>{en?"View all":"Ver todos"} <ArrowUpRight size={15}/></button></div>
      {data.trips.length?data.trips.slice(0,4).map(item=><TripCard key={item.id} item={item} t={t} drivers={data.drivers}/>):<div className="overview-empty"><span><ClipboardList size={22}/></span><strong>{en?"No rides yet":"Aún no hay viajes"}</strong><p>{en?"New rides will appear here.":"Los nuevos viajes aparecerán aquí."}</p></div>}
    </section><section className="admin-section review-summary">
      <div className="section-top"><div><span className="admin-eyebrow">{en?"DRIVER TEAM":"EQUIPO DE CONDUCTORES"}</span><h3>{en?"Applications":"Solicitudes"}</h3></div></div>
      <div className="review-count"><strong>{String(pending).padStart(2,"0")}</strong><span>{en?"waiting for your review":"esperando tu revisión"}</span></div>
      <p>{en?"Review each application and its documents.":"Revisa cada solicitud y sus documentos."}</p>
      <button className="dark-action" onClick={()=>navigate("drivers")}>{en?"Review drivers":"Revisar conductores"} <ArrowUpRight size={17}/></button>
    </section></div>
  </div>;
}

const details=[
  ["name","Nombre completo","Full name"],["brand","Marca","Make"],["model","Modelo","Model"],["color","Color","Color"],["plate","Placa","Plate"],["license","Licencia","License"]
];
export function DriverReview({data,en,update}) {
  const [query,setQuery]=useState("");
  const [selected,setSelected]=useState(null);
  const [register,setRegister]=useState(false);
  const [rejecting,setRejecting]=useState(false);
  const [reason,setReason]=useState("");
  const [problem,setProblem]=useState("");
  const driver=data.drivers.find(d=>d.id===selected);
  const filtered=data.drivers.filter(d=>(d.name+" "+(d.vehicle||"")+" "+(d.plate||"")).toLowerCase().includes(query.toLowerCase()));
  function decision(status) {
    if(!driver)return;
    if(status==="rejected"&&!reason.trim()){setProblem(en?"Enter a reason for rejection.":"Escribe el motivo del rechazo.");return;}
    try {
      update({...data,drivers:data.drivers.map(d=>d.id===driver.id?{...d,status,rejectionReason:status==="rejected"?reason.trim():""}:d)});
      setRejecting(false);setReason("");setProblem("");
    } catch {setProblem(en?"Could not save the decision.":"No se pudo guardar la decisión.");}
  }
  const label=d=>d.status==="pending"?(en?"Pending":"Pendiente"):d.status==="approved"?(en?"Approved":"Aprobado"):(en?"Rejected":"Rechazado");
  return <div className="drivers-page">
    <div className="drivers-intro"><div><span className="admin-eyebrow">{en?"DRIVER TEAM":"EQUIPO DE CONDUCTORES"}</span>
      <h2>{en?"Your drivers, in one place.":"Tu equipo, en un solo lugar."}</h2><p>{en?"Review applications and manage your drivers.":"Revisa las solicitudes y gestiona tus conductores."}</p></div>
      <button className="primary add-driver" onClick={()=>{setRegister(!register);setSelected(null);}}><Plus size={17}/>{en?"Add driver":"Registrar conductor"}</button></div>
    {register&&<DriverForm en={en} onSubmit={async d=>{update({...data,drivers:[...data.drivers,{...d,id:Date.now(),status:"pending",vehicle:d.brand+" "+d.model+" · "+d.color+" · "+d.plate,license:""}]});setRegister(false);}}/>}
    <div className="drivers-toolbar"><h3>{en?"All drivers":"Todos los conductores"} <span>{data.drivers.length}</span></h3><label className="driver-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={en?"Search driver or plate":"Buscar conductor o placa"} aria-label={en?"Search driver":"Buscar conductor"}/></label></div>
    <div className="driver-list">{filtered.length?filtered.map(d=><button key={d.id} className="driver-row" onClick={()=>{setSelected(d.id);setReason("");setRejecting(false);setProblem("");}}>
      <span className="driver-avatar">{d.name.split(" ").slice(0,2).map(x=>x[0]).join("").toUpperCase()}</span>
      <span className="driver-identity"><strong>{d.name}</strong><small>{d.vehicle||[d.brand,d.model,d.plate].filter(Boolean).join(" · ")||"—"}</small></span>
      <span className={"review-pill "+d.status}>{label(d)}</span><ArrowUpRight size={17}/></button>):<p className="list-empty">{en?"No drivers found.":"No se encontraron conductores."}</p>}</div>
    {driver&&<div className="drawer-layer" onClick={()=>setSelected(null)}><section className="driver-drawer" role="dialog" aria-modal="true" aria-labelledby="driver-title" onClick={e=>e.stopPropagation()}>
      <div className="drawer-top"><span className="admin-eyebrow">{en?"DRIVER APPLICATION":"SOLICITUD DE CONDUCTOR"}</span><button aria-label={en?"Close":"Cerrar"} className="icon-button" onClick={()=>setSelected(null)}><X size={20}/></button></div>
      <h2 id="driver-title">{driver.name}</h2><span className={"review-pill "+driver.status}>{label(driver)}</span>
      <h3>{en?"Driver and vehicle":"Datos del conductor y vehículo"}</h3><dl className="driver-details">{details.map(([key,es,english])=>driver[key]?<div key={key}><dt>{en?english:es}</dt><dd>{driver[key]}</dd></div>:null)}
      {!driver.brand&&driver.vehicle&&<div><dt>{en?"Vehicle":"Vehículo"}</dt><dd>{driver.vehicle}</dd></div>}</dl>
      <div className="document-heading"><FileImage size={18}/><h3>{en?"Submitted documents":"Documentos enviados"}</h3></div>
      {driver.documents?<DriverDocuments driver={driver} en={en} expanded/>:<p className="missing-docs">{en?"This demo profile has no attached documents.":"Este perfil de prueba no tiene documentos adjuntos."}</p>}
      {driver.rejectionReason&&driver.status==="rejected"&&<div className="reason-box"><strong>{en?"Reason for rejection":"Motivo del rechazo"}</strong><p>{driver.rejectionReason}</p></div>}
      {rejecting?<form className="reject-form" onSubmit={e=>{e.preventDefault();decision("rejected");}}><label htmlFor="reject-reason">{en?"Reason for rejection":"Motivo del rechazo"}</label><textarea id="reject-reason" required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} placeholder={en?"Explain what the driver needs to correct":"Explica qué debe corregir el conductor"}/>{problem&&<p className="error" role="alert">{problem}</p>}<div className="actions"><button type="button" className="outline" onClick={()=>{setRejecting(false);setProblem("");}}>{en?"Cancel":"Cancelar"}</button><button className="primary">{en?"Send rejection":"Enviar rechazo"}</button></div></form>:
      <div className="drawer-actions">{problem&&<p className="error" role="alert">{problem}</p>}<button className="outline" onClick={()=>{setRejecting(true);setReason(driver.rejectionReason||"");}}>{en?"Reject":"Rechazar"}</button><button className="primary" onClick={()=>decision("approved")}><CheckCircle2 size={17}/>{en?"Approve driver":"Aprobar conductor"}</button></div>}
    </section></div>}
  </div>;
}
