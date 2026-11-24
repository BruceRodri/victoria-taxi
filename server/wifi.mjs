import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.VT_PORT || 5191);
const ip = process.env.VT_WIFI_IP;
if (!ip || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) throw Error("Set VT_WIFI_IP to the computer's Wi-Fi IPv4 address.");
const dir = path.join(root, ".wifi-test", String(port));
fs.mkdirSync(dir, {recursive:true});
const file = path.join(dir,"session.json");
const token = () => randomBytes(18).toString("hex");
let session = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) :
  {passenger:token(),driver:token(),ride:null};
function save(next) {
  fs.writeFileSync(file+".tmp",JSON.stringify(next)); fs.renameSync(file+".tmp",file); session=next;
}
save(session);
const host = "http://"+ip+":"+port;
const joinPath = "/join/"+session.driver;
const mobileLink = host+joinPath;
const qr = await QRCode.toBuffer(mobileLink,{width:240,margin:2});
let lastSeen=0;
const apk = path.join(root,"android/app/build/outputs/apk/debug/app-debug.apk");
const types = {".html":"text/html; charset=utf-8",".js":"text/javascript",".css":"text/css",".webp":"image/webp",".png":"image/png",".svg":"image/svg+xml"};
const active = () => ["waiting","accepted","arrived","in_progress"].includes(session.ride?.status);
const snapshot = () => ({ride:session.ride,driverOnline:Date.now()-lastSeen<16000});
function reply(res,status,data,type="application/json") {
  res.writeHead(status,{"Content-Type":type,"Cache-Control":"no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"});
  res.end(type==="application/json"?JSON.stringify(data):data);
}
async function handle(req,res) {
  const url = new URL(req.url,"http://localhost");
  const p=url.pathname;
  const local=req.socket.localAddress==="127.0.0.1" && req.socket.remoteAddress==="127.0.0.1" && req.headers.host==="127.0.0.1:"+port;
  if(p==="/pc" && local) {res.writeHead(302,{Location:"/#wifi=passenger."+session.passenger});return res.end();}
  if(p==="/pair.png" && local) return reply(res,200,qr,"image/png");
  if(p===joinPath) {
    const deep="victoriataxi://pair?host="+encodeURIComponent(host)+"&key="+session.driver;
    return reply(res,200,'<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Victoria-Taxi · Android</title><style>body{font:18px/1.6 system-ui;background:#f7f6f2;color:#182839;max-width:480px;margin:8vh auto;padding:20px}a{display:block;background:#203c59;color:white;text-decoration:none;border-radius:12px;padding:12px 16px;margin:12px 0}small{color:#49576a}</style><h1>Conecta tu Android</h1><p>Instala la versión Wi-Fi de Victoria-Taxi. Después vuelve a esta página y pulsa el segundo botón.</p><a href="'+joinPath+'/Victoria-Taxi.apk">1 · Descargar APK de prueba</a><a href="'+deep+'">2 · Conectar como Diego</a><small>Para probar sin instalar, mantén el navegador abierto.</small><a href="/#wifi=driver.'+session.driver+'">Probar en el navegador</a></html>',types[".html"]);
  }
  if(p===joinPath+"/Victoria-Taxi.apk" && fs.existsSync(apk)) {
    res.writeHead(200,{"Content-Type":"application/vnd.android.package-archive","Content-Disposition":"attachment; filename=Victoria-Taxi.apk","Content-Length":fs.statSync(apk).size});return fs.createReadStream(apk).pipe(res);
  }
  if(p.startsWith("/api/")) {
    const key=req.headers.authorization?.replace(/^Bearer /,"");
    const role=key===session.driver?"driver":key===session.passenger?"passenger":null;
    if(!role) return reply(res,403,{error:"Vinculación inválida."});
    if(req.method==="GET" && p==="/api/state") return reply(res,200,{...snapshot(),join:role==="passenger"?mobileLink:undefined});
    if(req.method==="GET" && p==="/api/offers" && role==="driver") {
      lastSeen=Date.now();return reply(res,200,{id:session.ride?.status==="waiting"?session.ride.id:""});
    }
    if(req.method!=="POST" || p!=="/api/action") return reply(res,404,{});
    let raw="";for await(const chunk of req){raw+=chunk;if(raw.length>1500000)return reply(res,413,{});}
    const {action,ride,id,message,fix,leg}=JSON.parse(raw);
    let next=session.ride;
    if(action==="create" && role==="passenger" && !active()){
      if(!ride || !Array.isArray(ride.path)||ride.path.length<2||typeof ride.origin!=="string"||typeof ride.destination!=="string"||!(ride.distance>0)||!(ride.minutes>0))return reply(res,400,{error:"Ruta inválida."});
      next={...ride,id:randomUUID(),status:"waiting",fare:Math.round(ride.distance*300)/100,messages:[]};
    } else if(action==="heartbeat" && role==="driver"){lastSeen=Date.now();return reply(res,200,snapshot());}
    else if(next && next.id===id) {
      if(action==="accept" && role==="driver" && next.status==="waiting")next={...next,status:"accepted"};
      else if(action==="arrive" && role==="driver" && next.status==="accepted")next={...next,status:"arrived"};
      else if(action==="start" && role==="driver" && next.status==="arrived")next={...next,status:"in_progress"};
      else if(action==="finish" && (role==="passenger" ? ["accepted","arrived","in_progress"].includes(next.status) : next.status==="in_progress")) {
        if(role==="driver") {
          const point=fix?.point, dest=next.destinationPoint;
          if(!Array.isArray(point)||!Array.isArray(dest)||!Number.isFinite(fix.time)||Math.abs(Date.now()-fix.time)>120000 ||
            Math.hypot((point[0]-dest[0])*111320,(point[1]-dest[1])*111320*Math.cos(dest[0]*Math.PI/180))>100)
            return reply(res,409,{error:"Necesitas una ubicación GPS reciente a menos de 100 metros del destino."});
        }
        next={...next,status:"completed"};
      }
      else if(action==="cancel" && role==="passenger" && next.status==="waiting")next={...next,status:"cancelled"};
      else if(action==="add-destination" && role==="passenger" && ["accepted","arrived","in_progress"].includes(next.status) && Array.isArray(leg?.destinationPoint) && typeof leg?.destination==="string") {
        const start=next.destinationPoint, end=leg.destinationPoint;
        if(!Array.isArray(start) || !end.every(Number.isFinite) || Math.abs(end[0])>90 || Math.abs(end[1])>180) return reply(res,400,{error:"Destino inválido."});
        const url = "https://router.project-osrm.org/route/v1/driving/"+start[1]+","+start[0]+";"+end[1]+","+end[0]+"?overview=simplified&geometries=geojson&radiuses=1000;1000";
        const response=await fetch(url,{signal:AbortSignal.timeout(12000)});
        const body=await response.json(); const route=body.routes?.[0];
        if(!response.ok||body.code!=="Ok"||!route?.distance||!route.geometry?.coordinates?.length) return reply(res,502,{error:"No se pudo calcular la ruta."});
        if(session.ride?.id!==id || !["accepted","arrived","in_progress"].includes(session.ride?.status) || session.ride.destinationPoint?.join(",")!==start.join(",")) return reply(res,409,{error:"El viaje cambió, vuelve a intentarlo."});
        const miles=Math.round(route.distance/1609.344*100)/100;
        const segments=next.segments||[{destination:next.destination,distance:next.distance,fare:next.fare}];
        next={...next,destination:leg.destination,destinationPoint:end,distance:Math.round((next.distance+miles)*100)/100,
          minutes:next.minutes+Math.round(route.duration/60),path:[...(next.path||[]),...route.geometry.coordinates.map(([lon,lat])=>[lat,lon])],
          fare:Math.round((next.fare+miles*3)*100)/100,segments:[...segments,{destination:leg.destination,distance:miles,fare:Math.round(miles*300)/100}]};
      }
      else if(action==="message" && ["accepted","arrived","in_progress"].includes(next.status) && typeof message==="string" && message.trim())next={...next,messages:[...next.messages,{role,text:message.trim().slice(0,1000)}].slice(-100)};
      else return reply(res,409,{error:"El viaje ya cambió."});
    }else return reply(res,409,{error:"El viaje ya cambió."});
    save({...session,ride:next});return reply(res,200,snapshot());
  }
  const rel=p==="/"?"index.html":p.slice(1);
  if(!/^(index\.html|victoria-newark\.webp|assets\/[\w.-]+)$/.test(rel))return reply(res,404,{});
  const asset=path.join(root,"dist",rel);
  if(!fs.existsSync(asset))return reply(res,404,{});
  res.writeHead(200,{"Content-Type":types[path.extname(asset)]||"application/octet-stream","Referrer-Policy":"strict-origin-when-cross-origin"});fs.createReadStream(asset).pipe(res);
}
for (const addr of new Set(["127.0.0.1",ip])) http.createServer((req,res)=>handle(req,res).catch(()=>reply(res,400,{error:"Solicitud inválida."}))).listen(port,addr);
console.log("PC: http://127.0.0.1:"+port+"/pc");
