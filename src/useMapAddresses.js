import { useCallback, useEffect, useRef, useState } from "react";

function formatAddress(properties) {
  const street = [properties.housenumber, properties.street].filter(Boolean).join(" ");
  const parts = [street || properties.name, street && properties.name !== street ? properties.name : null,
    properties.city || properties.district || properties.county, properties.state].filter(Boolean);
  return [...new Set(parts)].join(", ");
}

export async function streetAt(point,signal){
  const params=new URLSearchParams({lat:String(point[0]),lon:String(point[1]),limit:"1"});
  const response=await fetch("https://photon.komoot.io/reverse?"+params,{signal});
  if(!response.ok)throw Error("lookup");
  const result=await response.json();
  const street=formatAddress(result.features?.[0]?.properties || {});
  if(!street)throw Error("empty");
  return street;
}

export function useMapAddresses(setForm, en) {
  const requests = useRef({});
  const [status, setStatus] = useState({});
  const [points, setPoints] = useState({});
  const invalidate = useCallback((key) => {
    requests.current[key]?.abort();
    delete requests.current[key];
    setStatus(current => ({...current,[key]:undefined}));
    setPoints(current => ({...current,[key]:undefined}));
  }, []);
  useEffect(() => {
    const active = requests.current;
    return () => Object.values(active).forEach(controller => controller.abort());
  }, []);
  const edit = useCallback((key, value, preservePoint = false) => {
    if (!preservePoint) invalidate(key);
    setForm(current => ({...current,[key]:value,[key+"Point"]:null}));
  }, [invalidate,setForm]);
  const select = useCallback((key, point, name) => {
    invalidate(key);
    if(name) {
      setForm(current => ({...current,[key]:name,[key+"Point"]:point}));
      return;
    }
    const controller = new AbortController();
    requests.current[key] = controller;
    setPoints(current => ({...current,[key]:point}));
    setStatus(current => ({...current,[key]:"loading"}));
    setForm(current => ({...current,[key]:en?"Finding address…":"Buscando dirección…",[key+"Point"]:null}));
    streetAt(point,AbortSignal.any([controller.signal,AbortSignal.timeout(10000)]))
      .then(label=>{
        if(controller.signal.aborted)return;
        setForm(current=>({...current,[key]:label,[key+"Point"]:point}));
        setStatus(current=>({...current,[key]:"approximate"}));
        delete requests.current[key];
      })
      .catch(()=>{
        if(controller.signal.aborted)return;
        setForm(current=>({...current,[key]:"",[key+"Point"]:null}));
        setStatus(current=>({...current,[key]:"error"}));
        delete requests.current[key];
      });
  },[en,invalidate,setForm]);
  const acceptManual = useCallback((key,value) => {
    const point=points[key];
    if(!point || !value.trim())return;
    setForm(current=>({...current,[key]:value.trim(),[key+"Point"]:point}));
    setStatus(current=>({...current,[key]:"manual"}));
  },[points,setForm]);
  return {select,edit,status,acceptManual};
}
