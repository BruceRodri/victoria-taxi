export const profiles = {
  passenger: { name: "Sofía Reyes", initials: "SR" },
  driver: { name: "Diego Torres", initials: "DT" },
  admin: { name: "Valeria Cruz", initials: "VC" },
};

export const airportRide = {
  origin: "Newark Penn Station",
  originPoint: [40.7347, -74.1642],
  destination: "Newark Airport · Terminal A",
  destinationPoint: [40.6832, -74.1914],
  distance: 5.8,
  minutes: 18,
};

const sampleDrivers = [
  {
    id: "demo-diego",
    name: profiles.driver.name,
    vehicle: "Toyota Camry · NJ DEMO 01",
    license: "DEMO-01",
    status: "approved",
  },
  {
    id: "demo-lucia",
    name: "Lucía Vega",
    vehicle: "Honda Accord · NJ DEMO 02",
    license: "DEMO-02",
    status: "pending",
  },
];
export const storageKey = "victoria-taxi-demo";

export function demoData(saved) {
  const drivers = saved?.drivers ?? [];
  return {
    fareVersion: 2,
    rates: {
      perMile: saved?.fareVersion === 2 ? saved.rates?.perMile ?? 3 : 3,
      weather: saved?.rates?.weather ?? 0,
      traffic: saved?.rates?.traffic ?? 0,
    },
    drivers: [
      ...drivers,
      ...sampleDrivers.filter(
        (sample) => !drivers.some((driver) => driver.id === sample.id),
      ),
    ],
    trips: saved?.trips ?? [],
  };
}

export function loadDemo() {
  try {
    return demoData(JSON.parse(localStorage.getItem(storageKey)));
  } catch {
    return demoData();
  }
}
