import { useEffect, useRef, useState } from "react";
import { searchPlaces } from "./routing";

export default function AddressField({ label, value, confirmed, onEdit, onSelect, en, mapStatus, onManual }) {
  const [results, setResults] = useState(null);
  const [status, setStatus] = useState("");
  const request = useRef(null);
  const id = useRef(0);
  function reset() {
    id.current++;
    request.current?.abort();
    setResults(null);
    setStatus("");
  }
  useEffect(() => () => request.current?.abort(), []);
  async function search() {
    reset();
    const version = id.current;
    const controller = new AbortController();
    request.current = controller;
    setStatus("loading");
    try {
      const choices = await searchPlaces(value, AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]));
      if (version === id.current && !controller.signal.aborted) {
        setResults(choices);
        setStatus(choices.length ? "choose" : "empty");
      }
    } catch {
      if (version === id.current && !controller.signal.aborted) setStatus("error");
    }
  }
  const messages = en
    ? {loading:"Searching…",choose:"Choose the exact location.",empty:"No matches. Add a city or state, or mark the map.",error:"Search unavailable. Retry or mark the map."}
    : {loading:"Buscando…",choose:"Elige el lugar exacto.",empty:"Sin resultados. Añade la ciudad o el estado, o marca el mapa.",error:"No se pudo buscar. Reintenta o marca el mapa."};
  return <div className="address-field">
    <label>{label}<input value={value} onChange={e=>{reset();onEdit(e.target.value,mapStatus==="error");}} onKeyDown={e=>{
      if(e.key==="Enter"){e.preventDefault();if(!confirmed && value.trim())search();}
    }}/></label>
    {mapStatus==="loading" && <small role="status">{en?"Finding the nearest address…":"Buscando la dirección más cercana…"}</small>}
    {mapStatus==="approximate" && <small role="status">{en?"Approximate address. Check the pin.":"Dirección aproximada. Revisa el punto en el mapa."}</small>}
    {mapStatus==="error" && <small role="status">{en?"Address unavailable. Enter a description for this map point.":"No se encontró una dirección. Escribe una referencia para este punto."}</small>}
    {mapStatus==="error" && <button type="button" className="outline" disabled={!value.trim()} onClick={()=>onManual(value)}>{en?"Use this description":"Usar esta referencia"}</button>}
    {!confirmed && mapStatus!=="loading" && mapStatus!=="error" && <><button type="button" className="outline" disabled={!value.trim() || status==="loading"} onClick={search}>{en ? "Search location" : "Buscar lugar"}</button>
      <small role="status">{messages[status]}</small>
      {results?.length > 0 && <ul>{results.map(({name,point},index)=><li key={index}><button type="button" onClick={()=>{reset();onSelect(name,point);}}>{name}</button></li>)}</ul>}
    </>}
  </div>;
}
