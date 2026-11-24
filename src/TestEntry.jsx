import { useEffect, useState } from "react";
import { App as MobileApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import App from "./App";
import Dispatch from "./Dispatch.jsx";
import {host} from "./dispatchClient";
import ServerSetup from "./ServerSetup";
import WifiRide from "./WifiRide";

function fromLink(link) {
  try {
    const url = new URL(link);
    const key = url.searchParams.get("key");
    const host = new URL(url.searchParams.get("host"));
    const privateHost = /^(192\.168|10\.\d{1,3}|172\.(1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}$/;
    if (url.protocol==="victoriataxi:" && url.hostname==="pair" && host.protocol==="http:" && privateHost.test(host.hostname) && !host.username && !host.password && /^[a-f0-9]{36}$/.test(key)) return {role:"driver",host:host.origin,key};
  } catch { /* Ignore unrelated links. */ }
  return null;
}

function initialPair() {
  if(Capacitor.isNativePlatform()) {
    try { return JSON.parse(localStorage.getItem("vt-wifi-pair")); } catch { return null; }
  }
  const match = /^#wifi=(driver|passenger)\.([a-f0-9]{36})$/.exec(location.hash);
  return match ? {role:match[1],host:location.origin,key:match[2]} : null;
}

export default function TestEntry() {
  const [configure,setConfigure]=useState(false);
  const [pair,setPair] = useState(initialPair);
  const [legacy,setLegacy]=useState(false);
  const [offer, setOffer] = useState(null);
  useEffect(()=>{
    if(!Capacitor.isNativePlatform()) return;
    let alive=true;
    function open(link) {
      if (!alive || !link) return;
      if (/^victoriataxi:\/\/offer\/[0-9a-f-]+$/i.test(link)) {
        const stored = initialPair();
        if (stored) {
          setPair(stored);
          setOffer({id:new URL(link).pathname.slice(1)});
        }
        return;
      }
      const next=fromLink(link);
      if(alive && next) {localStorage.setItem("vt-wifi-pair",JSON.stringify(next)); setPair(next);}
    }
    const listener=MobileApp.addListener("appUrlOpen",e=>open(e.url));
    MobileApp.getLaunchUrl().then(result=>result && open(result.url));
    return ()=>{alive=false;void listener.then(handle=>handle.remove());};
  },[]);
  return pair ? <WifiRide key={pair.key+pair.host} pair={pair} offer={offer} leave={()=>{
    localStorage.removeItem("vt-wifi-pair");
    history.replaceState(null,"",location.pathname);
    setOffer(null);
    setPair(null);
  }}/> : legacy ? <App/> : Capacitor.isNativePlatform() && (!host||configure) ? <ServerSetup back={host?()=>setConfigure(false):null} legacy={()=>setLegacy(true)}/> : <Dispatch configure={()=>setConfigure(true)} legacy={()=>setLegacy(true)}/>;
}


