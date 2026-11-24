import { Banknote, ReceiptText } from "lucide-react";

export const money = (amount) => "$" + Number(amount || 0).toFixed(2);

export function priceRide(distance, rates) {
  const perMile = Number(rates.perMile);
  const distanceCents = Math.round(Number(distance) * perMile * 100);
  const weatherCents = Math.round(Number(rates.weather) * 100);
  const trafficCents = Math.round(Number(rates.traffic) * 100);
  return {
    distance, perMile, mileage: distanceCents / 100,
    weather: weatherCents / 100, traffic: trafficCents / 100,
    total: (distanceCents + weatherCents + trafficCents) / 100,
  };
}

export function FareTicket({ fare, en, preview = false }) {
  const title = preview
    ? (en ? "Sample ride" : "Viaje de ejemplo")
    : (en ? "Estimated fare" : "Precio estimado");
  return (
    <section className="fare-ticket" aria-label={title}>
      <div className="ticket-heading"><ReceiptText size={18} aria-hidden="true" />{title}</div>
      <div className="ticket-amount"><strong>{money(fare.total)}</strong><span>USD</span></div>
      <dl>
        <div><dt>{fare.distance || 0} mi × {money(fare.perMile)}</dt><dd>{money(fare.mileage)}</dd></div>
        {fare.weather > 0 && <div><dt>{en ? "Weather surcharge" : "Recargo por clima"}</dt><dd>{money(fare.weather)}</dd></div>}
        {fare.traffic > 0 && <div><dt>{en ? "Traffic surcharge" : "Recargo por tráfico"}</dt><dd>{money(fare.traffic)}</dd></div>}
      </dl>
      <div className="ticket-payment"><Banknote size={17} aria-hidden="true" />{en ? "Cash payment" : "Pago en efectivo"}</div>
    </section>
  );
}
