import { useEffect, useRef, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Phone, PhoneOff, PhoneIncoming, PhoneOutgoing, UserRound, Volume2, Bluetooth, Ear, AudioLines } from "lucide-react";
const alertPlugin=Capacitor.getPlatform()==="android"?registerPlugin("TripAlerts"):null;
const nativeAudio = Capacitor.isNativePlatform() ? registerPlugin("RideAudio") : null;
export default function RideCall({ ride, me, send, en, api }) {
  const pc = useRef(null),
    stream = useRef(null),
    audio = useRef(null),
    pending = useRef(false),
    seen = useRef(null);
  const [error, setError] = useState(""),
    [working, setWorking] = useState(false);
  const [output,setOutput] = useState("");
  const [connected,setConnected] = useState(false);
  const [audioError,setAudioError] = useState("");
  async function chooseOutput(route) {
    try {
      if (nativeAudio) await nativeAudio.route({route});
      else {
        const device=await navigator.mediaDevices.selectAudioOutput();
        await audio.current.setSinkId(device.deviceId);
      }
      if(audio.current) audio.current.muted=false;
      setOutput(route);setAudioError("");
    } catch {setAudioError(en?"Audio device unavailable. Check your connected devices.":"Salida de audio no disponible. Revisa tus dispositivos conectados.");}
  }
  function close() {
    void nativeAudio?.end().catch(()=>{});
    pc.current?.close();
    setConnected(false);setOutput("");setAudioError("");
    pc.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (audio.current) audio.current.srcObject = null;
  }
  useEffect(() => close, []);
  const call = ride.call;
  useEffect(() => {
    if (call) seen.current = call.id;
    if (!call && seen.current) {
      close();
      seen.current = null;
    }
    if (call?.answer && pc.current?.signalingState === "have-local-offer")
      pc.current
        .setRemoteDescription({ type: "answer", sdp: call.answer })
        .catch(() =>
          setError(en ? "Call disconnected" : "Llamada interrumpida"),
        );
  }, [call?.id, call?.answer, en]);
  async function start() {
    if (pending.current) return;
    pending.current = true;
    setWorking(true);
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Error();
      close();
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const iceServers = await api("ice");
      const conn = new RTCPeerConnection({ iceServers });
      pc.current = conn;
      if(nativeAudio) {
        if(audio.current) audio.current.muted=true;
        await chooseOutput("earpiece");
      }
      conn.ontrack = (e) => {
        if (audio.current) {
          audio.current.srcObject = e.streams[0];
          void audio.current.play().catch(() => {});
        }
      };
      conn.onconnectionstatechange = () => {
        setConnected(conn.connectionState === "connected");
        if (conn.connectionState === "failed")
          setError(
            en
              ? "Connection failed. Hang up and retry."
              : "Falló la conexión. Cuelga y reintenta.",
          );
      };
      stream.current
        .getTracks()
        .forEach((t) => conn.addTrack(t, stream.current));
      if (call)
        await conn.setRemoteDescription({ type: "offer", sdp: call.offer });
      await conn.setLocalDescription(
        await (call ? conn.createAnswer() : conn.createOffer()),
      );
      if (conn.iceGatheringState !== "complete")
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, 5000);
          conn.onicegatheringstatechange = () => {
            if (conn.iceGatheringState === "complete") {
              clearTimeout(timer);
              resolve();
            }
          };
        });
      await send(call ? "answer" : "call", {
        callId: call?.id,
        sdp: conn.localDescription.sdp,
      });
    } catch {
      close();
      setError(
        en
          ? "Check microphone access and connection."
          : "Revisa el permiso del micrófono y la conexión.",
      );
    } finally {
      pending.current = false;
      setWorking(false);
    }
  }
  const incoming = call && call.from !== me.id && !call.answer;
  useEffect(()=>{
    const dial=e=>{if(e.detail===ride.id && !call && !working) void start();};
    window.addEventListener("vt-place-call",dial);
    return ()=>window.removeEventListener("vt-place-call",dial);
  });
  useEffect(()=>{
    if(!incoming||!Capacitor.isNativePlatform())return;
    let active=true;
    async function consume(){
      if(document.hidden || !active)return;
      const result=alertPlugin?await alertPlugin.consumeAction({callId:call.id}).catch(()=>({})):{action:sessionStorage.getItem("vt-call-"+call.id)};
      if(result.action)sessionStorage.removeItem("vt-call-"+call.id);
      if(!active)return;
      if(result.action==="answer")void start();
      if(result.action==="decline")void send("hangup",{callId:call.id}).catch(e=>setError(e.message));
    }
    void consume();
    const timer=setInterval(consume,800);
    return ()=>{active=false;clearInterval(timer);};
  },[incoming,call?.id]);
  const ringing = Boolean(incoming && !working);
  useEffect(()=>{
    if(!ringing)return;
    if(nativeAudio){
      void nativeAudio.ring({on:true}).catch(()=>{});
      return ()=>{void nativeAudio.ring({on:false}).catch(()=>{});};
    }
    const tone=new Audio("/ride-ring.wav");
    tone.loop=true;
    void tone.play().catch(()=>{});
    return ()=>tone.pause();
  },[ringing]);
  const peer = me.role==="driver" ? ride.passengerName : ride.driverName;
  const label = incoming && !working ? (en?"Incoming call":"Llamada entrante") : connected ? (en?"On call":"En llamada") : call && !call.answer && !working ? (en?"Calling…":"Llamando…") : (en?"Connecting…":"Conectando…");
  return <div className="call-controls">
    <audio ref={audio} autoPlay playsInline/>

    {(call || working) && <section role="dialog" aria-modal="true" aria-label={label} className="ride-call-screen">
      <strong className="vt-call-brand">Victoria-Taxi · {me.role==="driver"?(en?"Passenger":"Pasajero"):(en?"Driver":"Conductor")}</strong><div className="caller-avatar"><UserRound size={48}/><span>{incoming?<PhoneIncoming size={19}/>:connected?<AudioLines size={19}/>:<PhoneOutgoing size={19}/>}</span></div><h2>{peer}</h2><p role="status">{label}</p>
      {(!incoming || working) && <div className="route-choices">
        {nativeAudio ? [["earpiece",en?"Earpiece":"Auricular"],["speaker",en?"Speaker":"Altavoz"],["bluetooth","Bluetooth"]].map(([id,name])=><button disabled={!pc.current} aria-pressed={output===id} key={id} onClick={()=>chooseOutput(id)}>{id==="earpiece"?<Ear/>:id==="speaker"?<Volume2/>:<Bluetooth/>}{name}</button>)
        : navigator.mediaDevices?.selectAudioOutput && <button onClick={()=>chooseOutput("system")}>{en?"Audio output":"Salida de audio"}</button>}
      </div>}
      {audioError && <p role="status">{audioError}</p>}
      {incoming && !working && <button className="answer-call" onClick={start}><Phone/>{en?"Answer call":"Contestar llamada"}</button>}
      {call && <button className="end-call" onClick={()=>send("hangup",{callId:call.id}).then(close).catch(e=>setError(e.message))}><PhoneOff/>{incoming?(en?"Decline":"Rechazar"):(en?"Hang up":"Colgar")}</button>}
      {error && <p role="alert">{error}</p>}
    </section>}
    {!call && !working && error && <p role="alert">{error}</p>}
  </div>;
}
