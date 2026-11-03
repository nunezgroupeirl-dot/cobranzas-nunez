import { etiquetaCampo, problemaCampo, type CamposContrato } from "@/components/reportes/ContratoImpreso";
import type { Cliente, Cuenta, Empresa, Frecuencia, Moto } from "@/types/database";
import { fechaCuota } from "@/lib/supabase/reglas";
import { PASOS, type Paso } from "../../documento/_componentes/pasos";

/**
 * Todo lo que se llena al crear un contrato nuevo: los datos del contrato impreso
 * más lo que necesita el sistema (celular, n.º de cuotas, frecuencia del cronograma, precio).
 */
export type Borrador = Omit<CamposContrato, "frecuencia" | "plazo_meses"> & {
  frec: Frecuencia;
  nro_cuotas: string;
  celular: string;
  precio: string;
};
export type ClaveBorrador = keyof Borrador;

const EXTRA: Record<"frec" | "nro_cuotas" | "celular" | "precio", string> = {
  frec: "Se paga",
  nro_cuotas: "Número de cuotas",
  celular: "Celular del cliente",
  precio: "Precio de la moto (S/)",
};
const ETIQUETA_PROPIA: Partial<Record<ClaveBorrador, string>> = { renta: "Monto de cada cuota (S/)", inicio: "Fecha de la 1.ª cuota", inicial: "Inicial entregada (S/)" };

export const etiquetaBorrador = (k: ClaveBorrador) =>
  ETIQUETA_PROPIA[k] ?? (k in EXTRA ? EXTRA[k as keyof typeof EXTRA] : etiquetaCampo(k as keyof CamposContrato));

const MESES_POR_CUOTA: Record<Frecuencia, number> = { semanal: 7 / 30.44, quincenal: 0.5, mensual: 1 };
/** Plazo del contrato en meses, según cuántas cuotas y cada cuánto. */
export const plazoMeses = (b: Pick<Borrador, "frec" | "nro_cuotas">) => {
  const n = Number(b.nro_cuotas);
  return Number.isInteger(n) && n > 0 ? Math.max(1, Math.round(n * MESES_POR_CUOTA[b.frec])) : 0;
};
/** Fecha de la última cuota (igual que el cronograma). */
export const ultimaCuota = (b: Pick<Borrador, "frec" | "nro_cuotas" | "inicio">) => {
  const n = Number(b.nro_cuotas);
  return b.inicio && Number.isInteger(n) && n > 0 ? fechaCuota(b.inicio, n - 1, b.frec) : "";
};

/** El borrador convertido en los datos que se imprimen en el contrato. */
export function aCampos(b: Borrador): CamposContrato {
  const resto = Object.fromEntries(Object.entries(b).filter(([k]) => !["frec", "nro_cuotas", "celular", "precio"].includes(k))) as Omit<Borrador, "frec" | "nro_cuotas" | "celular" | "precio">;
  const frec = b.frec;
  const plazo = plazoMeses(b);
  return { ...resto, plazo_meses: plazo ? String(plazo) : "", frecuencia: frec === "mensual" ? "MENSUAL" : frec === "quincenal" ? "QUINCENAL" : "SEMANAL" };
}

export function problemaBorrador(b: Borrador, k: ClaveBorrador): string | null {
  const x = String(b[k] ?? "").trim();
  switch (k) {
    case "celular":
      return !x || /^9\d{8}$/.test(x) ? null : "El celular tiene 9 números y empieza con 9.";
    case "precio":
      return !x || Number(x) >= 0 ? null : "Escribe un monto válido.";
    case "nro_cuotas": {
      const n = Number(x);
      return Number.isInteger(n) && n >= 1 && n <= 260 ? null : "Entre 1 y 260 cuotas.";
    }
    case "frec":
      return null;
    default:
      return problemaCampo(aCampos(b), k as keyof CamposContrato);
  }
}

type C = ClaveBorrador;
const campos = (i: number) => PASOS[i].campos as Paso<C>["campos"];

/** Los 4 pasos para crear el contrato, en el orden del papel. */
export const PASOS_NUEVO: Paso<C>[] = [
  { ...PASOS[0], campos: campos(0) },
  {
    ...PASOS[1],
    guia: "Busca al cliente si ya está registrado, o escribe sus datos tal como están en su documento.",
    campos: [...campos(1).slice(0, 3), { clave: "celular", soloNumeros: 9, opcional: true, ejemplo: "987654321" }, campos(1)[3]],
  },
  { ...PASOS[2], guia: "Cópialo de la tarjeta de propiedad. Si el cliente ya tiene una moto registrada, elígela arriba.", campos: campos(2) },
  {
    corto: "Cuotas y renta",
    titulo: "4. Cuotas, renta y firma",
    guia: "Lo acordado con el cliente. Con esto se arma el cronograma de pagos y el plazo del contrato.",
    campos: [
      {
        clave: "frec",
        tipo: "opciones",
        ancho: true,
        opciones: [
          { valor: "semanal", texto: "Cada semana" },
          { valor: "quincenal", texto: "Cada quincena" },
          { valor: "mensual", texto: "Cada mes" },
        ],
      },
      { clave: "renta", tipo: "numero", guia: "Lo que paga en cada cuota. Sale en letras en el contrato.", ejemplo: "350" },
      { clave: "nro_cuotas", soloNumeros: 3, ejemplo: "52" },
      { clave: "inicio", tipo: "fecha", guia: "Desde aquí empieza el contrato." },
      { clave: "inicial", tipo: "numero", guia: "Escribe 0 si no dejó inicial.", ejemplo: "3000" },
      { clave: "precio", tipo: "numero", opcional: true, ejemplo: "18000" },
      { clave: "cuenta", ancho: true, guia: "Banco y número donde deposita. Elige una cuenta de la empresa o escríbela.", ejemplo: "BCP 1944202917005" },
      { clave: "ciudad", ejemplo: "Lima" },
      { clave: "fecha_firma", tipo: "fecha" },
    ],
  },
];

export const pasoNuevoListo = (i: number, b: Borrador) => PASOS_NUEVO[i].campos.every((c) => !problemaBorrador(b, c.clave));

const t = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** Cuenta que sale por defecto: la BCP de la empresa (o la primera de banco). */
export function cuentaPorDefecto(cuentas: Cuenta[], empresaId: string): string {
  const propias = cuentas.filter((c) => c.empresa_id === empresaId && c.activa);
  const c = propias.find((x) => x.medio === "banco" && x.nombre.startsWith("BCP") && !x.nombre.includes("·")) ?? propias.find((x) => x.medio === "banco") ?? propias[0];
  return c?.nombre ?? "";
}

export const datosEmpresa = (e: Empresa) => ({
  empresa: e.nombre.toUpperCase(),
  ruc: t(e.ruc),
  representante: t(e.representante),
  representante_dni: t(e.representante_dni),
  domicilio_empresa: t(e.domicilio),
});

export const datosCliente = (c: Cliente | null) => ({
  cliente: c?.nombres ?? "",
  doc_tipo: (c?.dni && c.dni.length !== 8 ? "CE" : "DNI") as Borrador["doc_tipo"],
  doc_numero: t(c?.dni),
  celular: t(c?.celular),
  domicilio_cliente: t(c?.direccion),
});

export const datosMoto = (m: Moto | null) => ({
  vehiculo: (m && /lineal|scooter/i.test(m.tipo) ? "MOTOCICLETA" : "MOTOTAXI") as Borrador["vehiculo"],
  placa: t(m?.placa),
  marca: (m?.marca ?? "").toUpperCase(),
  modelo: t(m?.modelo),
  anio: t(m?.anio),
  clase: t(m?.clase),
  combustible: t(m?.combustible),
  color: (m?.color ?? "").toUpperCase(),
  serie: t(m?.serie),
  motor: t(m?.motor),
  carroceria: t(m?.carroceria),
});

export function borradorInicial(hoy: string, primeraCuota: string): Borrador {
  return {
    ...{ empresa: "", ruc: "", representante: "", representante_dni: "", domicilio_empresa: "" },
    ...datosCliente(null),
    ...datosMoto(null),
    frec: "semanal",
    renta: "",
    nro_cuotas: "52",
    inicio: primeraCuota,
    inicial: "",
    precio: "",
    cuenta: "",
    ciudad: "Lima",
    fecha_firma: hoy,
  };
}
