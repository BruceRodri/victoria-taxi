import { useState } from "react";
import { CapacitorHttp } from "@capacitor/core";
export default function ServerSetup({ legacy,back }) {
  const [url, setUrl] = useState(localStorage.getItem("vt-server")||""),
    [error, setError] = useState("");
  return (
    <main className="dispatch-main">
      <section className="panel">
        <h1>Victoria-Taxi</h1>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const host = new URL(url);
              if (!(host.protocol === "https:" || (host.protocol === "http:" && /^(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/.test(host.hostname))) || host.username || host.password)
                throw Error();
              const { status, data } = await CapacitorHttp.get({
                url: host.origin + "/dispatch/info",
                readTimeout: 7000,
              });
              if (status !== 200 || !data.pushKey) throw Error();
              if(localStorage.getItem("vt-server")!==host.origin){
                localStorage.removeItem("vt-session");
                localStorage.removeItem("vt-driver-submitted");
              }
              localStorage.setItem("vt-server", host.origin);
              location.reload();
            } catch {
              setError(
                "No se encontró una central Victoria-Taxi en esa dirección.",
              );
            }
          }}
        >
          <label>
            Dirección de la central
            <input
              type="url"
              required
              placeholder="https:// o dirección de prueba Wi-Fi"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <button className="primary">Conectar</button>
        </form>
        {back && <button className="outline" onClick={back}>Volver</button>}
        {error && <p role="alert">{error}</p>}
        <button className="outline" onClick={legacy}>
          Probar demo local
        </button>
      </section>
    </main>
  );
}
