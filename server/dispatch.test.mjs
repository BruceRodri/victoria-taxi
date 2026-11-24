import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { WebSocket } from "ws";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dispatch } from "./dispatch.mjs";
test("shared ride lifecycle, role isolation and driver applications", async (t) => {
  const fetchHttp = globalThis.fetch;
  t.mock.method(globalThis, "fetch", (url, ...args) =>
    String(url).startsWith("https://router.project-osrm.org/")
      ? Promise.resolve(
          Response.json({
            routes: [
              {
                distance: 1609.344,
                duration: 120,
                geometry: {
                  coordinates: [
                    [-74.16, 40.73],
                    [-74.19, 40.68],
                  ],
                },
              },
            ],
          }),
        )
      : fetchHttp(url, ...args),
  );
  const app = express();
  app.use(
    "/dispatch",
    dispatch({
      demo: true,
      dir: mkdtempSync(join(tmpdir(), "victoria-test-")),
    }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(() => server.close());
  const base = "http://127.0.0.1:" + server.address().port + "/dispatch/";
  async function q(token, path, body, expected = 200) {
    const response = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await response.json();
    assert.equal(
      response.status,
      expected,
      path + " " + JSON.stringify(j).slice(0, 120),
    );
    return j;
  }
  const p = (await q("", "demo", { role: "passenger" })).token,
    d = (await q("", "demo", { role: "driver" })).token,
    a = (await q("", "demo", { role: "admin" })).token;
  const other = (
    await q("", "register", {
      role: "passenger",
      name: "QA",
      email: "qa@example.org",
      password: "unittest-password",
    })
  ).token;
  const from = [40.7347, -74.1642],
    dest = [40.6832, -74.1914];
  const create = {
    action: "create",
    pickupNote:"Salida de Market Street",
    origin: "Newark Penn",
    originPoint: from,
    destination: "Terminal A",
    destinationPoint: dest,
    expectedTotal: 3,
  };
  await q(p,"route",{from,to:dest});
  await q(p, "action", create);
  assert.equal((await q(d, "state")).trips.length, 0);
  await q(d, "presence", { fix: { point: from, time: Date.now() } });
  const { id } = (await q(d, "state")).trips[0];
  const act = (token, action, payload = {}, code = 200) =>
    q(token, "action", { action, id, ...payload }, code);
  await act(d, "accept");
  const assigned=(await q(d,"state")).trips[0];
  assert.equal(assigned.pickupNote,create.pickupNote);
  assert.deepEqual(assigned.driverPoint,from);
  await q(d,"presence",{fix:null});
  const disconnected=(await q(p,"state")).trips[0];
  assert.equal(disconnected.driverFixTime,assigned.driverFixTime);
  assert.deepEqual(disconnected.driverPoint,assigned.driverPoint);
  await q(other,"trip-alerts/"+id,undefined,403);
  assert.deepEqual(await q(other,"alerts"),[]);
  const chat={message:"Chat de prueba",clientId:"offline-test"};
  await act(p,"message",chat);
  await act(p,"message",chat);
  assert.equal((await q(d,"trip-alerts/"+id)).messageCount,1);
  assert.equal((await q(p,"trip-alerts/"+id)).messageCount,0);
  assert.equal((await q(d,"state")).trips[0].messages.filter(m=>m.clientId===chat.clientId).length,1);
  await act(other, "message", { message: "test" }, 403);
  await act(p, "message", { message: "Hola" });
  await act(d, "call", { sdp: "offer" });
  const callId = (await q(p, "state")).trips[0].call.id;
  assert.equal((await q(p,"trip-alerts/"+id)).incoming.id,callId);
  await act(p, "answer", { sdp: "answer", callId });
  await act(p, "hangup", { callId });
  await act(d,"call",{sdp:"missed-offer"});
  const missed=(await q(p,"trip-alerts/"+id)).incoming.id;
  await act(d,"hangup",{callId:missed});
  assert.ok((await q(p,"alerts")).some(entry=>entry.kind==="missed" && entry.rideId===id));
  await act(p,"pickupReply",{reply:"outside"},409);
  await act(d, "arrive");
  await act(d,"pickupReply",{reply:"coming"},409);
  await act(other,"pickupReply",{reply:"coming"},403);
  await act(p,"pickupReply",{reply:"bad"},400);
  for(const reply of ["coming","coming","outside"])await act(p,"pickupReply",{reply});
  const replied=(await q(d,"state")).trips[0];
  assert.equal(replied.pickupReply,"outside");
  assert.equal(replied.messages.filter(m=>m.pickupReply).length,2);
  await act(d, "start");
  await act(d, "finish", {}, 409);
  await act(p, "stop", {
    destination: "Newark Penn",
    destinationPoint: from,
    expectedTotal: 6,
  });
  await act(p,"reachStop",{index:0},409);
  await act(d,"reachStop",{index:0},409);
  await q(d,"presence",{fix:{time:Date.now(),point:dest}});
  await act(d,"reachStop",{index:0});
  await act(d,"reachStop",{index:0},409);
  const passengerTrip=(await q(p,"state")).trips[0];
  const driverTrip=(await q(d,"state")).trips[0];
  assert.equal(passengerTrip.stopsReached,1);
  assert.deepEqual(driverTrip.segments,passengerTrip.segments);
  assert.equal(driverTrip.fare,passengerTrip.fare);
  await act(p, "finish");
  await act(p, "review", { stars: 5, comment: "Buen viaje" });
  await act(p, "help", { message: "Consulta" });
  assert.equal((await q(d, "state")).trips[0].review.stars, 5);
  assert.equal((await q(a, "state")).trips[0].segments.length, 2);
  assert.equal((await q(other, "state")).trips.length, 0);
  await q(p, "action", create);
  const next = (await q(p, "state")).trips.find((r) => r.status === "waiting");
  await q(p, "action", {
    action: "cancel",
    id: next.id,
    reason: "Cambio de planes",
  });
  const photo = "data:application/pdf;base64," + Buffer.alloc(3 * 1024 * 1024, 65).toString("base64");
  const application = {
      role: "driver",
      name: "QA Driver",
      email: "driver@example.org",
      password: "unittest-password",
      plate: "XYZ",
      brand: "Toyota",
      model: "Camry",
      color: "Negro",
      documents: Object.fromEntries(
        [
          "vehiclePhoto",
          "licensePhoto",
          "registrationPhoto",
          "insurancePhoto",
        ].map((k) => [k, photo]),
      ),
    };
  for(const [token,path] of [["","register"],[a,"driver"]]){
    assert.match((await q(token,path,application,400)).error,/foto del conductor/);
  }
  const candidate=(await q("","register",{...application,portrait:"data:image/jpeg;base64,/9j/2Q=="})).token;
  const user = (await q(candidate, "state")).me;
  await q(
    candidate,
    "presence",
    { fix: { point: from, time: Date.now() } },
    403,
  );
  const storedDocs = await q(a, "documents/" + user.id);
  assert.equal(Object.keys(storedDocs).length, 4);
  assert.equal(storedDocs.licensePhoto, photo);
  await q(other, "documents/" + user.id, undefined, 403);
  await q(a, "action", {
    action: "decision",
    id: user.id,
    status: "rejected",
    reason: "Foto borrosa",
  });
  assert.equal(
    (await q(candidate, "state")).me.rejectionReason,
    "Foto borrosa",
  );
  await q(candidate, "resubmit", {documents:{licensePhoto:"data:image/jpeg;base64,YWJj"}});
  assert.equal((await q(candidate, "state")).me.status, "pending");
  assert.equal((await q(a, "documents/" + user.id)).vehiclePhoto, photo);

});

test("live updates require a session and reconnect after a server notification", async (t) => {
  const api = dispatch({ demo: true, dir: mkdtempSync(join(tmpdir(), "victoria-live-")) });
  const app = express();
  app.use("/dispatch", api);
  const server = app.listen(0, "127.0.0.1");
  api.attachWebSocket(server);
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => server.close());
  const base = "http://127.0.0.1:" + server.address().port;
  const login = await fetch(base + "/dispatch/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({role:"driver"}) });
  const {token} = await login.json();
  const socket = new WebSocket(base.replace("http:", "ws:") + "/dispatch/live");
  t.after(() => socket.terminate());
  await new Promise((resolve) => socket.once("open", resolve));
  const ready = new Promise((resolve) => socket.once("message", (data) => resolve(data.toString())));
  socket.send(token);
  assert.equal(await ready, "ready");
  const changed = new Promise((resolve) => socket.once("message", (data) => resolve(data.toString())));
  const presence = await fetch(base + "/dispatch/presence", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({fix:{point:[40.73,-74.16],time:Date.now()}}) });
  assert.equal(presence.status, 200);
  assert.equal(await changed, "changed");
  const closed = new Promise(resolve => socket.once("close", resolve));
  await fetch(base + "/dispatch/logout", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body:"{}" });
  await closed;
});
