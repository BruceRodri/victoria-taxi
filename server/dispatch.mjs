import { apnsConfigured, sendApple } from "./apple-push.mjs";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { DatabaseSync } from "node:sqlite";
import {
  createHmac,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import * as webpush from "web-push";

const derive = promisify(scrypt);
const active = (r) =>
  ["waiting", "accepted", "arrived", "in_progress"].includes(r.status);
const requireThat = (
  ok,
  message = "El viaje cambió. Actualiza e inténtalo otra vez.",
  status = 409,
) => {
  if (!ok) throw Object.assign(new Error(message), { status });
};
const short = (s, max = 240) =>
  typeof s === "string" && s.trim().length > 0 && s.length <= max;
const point = (p) =>
  Array.isArray(p) &&
  p.length === 2 &&
  p.every(Number.isFinite) &&
  Math.abs(p[0]) <= 90 &&
  Math.abs(p[1]) <= 180;
const meters = (a, b) =>
  Math.hypot(
    (a[0] - b[0]) * 111320,
    (a[1] - b[1]) * 111320 * Math.cos((b[0] * Math.PI) / 180),
  );
const digest = (v) => createHash("sha256").update(v).digest("hex");
const round = (n) => Math.round(n * 100) / 100;
const initialRates = { perMile: 3, weather: 0, traffic: 0 };
const maxDocumentBytes = 10 * 1024 * 1024;
function validatedPortrait(value){
  requireThat(typeof value==="string" && value.length<=160000 && value.startsWith("data:image/jpeg;base64,") && validDocument(value),"Foto de perfil inválida.",400);
  return value;
}
function validDocument(value) {
  if (typeof value !== "string") return false;
  const match = /^data:(?:image\/(?:jpeg|png|webp)|application\/pdf);base64,([A-Za-z0-9+/]*={0,2})$/.exec(value);
  return !!match && match[1].length > 0 && match[1].length <= Math.ceil(maxDocumentBytes / 3) * 4 && Buffer.byteLength(match[1], "base64") <= maxDocumentBytes;
}

export function dispatch({
  demo = false,
  lanTest = false,
  dir = process.env.VT_DATA_DIR ||
    path.join(homedir(), ".victoria-taxi", demo ? "preview" : "service"),
} = {}) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(dir, "service.sqlite"));
  db.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records(kind TEXT,id TEXT,value TEXT,PRIMARY KEY(kind,id)); CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user TEXT,expires INTEGER)",
  );
  db.exec(
    "UPDATE sessions SET expires=253402300799999 WHERE expires > " + Date.now(),
  );
  const get = (kind, id) =>
    JSON.parse(
      db
        .prepare("SELECT value FROM records WHERE kind=? AND id=?")
        .get(kind, id)?.value || "null",
    );
  const all = (kind) =>
    db
      .prepare("SELECT value FROM records WHERE kind=? ORDER BY rowid DESC")
      .all(kind)
      .map((r) => JSON.parse(r.value));
  const sockets = new Set();
  const authenticated = (key) =>
    db
      .prepare("SELECT user FROM sessions WHERE token=? AND expires>?")
      .get(key, Date.now());
  const put = (kind, id, value) => {
    const previous = kind === "ride" ? get(kind, id) : null;
    db.prepare("INSERT OR REPLACE INTO records VALUES(?,?,?)").run(
      kind,
      id,
      JSON.stringify(value),
    );
    if (
      kind === "ride" &&
      value &&
      (!previous ||
        previous.status !== value.status ||
        previous.segments?.length !== value.segments?.length)
    ) {
      db.prepare("INSERT INTO records VALUES(?,?,?)").run(
        "event",
        randomUUID(),
        JSON.stringify({
          rideId: id,
          time: Date.now(),
          status: value.status,
          destination: value.destination,
        }),
      );
    }
    if (["ride", "user", "presence", "config"].includes(kind)) {
      for (const client of sockets) {
        if (!authenticated(client.sessionKey)) {
          client.close(1008, "Session expired");
          continue;
        }
        if (
          client.readyState === WebSocket.OPEN &&
          client.bufferedAmount < 65536
        )
          client.send("changed");
      }
    }
  };
  const users = () => all("user"),
    rides = () => all("ride"),
    rates = () => get("config", "rates") || initialRates;
  const vapid = get("config", "vapid") || webpush.generateVAPIDKeys();
  put("config", "vapid", vapid);
  const api = express.Router();
  api.use(express.json({ limit: "56mb" }));
  api.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  const local = (req) =>
    lanTest || (demo &&
    ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
      req.socket.remoteAddress,
    ) &&
    ["localhost", "127.0.0.1", "[::1]"].includes(req.hostname) &&
    !req.headers["x-forwarded-for"]);
  api.get("/info", (req, res) =>
    res.json({
      demo: local(req),
      pushKey: vapid.publicKey,
      nativePush: {
        android: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS),
        ios: apnsConfigured(),
      },
    }),
  );
  async function credentials(email, password) {
    requireThat(
      short(email, 180) &&
        /^\S+@\S+\.\S+$/.test(email) &&
        short(password, 128) &&
        password.length >= 10,
      "Usa un correo válido y una contraseña de al menos 10 caracteres.",
      400,
    );
    const salt = randomBytes(16).toString("hex");
    return {
      email: email.trim().toLowerCase(),
      salt,
      hash: (await derive(password, salt, 64)).toString("hex"),
    };
  }
  function session(res, user) {
    const token = randomBytes(32).toString("hex");
    db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
    db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
      digest(token),
      user.id,
      253402300799999,
    );
    res.json({ token });
  }
  const attempts = new Map();
  api.use(["/login", "/register"], (req, _res, next) => {
    const key = req.socket.remoteAddress,
      now = Date.now(),
      bucket = attempts.get(key);
    if (!bucket || now > bucket.until)
      attempts.set(key, { n: 1, until: now + 60000 });
    else
      requireThat(
        ++bucket.n <= 25,
        "Demasiados intentos. Espera un minuto.",
        429,
      );
    next();
  });
  api.post("/demo", (req, res) => {
    requireThat(local(req), "Solo disponible en la vista local.", 403);
    const names = {
      driver: "Diego Torres",
      passenger: "Sofía Reyes",
      admin: "Valeria Cruz",
    };
    const role = req.body.role;
    requireThat(Object.hasOwn(names, role));
    const id = "demo-" + role;
    if (!get("user", id))
      put("user", id, {
        id,
        role,
        name: names[role],
        status: "approved",
        vehicle: role === "driver" ? "Toyota Camry · Plata · NJ DEMO 01" : undefined,
      });
    session(res, get("user", id));
  });
  api.post("/login", async (req, res) => {
    const { email, password } = req.body;
    requireThat(
      short(email, 180) && short(password, 128),
      "Credenciales inválidas.",
      401,
    );
    let u = users().find((x) => x.email === email.trim().toLowerCase());
    if (
      !u &&
      email.toLowerCase() === process.env.VT_ADMIN_EMAIL?.toLowerCase() &&
      process.env.VT_ADMIN_PASSWORD === password
    ) {
      const creds = await credentials(email, password);
      u = {
        id: "administrator",
        role: "admin",
        name: "Administración",
        ...creds,
      };
      put("user", u.id, u);
    }
    const hash = await derive(password, u?.salt || "victoria-sign-in", 64);
    requireThat(
      u?.hash && timingSafeEqual(hash, Buffer.from(u.hash, "hex")),
      "Credenciales inválidas.",
      401,
    );
    session(res, u);
  });
  async function register(body) {
    const { name, role, email, password } = body;
    requireThat(
      short(name, 100) && ["passenger", "driver"].includes(role),
      "Revisa los datos de registro.",
      400,
    );
    const u = {
      ...(await credentials(email, password)),
      name: name.trim(),
      id: randomUUID(),
      role,
      status: role === "driver" ? "pending" : "approved",
    };
    requireThat(
      u.email !== process.env.VT_ADMIN_EMAIL?.toLowerCase(),
      "Correo reservado.",
      400,
    );
    if (role === "driver") {
      for (const k of ["brand", "model", "color", "plate"]) {
        requireThat(short(body[k], 100), "Faltan datos del vehículo.", 400);
        u[k] = body[k].trim();
      }
      requireThat(body.portrait,"La foto del conductor es obligatoria.",400);
      u.portrait=validatedPortrait(body.portrait);
      const docs = {};
      for (const k of [
        "vehiclePhoto",
        "licensePhoto",
        "insurancePhoto",
        "registrationPhoto",
      ]) {
        const photo = body.documents?.[k];
        requireThat(
          validDocument(photo),
          "Se necesitan cuatro archivos JPG, PNG, WebP o PDF de máximo 10 MB cada uno.",
          400,
        );
        docs[k] = photo;
      }
      u.vehicle = [u.brand + " " + u.model, u.color, u.plate].join(" · ");
      requireThat(
        !users().some((x) => x.email === u.email),
        "El correo ya está registrado.",
      );
      put("docs", u.id, docs);
    }
    requireThat(
      !users().some((x) => x.email === u.email),
      "El correo ya está registrado.",
    );
    put("user", u.id, u);
    return u;
  }
  api.post("/register", async (req, res) =>
    session(res, await register(req.body)),
  );
  api.use((req, res, next) => {
    const key = digest(
      req.headers.authorization?.replace(/^Bearer /, "") || "",
    );
    const row = db
      .prepare("SELECT user FROM sessions WHERE token=? AND expires>?")
      .get(key, Date.now());
    requireThat(row, "Inicia sesión para continuar.", 401);
    req.user = get("user", row.user);
    req.key = key;
    next();
  });
  api.post("/profile", async (req, res) => {
    const u = get("user", req.user.id);
    requireThat(short(req.body.name, 100), "Escribe tu nombre.", 400);
    if (req.body.password) {
      requireThat(
        u.hash && short(req.body.currentPassword, 128),
        "Ingresa tu contraseña actual.",
        400,
      );
      const hash = await derive(req.body.currentPassword, u.salt, 64);
      requireThat(
        timingSafeEqual(hash, Buffer.from(u.hash, "hex")),
        "Contraseña actual incorrecta.",
        403,
      );
      Object.assign(u, await credentials(u.email, req.body.password));
    }
    if(req.body.portrait && u.role==="driver")u.portrait=validatedPortrait(req.body.portrait);
    u.name = req.body.name.trim();
    put("user", u.id, u);
    res.json({});
  });
  api.post("/favorites", (req,res) => {
    requireThat(req.user.role==="passenger","Acceso restringido.",403);
    const list=req.body.favorites;
    requireThat(Array.isArray(list)&&list.length<=10&&list.every(x=>short(x.label,40)&&short(x.name,500)&&point(x.point)),"Lugar inválido.",400);
    const u=get("user",req.user.id);u.favorites=list;put("user",u.id,u);res.json({});
  });
  api.post("/vehicle", (req, res) => {
    requireThat(req.user.role === "admin", "Acceso restringido.", 403);
    const u = get("user", req.body.id);
    requireThat(u?.role === "driver", "Conductor no encontrado.", 404);
    for (const key of ["brand", "model", "color", "plate"]) {
      requireThat(
        short(req.body[key], 100),
        "Completa los datos del vehículo.",
        400,
      );
      u[key] = req.body[key].trim();
    }
    u.vehicle = [u.brand + " " + u.model, u.color, u.plate].join(" · ");
    put("user", u.id, u);
    res.json({});
  });
  api.post("/resubmit", (req, res) => {
    const u = get("user", req.user.id);
    requireThat(
      u.role === "driver" && u.status === "rejected",
      "La solicitud no se puede reenviar.",
      403,
    );
    const old = get("docs", u.id) || {},
      docs = { ...old };
    for (const key of [
      "licensePhoto",
      "vehiclePhoto",
      "registrationPhoto",
      "insurancePhoto",
    ]) {
      const photo = req.body.documents?.[key] || old[key];
      requireThat(
        validDocument(photo),
        "Adjunta archivos JPG, PNG, WebP o PDF de máximo 10 MB cada uno.",
        400,
      );
      docs[key] = photo;
    }
    put("docs", u.id, docs);
    put("user", u.id, { ...u, status: "pending", rejectionReason: "" });
    res.json({});
  });
  api.post("/logout", (req, res) => {
    db.prepare("DELETE FROM sessions WHERE token=?").run(req.key);
    for (const client of sockets)
      if (client.sessionKey === req.key) client.close(1008, "Signed out");
    put("presence", req.user.id, null);
    put("push", req.user.id, null);
    res.json({});
  });
  const mine = (r, u) => r.passengerId === u.id || r.driverId === u.id;
  const present = (id) => {
    const p = get("presence", id);
    return p && Math.abs(Date.now() - p.time) < 120000 ? p : null;
  };
  const near = (u, r) =>
    u.role === "driver" &&
    u.status === "approved" &&
    present(u.id) &&
    meters(present(u.id).point, r.originPoint) <= 16093.44;
  function safe(u) {
    const { hash: _hash, salt: _salt, ...rest } = u;
    return rest;
  }
  async function notify(id, body, data={}) {
    const sub = get("push", id);
    if (!sub) return;
    try {
      if (sub.platform === "ios" && sub.token) {
        await sendApple(sub.token, body,data);
      } else if (sub.token) {
        const { getApps, initializeApp } = await import("firebase-admin/app");
        const { getMessaging } = await import("firebase-admin/messaging");
        if (!getApps().length) initializeApp();
        await getMessaging().send({
          token: sub.token,
          ...(data.kind==="arrival"?{android:{priority:"high",ttl:300000}}:{notification:{title:"Victoria-Taxi",body}}),data,
        });
      } else
        await webpush.sendNotification(
          sub,
          JSON.stringify({ title: "Victoria-Taxi", body,...data }),
          {
            vapidDetails: {
              subject:
                process.env.VT_PUSH_CONTACT || "mailto:dispatch@example.org",
              ...vapid,
            },
          },
        );
    } catch (e) {
      if ([404, 410].includes(e.statusCode)) put("push", id, null);
    }
  }
  api.get("/ice", (req, res) => {
    const servers = [{ urls: "stun:stun.l.google.com:19302" }];
    if (process.env.VT_TURN_URL && process.env.VT_TURN_SECRET) {
      const username = Math.floor(Date.now() / 1000 + 3600) + ":" + req.user.id;
      servers.push({
        urls: process.env.VT_TURN_URL,
        username,
        credential: createHmac("sha1", process.env.VT_TURN_SECRET)
          .update(username)
          .digest("base64"),
      });
    }
    res.json(servers);
  });
  function dispatchOffers() {
    for (const ride of rides().filter(r => r.status === "waiting")) {
      const excluded = ride.offerExcluded || [];
      if (ride.offerDriverId && ride.offerUntil > Date.now()) continue;
      if (ride.offerDriverId) excluded.push(ride.offerDriverId);
      const candidate = users().filter(u => near(u,ride) && !excluded.includes(u.id) && !rides().some(r=>active(r)&&r.driverId===u.id) && !rides().some(r=>r.id!==ride.id&&r.status==="waiting"&&r.offerDriverId===u.id&&r.offerUntil>Date.now()))
        .sort((a,b)=>meters(present(a.id).point,ride.originPoint)-meters(present(b.id).point,ride.originPoint))[0];
      if (candidate || ride.offerDriverId) {
        ride.offerExcluded=excluded;
        ride.offerDriverId=candidate?.id || null;
        ride.offerUntil=candidate ? Date.now()+60000 : null;
        put("ride",ride.id,ride);
        if(candidate) void notify(candidate.id,"Hay una solicitud de viaje cerca de ti.");
      }
    }
  }
  const offerTimer=setInterval(dispatchOffers,1000);
  offerTimer.unref();
  api.post("/push", (req, res) => {
    const sub = req.body;
    if (sub.token)
      requireThat(
        short(sub.token, 4096) &&
          (sub.platform === "ios"
            ? apnsConfigured() && /^[a-f0-9]{64,}$/i.test(sub.token)
            : sub.platform === "android" &&
              process.env.GOOGLE_APPLICATION_CREDENTIALS),
        "Push móvil pendiente de configuración.",
        503,
      );
    else {
      const url = new URL(sub.endpoint);
      requireThat(
        url.protocol === "https:" &&
          !url.port &&
          !url.username &&
          !url.password &&
          /^(fcm\.googleapis\.com|android\.googleapis\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)*notify\.windows\.com|([a-z0-9-]+\.)*wns\.windows\.com|([a-z0-9-]+\.)*push\.microsoft\.com|([a-z0-9-]+\.)*push\.apple\.com)$/.test(
            url.hostname,
          ) &&
          short(sub.keys?.auth, 128) &&
          short(sub.keys?.p256dh, 256),
        "Suscripción inválida.",
        400,
      );
    }
    for (const row of db
      .prepare("SELECT id,value FROM records WHERE kind='push'")
      .all()) {
      const old = JSON.parse(row.value);
      if (
        old &&
        row.id !== req.user.id &&
        (sub.token ? sub.token === old.token : sub.endpoint === old.endpoint)
      )
        put("push", row.id, null);
    }
    put("push", req.user.id, sub);
    res.json({});
  });
  // Preview and confirmation share a server-verified driving route.
  const routeCache = new Map();
  async function roadLeg(from,to) {
    requireThat(point(from) && point(to),"Ruta inválida.",400);
    const key=[from,to].map(([lat,lng])=>lng.toFixed(6)+","+lat.toFixed(6)).join(";");
    const hit=routeCache.get(key);
    if(hit && Date.now()-hit.at<300000)return hit.leg;
    const url="https://router.project-osrm.org/route/v1/driving/"+key+"?overview=simplified&geometries=geojson&radiuses=1000;1000";
    for(let attempt=0;attempt<2;attempt++){
      let data;
      try { data=await (await fetch(url,{signal:AbortSignal.timeout(8500)})).json(); } catch { continue; }
      requireThat(!["NoRoute","NoSegment"].includes(data.code),"No hay ruta en auto. Mueve el punto en el mapa.",422);
      const leg=data.routes?.[0];
      if(leg?.distance>0 && leg.duration>0 && leg.geometry?.coordinates?.length){
        if(routeCache.size>=256)routeCache.delete(routeCache.keys().next().value);
        routeCache.set(key,{leg,at:Date.now()});
        return leg;
      }
    }
    requireThat(false,"El servicio de rutas no responde. Conservamos tus puntos. Reintenta.",503);
  }
  api.post("/route",async(req,res)=>{
    const leg=await roadLeg(req.body.from,req.body.to);
    res.json({distance:Math.max(0.01,round(leg.distance/1609.344)),minutes:Math.max(1,Math.round(leg.duration/60)),path:leg.geometry.coordinates.map(([x,y])=>[y,x])});
  });
  api.get("/alerts",(req,res)=>{
    const entries=[];
    for(const ride of rides().filter(r=>mine(r,req.user))){
      const add=(kind,time,detail="")=>entries.push({rideId:ride.id,kind,time,detail,destination:ride.destination});
      const events=db.prepare("SELECT value FROM records WHERE kind='event' AND json_extract(value,'$.rideId')=? ORDER BY rowid").all(ride.id);
      let previous;
      for(const row of events){
        const e=JSON.parse(row.value);
        add(e.status===previous?"stop":e.status,e.time,e.destination);
        previous=e.status;
      }
      for(const m of ride.messages || [])if(m.senderId?m.senderId!==req.user.id:m.from!==req.user.name)add("message",m.time,m.from);
      for(const c of ride.callLog || [])if(c.to===req.user.id && !c.answered && !c.declined && (ride.call?.id!==c.id || Date.now()-c.at>=90000))add("missed",c.at);
    }
    res.json(entries.sort((a,b)=>b.time-a.time));
  });
  api.get("/trip-alerts/:id",(req,res)=>{
    const ride=get("ride",req.params.id);
    requireThat(ride && mine(ride,req.user),"Viaje no disponible.",403);
    const rows=db.prepare("SELECT json_extract(value,'$.status') AS status FROM records WHERE kind='event' AND json_extract(value,'$.rideId')=? ORDER BY rowid").all(ride.id);
    const call=ride.call;
    const incoming=call && !call.answer && call.from!==req.user.id && Date.now()-call.at<90000 ? {id:call.id,at:call.at,caller:req.user.id===ride.driverId?ride.passengerName:ride.driverName} : null;
    const messages=(ride.messages||[]).filter(m=>m.senderId?m.senderId!==req.user.id:m.from!==req.user.name);
    res.json({incoming,messageCount:messages.length,messageFrom:messages.at(-1)?.from,pickupReply:messages.at(-1)?.pickupReply,statuses:[...new Set([...rows.map(row=>row.status),ride.status])]});
  });
  api.get("/state", (req, res) => {
    dispatchOffers();
    const u = req.user,
      admin = u.role === "admin";
    const list = rides().sort((a, b) => b.created - a.created),
      busy = list.some((r) => active(r) && mine(r, u));
    const trips = list
      .filter(
        (r) =>
          admin ||
          mine(r, u) ||
          (r.status === "waiting" && !busy && r.offerDriverId === u.id && r.offerUntil > Date.now() && near(u, r)),
      )
      .map((r) => ({
        ...r,
        driverPoint:
          active(r) && r.driverId ? (r.lastFix || present(r.driverId))?.point : undefined,
        driverFixTime:active(r) && r.driverId ? (r.lastFix || present(r.driverId))?.time : undefined,
        call: admin || (r.call && !r.call.answer && Date.now()-r.call.at >= 90000) ? undefined : r.call,
      }));
    res.json({
      me: safe(u),
      hasPush: Boolean(get("push",u.id)),
      rates: rates(),
      trips,
      drivers: admin
        ? users()
            .filter((x) => x.role === "driver")
            .map(safe)
        : [],
      pushKey: vapid.publicKey,
    });
  });
  api.get("/ride-vehicle/:id",(req,res)=>{
    const ride=get("ride",req.params.id);
    requireThat(ride && active(ride) && ride.passengerId===req.user.id && ride.driverId,"Viaje no disponible.",403);
    const driver=get("user",ride.driverId);
    const image=get("docs",ride.driverId)?.vehiclePhoto;
    res.json({portrait:driver?.portrait||null,photo:image?.startsWith("data:image/")?image:null});
  });
  api.get("/documents/:id", (req, res) => {
    requireThat(req.user.role === "admin", "Acceso restringido.", 403);
    res.json(get("docs", req.params.id) || {});
  });
  api.post("/driver", async (req, res) => {
    requireThat(req.user.role === "admin", "Acceso restringido.", 403);
    await register({ ...req.body, role: "driver" });
    res.json({});
  });
  api.post("/presence", (req, res) => {
    requireThat(
      req.user.role === "driver" && req.user.status === "approved",
      "Se requiere aprobación.",
      403,
    );
    const p = req.body.fix;
    requireThat(
      !p ||
        (point(p.point) &&
          Number.isFinite(p.time) &&
          Math.abs(Date.now() - p.time) < 120000),
      "Actualiza tu ubicación.",
    );
    if (p) {
      if(get("presence",req.user.id)?.time>p.time)return res.json({});
      const current = rides().find(
        (r) => r.driverId === req.user.id && active(r),
      );
      if (current) {
        if(current.lastFix?.time>p.time)return res.json({});
        current.lastFix={point:p.point,time:p.time};
        const trail = current.trail || [],
          last = trail.at(-1);
        if (current.status==="in_progress" && (!last || meters(last, p.point) > 25)) {
          current.trail = [...trail, p.point];
        }
        put("ride",current.id,current);
      }
    }
    put("presence", req.user.id, p ? { time: p.time, point: p.point } : null);
    res.json({});
  });
  api.post("/action", async (req, res) => {
    const b = req.body,
      u = req.user,
      a = b.action;
    if (a === "decision" || a === "rates") {
      requireThat(u.role === "admin", "Acceso restringido.", 403);
      if (a === "rates") {
        const next = {};
        for (const key of Object.keys(initialRates)) {
          const v = b.rates?.[key];
          requireThat(
            typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 10000,
            "Tarifa inválida.",
            400,
          );
          next[key] = round(v);
        }
        put("config", "rates", next);
      } else {
        const d = get("user", b.id);
        requireThat(
          d?.role === "driver" &&
            ["approved", "rejected"].includes(b.status) &&
            (b.status !== "rejected" || short(b.reason, 1000)),
        );
        put("user", d.id, {
          ...d,
          status: b.status,
          rejectionReason: b.status === "rejected" ? b.reason : "",
        });
        void notify(d.id, "Hay una actualización de tu solicitud.");
      }
      return res.json({});
    }
    if (a === "create" || a === "stop") {
      requireThat(u.role === "passenger", "Acceso restringido.", 403);
      const start = a === "stop" ? get("ride", b.id) : null;
      const from = start?.destinationPoint || b.originPoint,
        to = b.destinationPoint;
      requireThat(
        point(from) &&
          point(to) &&
          short(b.destination, 500) &&
          (a === "stop"
            ? start?.passengerId === u.id &&
              active(start) &&
              start.status !== "waiting"
            : short(b.origin, 500)),
        "Ruta inválida.",
        400,
      );
      requireThat(b.pickupNote==null || (typeof b.pickupNote==="string" && b.pickupNote.length<=240),"Referencia demasiado larga.",400);
      const leg=await roadLeg(from,to);
      const miles = Math.max(0.01, round(leg.distance / 1609.344)),
        minutes = Math.max(1, Math.round(leg.duration / 60)),
        path = leg.geometry.coordinates.map(([x, y]) => [y, x]);
      const current = start ? get("ride", b.id) : null,
        rate = current?.rates || rates();
      requireThat(
        start
          ? active(current) &&
              JSON.stringify(current.destinationPoint) === JSON.stringify(from)
          : !rides().some((r) => r.passengerId === u.id && active(r)),
      );
      const add = round(
        miles * rate.perMile + (start ? 0 : rate.weather + rate.traffic),
      );
      requireThat(
        Math.abs(
          (b.expectedTotal ?? -1000) - round((current?.fare || 0) + add),
        ) < 0.011,
        "El precio cambió. Revisa la estimación y confirma de nuevo.",
      );
      const r = current || {
        id: randomUUID(),
        created: Date.now(),
        status: "waiting",
        passengerId: u.id,
        passengerName: u.name,
        pickupNote:b.pickupNote?.trim()||"",
        origin: b.origin,
        originPoint: from,
        rates: rate,
        segments: [],
        messages: [],
        path: [],
        fare: 0,
        minutes: 0,
        distance: 0,
      };
      r.segments.push({
        destination: b.destination,
        destinationPoint: to,
        distance: miles,
        fare: add,
      });
      Object.assign(r, {
        destination: b.destination,
        destinationPoint: to,
        path: r.path.concat(path),
        fare: round(r.fare + add),
        distance: round(r.distance + miles),
        minutes: r.minutes + minutes,
      });
      put("ride", r.id, r);
      if (!current) dispatchOffers();
      else if (r.driverId)
        void notify(r.driverId, "Se añadió una parada al viaje.");
      return res.json({});
    }
    const r = get("ride", b.id);
    requireThat(
      r && (mine(r, u) || a === "accept" || a === "decline"),
      "Viaje no disponible.",
      403,
    );
    const driver = r.driverId === u.id,
      assigned = active(r) && r.status !== "waiting";
    if (a === "decline") {
      requireThat(r.status==="waiting" && r.offerDriverId===u.id && r.offerUntil>Date.now() && near(u,r));
      r.offerExcluded=[...(r.offerExcluded||[]),u.id];
      r.offerDriverId=null;r.offerUntil=null;
      put("ride",r.id,r);dispatchOffers();return res.json({});
    }
    if (a === "accept") {
      requireThat(
        r.status === "waiting" &&
          r.offerDriverId === u.id && r.offerUntil > Date.now() &&
          near(u, r) &&
          !rides().some((x) => active(x) && x.driverId === u.id),
      );
      Object.assign(r, {
        lastFix:present(u.id),
        driverId: u.id,
        driverName: u.name,
        vehicle: u.id==="demo-driver" && u.vehicle==="Toyota Camry · NJ DEMO 01"?"Toyota Camry · Plata · NJ DEMO 01":u.vehicle,
        status: "accepted",
      });
    } else if (a === "arrive" || a === "start") {
      requireThat(
        driver && r.status === (a === "arrive" ? "accepted" : "arrived"),
      );
      r.status = a === "arrive" ? "arrived" : "in_progress";
    } else if(a==="reachStop"){
      const index=r.stopsReached||0;
      const fix=present(u.id);
      requireThat(driver && r.status==="in_progress" && b.index===index && index<r.segments.length-1
        && fix && meters(fix.point,r.segments[index].destinationPoint)<=100,"Necesitas GPS reciente en la siguiente parada.");
      r.stopsReached=index+1;
    } else if (a === "finish") {
      requireThat(assigned);
      if (driver)
        requireThat(
          r.status === "in_progress" &&
            present(u.id) &&
            meters(present(u.id).point, r.destinationPoint) <= 100,
          "Necesitas GPS reciente a menos de 100 metros del destino.",
        );
      r.status = "completed";
      r.ended = Date.now();
      delete r.call;
    } else if (a === "cancel") {
      requireThat(
        active(r) && r.status !== "in_progress" && short(b.reason, 500),
        "Indica el motivo antes de iniciar el viaje.",
      );
      Object.assign(r, {
        status: "cancelled",
        reason: b.reason,
        ended: Date.now(),
        cancelledBy: u.name,
        cancelledRole:u.role, cancelledStage:r.status,
      });
      delete r.call;
    } else if (a === "review") {
      requireThat(
        !driver &&
          r.status === "completed" &&
          !r.review &&
          Number.isInteger(b.stars) &&
          b.stars >= 0 && (b.stars>0 || short(b.comment,1000)) &&
          b.stars <= 5 &&
          typeof b.comment === "string" &&
          b.comment.length <= 1000,
      );
      r.review = { stars: b.stars, comment: b.comment.trim() };
    } else if (a === "help") {
      requireThat(short(b.message, 1000));
      (r.help ??= []).push({
        from: u.name,
        text: b.message.trim(),
        time: Date.now(),
      });
    } else if (a === "pickupReply") {
      requireThat(u.id===r.passengerId && r.status==="arrived","El viaje ya no está esperando la recogida.");
      requireThat(["coming","outside"].includes(b.reply),"Respuesta no válida.",400);
      if(r.pickupReply===b.reply)return res.json({});
      r.pickupReply=b.reply;
      r.messages.push({senderId:u.id,from:u.name,text:b.reply==="outside"?"Ya estoy afuera":"Estoy saliendo",time:Date.now(),pickupReply:b.reply});
    } else if (a === "message") {
      requireThat(assigned && short(b.message, 1000));
      if(b.clientId && r.messages.some(m=>m.clientId===b.clientId && m.senderId===u.id))return res.json({});
      r.messages.push({
        senderId:u.id,clientId:short(b.clientId,100)?b.clientId:undefined,
        from: u.name,
        text: b.message.trim(),
        time: Date.now(),
      });
    } else if (a === "call" || a === "answer" || a === "hangup") {
      requireThat(assigned);
      if (a === "hangup") {
        requireThat(r.call?.id === b.callId);
        const log=r.callLog?.find(c=>c.id===b.callId);
        if(log && r.call.from!==u.id && !r.call.answer)log.declined=true;
        delete r.call;
      } else {
        requireThat(short(b.sdp, 50000));
        if (a === "call") {
          requireThat(
            !r.call || (Date.now() - r.call.at > 90000 && !r.call.answer),
          );
          r.call = {
            id: randomUUID(),
            from: u.id,
            at: Date.now(),
            offer: b.sdp,
          };
          (r.callLog??=[]).push({id:r.call.id,to:driver?r.passengerId:r.driverId,at:r.call.at});
        } else {
          requireThat(
            r.call?.id === b.callId && r.call.from !== u.id && !r.call.answer,
          );
          requireThat(Date.now()-r.call.at<90000,"La llamada terminó.");
          const log=r.callLog?.find(c=>c.id===b.callId);
          if(log)log.answered=true;
          r.call.answer = b.sdp;
        }
      }
    } else requireThat(false, "Acción desconocida.", 400);
    put("ride", r.id, r);
    const peer = driver
      ? r.passengerId
      : a === "accept"
        ? r.passengerId
        : r.driverId;
    const notices = {
      accept: "Tu conductor aceptó el viaje y va a recogerte.",
      pickupReply: r.pickupReply==="outside"?"Tu pasajero ya está afuera.":"Tu pasajero está saliendo.",
      arrive: "Tu conductor llegó al punto de recogida.",
      start: "Tu viaje ha comenzado.",
      finish: "El viaje finalizó. Puedes ver el resumen en tu historial.",
      cancel: "El viaje fue cancelado.",
      message: "Tienes un mensaje nuevo del viaje.",
      call: "Llamada entrante en Victoria-Taxi."
    };
    if (peer && notices[a]) void notify(peer,a==="call"?"Llamada de "+u.name+" · "+(driver?"Conductor":"Pasajero"):notices[a],{rideId:r.id,...(a==="arrive"?{kind:"arrival"}:{}),...(a==="call"?{callId:r.call.id}:{})});
    res.json({});
  });
  api.use((err, _req, res, _next) =>
    res.status(err.status || 500).json({
      error: err.status
        ? err.message
        : "No se pudo completar la operación. Reintenta.",
    }),
  );
  api.attachWebSocket = (server) => {
    const ws = new WebSocketServer({ noServer: true, maxPayload: 1024 });
    server.on("upgrade", (req, socket, head) => {
      if (new URL(req.url, "http://localhost").pathname !== "/dispatch/live")
        return;
      ws.handleUpgrade(req, socket, head, (client) =>
        ws.emit("connection", client),
      );
    });
    ws.on("connection", (client) => {
      const timeout = setTimeout(() => client.terminate(), 5000);
      client.once("message", (message) => {
        clearTimeout(timeout);
        const key = digest(message.toString());
        if (!authenticated(key)) {
          client.close(1008, "Invalid session");
          return;
        }
        client.sessionKey = key;
        sockets.add(client);
        client.send("ready");
      });
      client.on("error", () => {});
      client.on("close", () => {
        clearTimeout(timeout);
        sockets.delete(client);
      });
    });
    return ws;
  };
  return api;
}
