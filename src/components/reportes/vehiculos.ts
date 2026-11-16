/** Los vehículos que puede decir el contrato, con el tipo de la ficha al que corresponde cada uno. */
export const VEHICULOS_CONTRATO = [
  { valor: "MOTOTAXI", texto: "Mototaxi", tipo: "Mototaxi" },
  { valor: "MOTOCICLETA", texto: "Motocicleta lineal", tipo: "Lineal" },
  { valor: "SCOOTER", texto: "Scooter", tipo: "Scooter" },
  { valor: "AUTO", texto: "Auto", tipo: "Auto" },
  { valor: "CAMIONETA", texto: "Camioneta", tipo: "Camioneta" },
  { valor: "COMBI", texto: "Combi", tipo: "Combi" },
  { valor: "MINIVAN", texto: "Minivan", tipo: "Minivan" },
] as const;
export type VehiculoContrato = (typeof VEHICULOS_CONTRATO)[number]["valor"];

/** Tipo de la ficha → lo que dice el contrato ("Otro" o sin tipo: hay que elegirlo al llenar). */
export function vehiculoDeTipo(tipo: string | null | undefined): VehiculoContrato | "" {
  const t = (tipo ?? "").trim().toLowerCase();
  if (t === "trimoto") return "MOTOTAXI";
  return VEHICULOS_CONTRATO.find((v) => v.tipo.toLowerCase() === t)?.valor ?? "";
}

/** Lo que dice el contrato → tipo de la ficha. */
export const tipoDeVehiculo = (v: string | null | undefined) => VEHICULOS_CONTRATO.find((x) => x.valor === v)?.tipo;
