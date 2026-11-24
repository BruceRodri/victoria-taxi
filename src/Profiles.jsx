import { Capacitor } from "@capacitor/core";
import {
  ArrowRight,
  CarFront,
  LayoutDashboard,
  MapPin,
  UserRound,
} from "lucide-react";
import { money } from "./FareTicket";
import { profiles } from "./demo";

export function Profiles({ t, en, enter, register, perMile, otherDrivers }) {
  const options = [
    [
      "passenger",
      UserRound,
      en ? "Request a ride" : "Solicitar un viaje",
      en
        ? "Choose your stops and see the fare."
        : "Elige tus paradas y consulta el precio.",
    ],
    [
      "driver",
      CarFront,
      en ? "Drive with Victoria" : "Conducir con Victoria",
      en
        ? "Accept the request and complete the ride."
        : "Acepta la solicitud y completa el recorrido.",
    ],
    [
      "admin",
      LayoutDashboard,
      en ? "Open dashboard" : "Abrir el panel",
      en
        ? "Review drivers, fares and ride history."
        : "Revisa conductores, tarifas e historial.",
    ],
  ];
  return (
    <main className="home">
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-place">
            <MapPin size={15} /> Newark, New Jersey
          </span>
          <span className="home-kicker">{en?"YOUR CITY. YOUR RIDE.":"TU CIUDAD. TU CAMINO."}</span>
          <h1>{en?<>Every journey<br/><em>starts here.</em></>:<>Cada viaje<br/><em>empieza aquí.</em></>}</h1>
          <p className="hero-sub">{en?"A better way to move together.":"Una mejor forma de movernos juntos."}</p>
          <div className="hero-price"><strong>{money(perMile)}</strong><span>{en ? "per mile" : "por milla"}</span></div>
          <button className="hero-book" onClick={() => enter("passenger")}>
            {en ? "Ride as Sofía" : "Viajar como Sofía"} <ArrowRight size={17} />
          </button>
        </div>
      </section>
      <section className="profile-picker">
        <span className="home-section-kicker">{en?"EXPLORE VICTORIA-TAXI":"EXPLORA VICTORIA-TAXI"}</span>
        <h2>{en ? "Choose your experience." : "Elige tu experiencia."}</h2>
        <p>
          {en
            ? "Start as the passenger. Switch profiles at any time to follow the same ride."
            : "Empieza como pasajero. Cambia de perfil cuando quieras para seguir el mismo viaje."}
        </p>
        <div className="profile-grid">
          {options.filter(([role]) => role !== "admin" || !Capacitor.isNativePlatform()).map(([role, Icon, action, description]) => (
            <button
              key={role}
              className={"account " + role}
              onClick={() => enter(role)}
            >
              <span className="account-role">
                <Icon size={18} /> {t[role]}
              </span>
              <span className="profile-monogram" aria-hidden="true">{profiles[role].initials}</span>
              <strong>{profiles[role].name}</strong>
              <span className="account-description">{description}</span>
              <span className="account-action">
                {action}
                <ArrowRight size={17} />
              </span>
            </button>
          ))}
        </div>
      </section>
      <details className="more">
        <summary>
          {en
            ? "Other driver profiles and registration"
            : "Otros conductores y registro"}
        </summary>
        {otherDrivers.map((d) => (
          <button
            className="outline"
            key={d.id}
            onClick={() => enter("driver", d.id)}
          >
            {d.name}
          </button>
        ))}
        <button className="outline" onClick={register}>
          {t.register}
        </button>
      </details>
    </main>
  );
}
