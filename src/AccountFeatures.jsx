import {useState} from "react";
import {driverPortrait} from "./driverPortrait";
import {PasswordInput} from "./TripScreens";
import {LogOut,UserRound} from "lucide-react";
export function Profile({me,en,api,reload,leave}){
 const [photo,setPhoto]=useState(null);
 const [name,setName]=useState(me.name),[currentPassword,setCurrent]=useState(""),[password,setPassword]=useState(""),[message,setMessage]=useState("");
 return <form className="panel vt-profile" onSubmit={async e=>{e.preventDefault();try{await api("profile",{name,currentPassword,password,...(photo?{portrait:await driverPortrait(photo,en)}:{})});await reload();setCurrent("");setPassword("");setMessage(en?"Changes saved.":"Cambios guardados.");}catch(error){setMessage(error.message);}}}>
 <header>{me.portrait?<img className="vt-profile-photo" src={me.portrait} alt={me.name}/>:<UserRound size={35}/>}<div><small>{me.role==="driver"?(en?"Driver":"Conductor"):(en?"Passenger":"Pasajero")}</small><h2>{me.name}</h2></div></header><label>{en?"Full name":"Nombre completo"}<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label><p>{me.email}</p>
 {me.role==="driver"&&<label>{en?"Driver photo for passengers":"Foto del conductor para los pasajeros"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setPhoto(e.target.files[0])}/></label>}
 {me.role==="driver"&&<p>{en?"Vehicle changes are managed by the administrator.":"Para modificar los datos del vehículo, contacta al administrador."}<br/>{me.vehicle}</p>}
 {me.email&&<details><summary>{en?"Change password":"Cambiar contraseña"}</summary><label>{en?"Current password":"Contraseña actual"}<PasswordInput en={en} value={currentPassword} onChange={e=>setCurrent(e.target.value)}/></label><label>{en?"New password, at least 10 characters":"Nueva contraseña, mínimo 10 caracteres"}<PasswordInput en={en} minLength={10} value={password} onChange={e=>setPassword(e.target.value)}/></label></details>}
 <button className="primary">{en?"Save":"Guardar"}</button>{message&&<p role="status">{message}</p>}<button className="outline sign-out" type="button" onClick={leave}><LogOut size={17}/>{en?"Sign out":"Cerrar sesión"}</button></form>;
}
export function Resubmit({en,api,reload}){
 const [files,setFiles]=useState({}),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 const photos=[["licensePhoto","Licencia","License"],["vehiclePhoto","Vehículo","Vehicle"],["registrationPhoto","Registro","Registration"],["insurancePhoto","Seguro","Insurance"]];
 return <details><summary>{en?"Correct and resend documents":"Corregir y reenviar documentos"}</summary><p>{en?"Select only the photos you need to replace.":"Selecciona los archivos que necesitas reemplazar. Los demás se conservarán."}</p><form onSubmit={async e=>{e.preventDefault();setBusy(true);try{const documents={};for(const [key,file] of Object.entries(files)){if(!["image/jpeg","image/png","image/webp","application/pdf"].includes(file.type)||file.size>10*1024*1024)throw Error(en?"Use JPG, PNG, WebP or PDF up to 10 MB.":"Usa JPG, PNG, WebP o PDF de máximo 10 MB.");documents[key]=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});}await api("resubmit",{documents});await reload();}catch(error){setMessage(error.message);}finally{setBusy(false);}}}>
 {photos.map(([key,es,english])=><label key={key}>{en?english:es}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.pdf" onChange={e=>setFiles({...files,[key]:e.target.files[0]})}/></label>)}<button className="primary" disabled={busy}>{en?"Send for review":"Enviar para revisión"}</button>{message&&<p role="alert">{message}</p>}</form></details>;
}
export function VehicleEditor({driver,en,api,reload}){
 const [v,setV]=useState({brand:driver.brand||"",model:driver.model||"",color:driver.color||"",plate:driver.plate||""}),[msg,setMsg]=useState("");
 return <details><summary>{en?"Edit vehicle":"Editar vehículo"}</summary><form onSubmit={async e=>{e.preventDefault();try{await api("vehicle",{id:driver.id,...v});await reload();setMsg(en?"Saved":"Guardado");}catch(error){setMsg(error.message);}}}>{[["brand","Marca","Make"],["model","Modelo","Model"],["color","Color","Color"],["plate","Placa","Plate"]].map(([k,es,english])=><label key={k}>{en?english:es}<input required maxLength={100} value={v[k]} onChange={e=>setV({...v,[k]:e.target.value})}/></label>)}<button className="primary">{en?"Save":"Guardar"}</button>{msg&&<p role="status">{msg}</p>}</form></details>;
}
