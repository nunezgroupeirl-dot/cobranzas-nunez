import { sumarMeses } from "@/lib/letras";
import { htmlPlantillaContrato } from "./ContratoPlantilla";
import type { Cliente, Contrato, Cuenta, Empresa, Moto } from "@/types/database";

/**
 * Datos del contrato de alquiler venta tal como se llenan en la página (todo texto).
 * Lo que quede vacío sale con una raya para llenarlo a mano.
 */
export interface CamposContrato {
  empresa: string;
  ruc: string;
  representante: string;
  representante_dni: string;
  domicilio_empresa: string;
  cliente: string;
  doc_tipo: "DNI" | "CE";
  doc_numero: string;
  domicilio_cliente: string;
  vehiculo: "MOTOTAXI" | "MOTOCICLETA";
  placa: string;
  marca: string;
  modelo: string;
  anio: string;
  clase: string;
  combustible: string;
  color: string;
  serie: string;
  motor: string;
  carroceria: string;
  plazo_meses: string;
  inicio: string; // YYYY-MM-DD
  renta: string;
  frecuencia: "DIARIA" | "SEMANAL" | "QUINCENAL" | "MENSUAL";
  cuenta: string;
  inicial: string;
  ciudad: string;
  fecha_firma: string; // YYYY-MM-DD
}

const t = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** Primer llenado: lo que ya está en el sistema (empresa, cliente, moto, contrato y la cuenta BCP de la empresa). */
export function camposDesdeSistema(empresa: Empresa, cliente: Cliente, moto: Moto, contrato: Contrato, cuentas: Cuenta[], hoy: string): CamposContrato {
  const propias = cuentas.filter((c) => c.empresa_id === empresa.id && c.activa);
  const cuenta = propias.find((c) => c.medio === "banco" && c.nombre.startsWith("BCP") && !c.nombre.includes("·")) ?? propias.find((c) => c.medio === "banco") ?? propias[0];
  return {
    empresa: empresa.nombre.toUpperCase(),
    ruc: t(empresa.ruc),
    representante: t(empresa.representante),
    representante_dni: t(empresa.representante_dni),
    domicilio_empresa: t(empresa.domicilio),
    cliente: cliente.nombres,
    doc_tipo: !cliente.dni || cliente.dni.length === 8 ? "DNI" : "CE",
    doc_numero: t(cliente.dni),
    domicilio_cliente: t(cliente.direccion),
    vehiculo: /lineal|scooter/i.test(moto.tipo) ? "MOTOCICLETA" : "MOTOTAXI",
    placa: t(moto.placa),
    marca: moto.marca.toUpperCase(),
    modelo: t(moto.modelo),
    anio: t(moto.anio),
    clase: t(moto.clase),
    combustible: t(moto.combustible),
    color: moto.color.toUpperCase(),
    serie: t(moto.serie),
    motor: t(moto.motor),
    carroceria: t(moto.carroceria),
    plazo_meses: String(Math.max(1, Math.round(contrato.frecuencia === "mensual" ? contrato.nro_cuotas : contrato.frecuencia === "quincenal" ? contrato.nro_cuotas / 2 : (contrato.nro_cuotas * 7) / 30.44))),
    inicio: contrato.fecha_inicio,
    renta: String(contrato.monto_cuota),
    frecuencia: contrato.frecuencia === "mensual" ? "MENSUAL" : contrato.frecuencia === "quincenal" ? "QUINCENAL" : "SEMANAL",
    cuenta: cuenta?.nombre ?? "",
    inicial: t(contrato.inicial),
    ciudad: "Lima",
    fecha_firma: hoy,
  };
}

/** Datos guardados del contrato sobre los del sistema (los guardados mandan). */
export function camposGuardados(base: CamposContrato, guardado: Record<string, string> | null | undefined): CamposContrato {
  if (!guardado) return base;
  const r = { ...base };
  for (const k of Object.keys(base) as (keyof CamposContrato)[]) if (typeof guardado[k] === "string") (r as Record<string, string>)[k] = guardado[k];
  return r;
}

/** Fecha de fin: inicio + plazo en meses. */
export function fechaFin(c: Pick<CamposContrato, "inicio" | "plazo_meses">): string {
  const meses = Number(c.plazo_meses);
  return c.inicio && meses >= 1 ? sumarMeses(c.inicio, meses) : "";
}

const ETIQUETAS: Record<keyof CamposContrato, string> = {
  empresa: "Empresa (razón social)",
  ruc: "RUC",
  representante: "Representante (gerente)",
  representante_dni: "DNI del representante",
  domicilio_empresa: "Domicilio de la empresa",
  cliente: "Nombre del cliente",
  doc_tipo: "Tipo de documento",
  doc_numero: "N.º de documento",
  domicilio_cliente: "Domicilio del cliente",
  vehiculo: "Tipo de vehículo",
  placa: "Placa",
  marca: "Marca",
  modelo: "Modelo",
  anio: "Año de modelo",
  clase: "Clase",
  combustible: "Combustible",
  color: "Color",
  serie: "N.º de serie",
  motor: "N.º de motor",
  carroceria: "Carrocería",
  plazo_meses: "Plazo (meses)",
  inicio: "Fecha de inicio",
  renta: "Renta",
  frecuencia: "Frecuencia de la renta",
  cuenta: "Cuenta de depósito",
  inicial: "Inicial",
  ciudad: "Ciudad",
  fecha_firma: "Fecha de firma",
};
export const etiquetaCampo = (k: keyof CamposContrato) => ETIQUETAS[k];

/** Campos que faltan (saldrán con raya). */
export function camposFaltantes(c: CamposContrato): (keyof CamposContrato)[] {
  return (Object.keys(ETIQUETAS) as (keyof CamposContrato)[]).filter((k) => !String(c[k] ?? "").trim());
}

/** Revisa un dato de la pasarela: devuelve el problema en palabras o null si está bien. Todo es obligatorio. */
export function problemaCampo(c: CamposContrato, k: keyof CamposContrato): string | null {
  const x = String(c[k] ?? "").trim();
  if (!x) return "Falta este dato.";
  const n = Number(x.replace(/,/g, ""));
  switch (k) {
    case "ruc":
      return /^\d{11}$/.test(x) ? null : "El RUC tiene 11 números.";
    case "representante_dni":
      return /^\d{8}$/.test(x) ? null : "El DNI tiene 8 números.";
    case "doc_numero":
      return c.doc_tipo === "DNI" ? (/^\d{8}$/.test(x) ? null : "El DNI tiene 8 números.") : /^\d{9,12}$/.test(x) ? null : "El Carné de Extranjería tiene de 9 a 12 números.";
    case "anio":
      return /^\d{4}$/.test(x) && n >= 1990 && n <= 2100 ? null : "Escribe el año con 4 números (ej.: 2026).";
    case "plazo_meses":
      return Number.isInteger(n) && n >= 1 && n <= 120 ? null : "Escribe los meses (1 a 120).";
    case "renta":
      return n > 0 ? null : "Escribe un monto mayor a 0.";
    case "inicial":
      return Number.isFinite(n) && n >= 0 ? null : "Escribe el monto (0 si no dejó inicial).";
    case "inicio":
    case "fecha_firma":
      return /^\d{4}-\d{2}-\d{2}$/.test(x) ? null : "Elige la fecha.";
    default:
      return null;
  }
}

/** HTML del contrato llenado (la misma plantilla en blanco, con los datos escritos y las casillas marcadas). */
export function htmlContrato(c: CamposContrato, opciones: { vistaPrevia?: boolean } = {}): string {
  return htmlPlantillaContrato(c, opciones);
}
