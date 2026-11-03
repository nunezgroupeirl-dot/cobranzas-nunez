import type { CamposContrato } from "@/components/reportes/ContratoImpreso";

type Clave = keyof CamposContrato;

export interface CampoGuia {
  clave: Clave;
  /** texto de ayuda bajo el campo */
  guia?: string;
  ejemplo?: string;
  tipo?: "texto" | "numero" | "fecha" | "opciones";
  opciones?: { valor: string; texto: string }[];
  /** ocupa las dos columnas */
  ancho?: boolean;
  mayusculas?: boolean;
  soloNumeros?: number; // largo máximo
}

export interface Paso {
  titulo: string;
  guia: string;
  campos: CampoGuia[];
}

/** Los 4 pasos del llenado, en el mismo orden en que aparecen en el contrato. */
export const PASOS: Paso[] = [
  {
    titulo: "1. El arrendador (la empresa)",
    guia: "La empresa dueña de la moto y quien firma por ella. Tal como figura en la ficha RUC.",
    campos: [
      { clave: "empresa", ancho: true, mayusculas: true, ejemplo: "INVERSIONES ANNE E.I.R.L." },
      { clave: "ruc", soloNumeros: 11, ejemplo: "20615867161" },
      { clave: "representante_dni", soloNumeros: 8, ejemplo: "48140469" },
      { clave: "representante", ancho: true, ejemplo: "Andrés Alexander Núñez Torres" },
      { clave: "domicilio_empresa", ancho: true, guia: "Con distrito y provincia.", ejemplo: "Mz 6 Lt 4 Santiago Antúnez de Mayolo, Pamplona Alta, San Juan de Miraflores - Lima" },
    ],
  },
  {
    titulo: "2. El arrendatario (el cliente)",
    guia: "Quien recibe la moto. Copia el nombre y el número tal como están en su documento.",
    campos: [
      { clave: "cliente", ancho: true, ejemplo: "Josman Enrique Lobo Uribe" },
      {
        clave: "doc_tipo",
        tipo: "opciones",
        opciones: [
          { valor: "DNI", texto: "DNI" },
          { valor: "CE", texto: "Carné de Extranjería" },
        ],
      },
      { clave: "doc_numero", soloNumeros: 12, guia: "DNI: 8 números · Carné: 9 a 12." },
      { clave: "domicilio_cliente", ancho: true, guia: "Dirección completa con distrito.", ejemplo: "Jr. Bolognesi 133, Carmen de la Legua Reynoso - Callao" },
    ],
  },
  {
    titulo: "3. El vehículo",
    guia: "Cópialo de la tarjeta de propiedad de la moto.",
    campos: [
      {
        clave: "vehiculo",
        tipo: "opciones",
        ancho: true,
        opciones: [
          { valor: "MOTOTAXI", texto: "Mototaxi" },
          { valor: "MOTOCICLETA", texto: "Motocicleta" },
        ],
      },
      { clave: "placa", mayusculas: true, ejemplo: "1215-RD" },
      { clave: "marca", mayusculas: true, ejemplo: "TVS" },
      { clave: "modelo", mayusculas: true, ejemplo: "TVS KING LS+ DP IT" },
      { clave: "anio", soloNumeros: 4, ejemplo: "2027" },
      { clave: "clase", mayusculas: true, ejemplo: "L5" },
      { clave: "combustible", mayusculas: true, ejemplo: "BI-COMBUSTIBLE GLP" },
      { clave: "color", mayusculas: true, ejemplo: "AZUL" },
      { clave: "carroceria", mayusculas: true, ejemplo: "TRIMOTO PASAJEROS" },
      { clave: "serie", mayusculas: true, ejemplo: "MD6M14LA3V4AA1841" },
      { clave: "motor", mayusculas: true, ejemplo: "AK4AV41A6496" },
    ],
  },
  {
    titulo: "4. Plazo, renta y firma",
    guia: "Lo acordado con el cliente. El monto se escribe solo en letras en el contrato.",
    campos: [
      { clave: "plazo_meses", soloNumeros: 3, ejemplo: "12" },
      { clave: "inicio", tipo: "fecha" },
      { clave: "renta", tipo: "numero", guia: "En soles, por día o por semana según la frecuencia.", ejemplo: "57.80" },
      {
        clave: "frecuencia",
        tipo: "opciones",
        opciones: [
          { valor: "SEMANAL", texto: "Semanal" },
          { valor: "DIARIA", texto: "Diaria" },
        ],
      },
      { clave: "cuenta", ancho: true, guia: "Elige una cuenta de la empresa o escríbela.", ejemplo: "BCP 1944202917005" },
      { clave: "inicial", tipo: "numero", guia: "En soles.", ejemplo: "7000" },
      { clave: "ciudad", ejemplo: "Lima" },
      { clave: "fecha_firma", tipo: "fecha" },
    ],
  },
];
