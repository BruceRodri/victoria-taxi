self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Victoria-Taxi", {
      body: data.body,
      tag: data.callId || data.rideId || "victoria-dispatch",
      actions:data.kind==="arrival"?[{action:"outside",title:"Ya estoy afuera"},{action:"coming",title:"Estoy saliendo"}]:[],
      data:{rideId:data.rideId},
      icon: "/favicon.svg",
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async list=>{
        const id=event.notification.data?.rideId;
        const rideId=["outside","coming"].includes(event.action)?event.action+"/"+id:id;
        const client=list.find(c=>new URL(c.url).origin===location.origin);
        if(client){await client.focus();client.postMessage({rideId});}
        else {
          if(rideId!==id){
            const cache=await caches.open("vt-arrival-actions");
            await cache.put("/pending-arrival",new Response(JSON.stringify({rideId,at:Date.now()})));
          }
          await clients.openWindow(id?"/?trip="+encodeURIComponent(id):"/");
        }
      })
  );
});

self.addEventListener("message", event=>{
  if(event.data?.type!=="arrival-ready" || !event.source)return;
  event.waitUntil((async()=>{
    const cache=await caches.open("vt-arrival-actions");
    const stored=await cache.match("/pending-arrival");
    if(!stored || !await cache.delete("/pending-arrival"))return;
    const pending=await stored.json();
    if(Date.now()-pending.at<60000)event.source.postMessage({rideId:pending.rideId});
  })());
});
