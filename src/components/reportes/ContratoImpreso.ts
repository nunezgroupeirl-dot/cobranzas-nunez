import { fechaEnLetras, solesEnLetras, sumarMeses } from "@/lib/letras";
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
  frecuencia: "DIARIA" | "SEMANAL";
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
    doc_tipo: cliente.dni.length === 8 ? "DNI" : "CE",
    doc_numero: cliente.dni,
    domicilio_cliente: t(cliente.direccion),
    vehiculo: /lineal|scooter/i.test(moto.tipo) ? "MOTOCICLETA" : "MOTOTAXI",
    placa: moto.placa,
    marca: moto.marca.toUpperCase(),
    modelo: t(moto.modelo),
    anio: t(moto.anio),
    clase: t(moto.clase),
    combustible: t(moto.combustible),
    color: moto.color.toUpperCase(),
    serie: t(moto.serie),
    motor: t(moto.motor),
    carroceria: t(moto.carroceria),
    plazo_meses: String(Math.max(1, Math.round((contrato.nro_cuotas * 7) / 30.44))),
    inicio: contrato.fecha_inicio,
    renta: String(contrato.monto_cuota),
    frecuencia: "SEMANAL",
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

const esc = (x: string) => x.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch] ?? ch);
/** Dato o raya para llenar a mano si falta. */
const v = (x: string | null | undefined, ancho = 160) => (!x || !String(x).trim() ? `<span class="raya" style="width:${ancho}px"></span>` : esc(String(x).trim()));
const numero = (x: string) => {
  const n = Number(String(x).replace(/,/g, ""));
  return String(x).trim() && Number.isFinite(n) && n > 0 ? n : null;
};
const monto = (n: number) => n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fecha = (f: string, ancho = 190) => (/^\d{4}-\d{2}-\d{2}$/.test(f) ? fechaEnLetras(f) : v(null, ancho));
const documento = (c: CamposContrato) => (c.doc_tipo === "DNI" ? `DNI de N.º ${v(c.doc_numero, 90)}` : `Carné de Extranjería N.º ${v(c.doc_numero, 110)}`);
const documentoCorto = (c: CamposContrato) => (c.doc_tipo === "DNI" ? `DNI: ${v(c.doc_numero, 90)}` : `Carné de Extranjería N.º ${v(c.doc_numero, 110)}`);

/** HTML del contrato (A4) para imprimir o guardar como PDF. `vistaPrevia` quita el aviso de pantalla y la impresión automática. */
export function htmlContrato(c: CamposContrato, { vistaPrevia = false } = {}): string {
  const esMototaxi = c.vehiculo === "MOTOTAXI";
  const renta = numero(c.renta);
  const inicial = numero(c.inicial);
  const textoRenta = renta === null ? `${v(null, 80)} soles (${v(null, 240)})` : `<b>${monto(renta)} soles</b> (${solesEnLetras(renta)})`;
  const textoInicial = inicial === null ? `${v(null, 80)} soles (${v(null, 240)})` : `<b>${monto(inicial)} soles</b> (${solesEnLetras(inicial)})`;
  const plazo = Number(c.plazo_meses) >= 1 ? `<b>${Number(c.plazo_meses)} meses</b>` : `${v(null, 50)} meses`;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Contrato ${esc(c.placa)} - ${esc(c.cliente)}</title>
<style>
@page{size:A4;margin:20mm 20mm 18mm}
body{font-family:Arial,Helvetica,sans-serif;color:#000;font-size:11pt;line-height:1.55;margin:0}
h1{text-align:center;font-size:14pt;margin:0 0 16px}
p{margin:0 0 11px;text-align:justify}
b{font-weight:700}
.raya{display:inline-block;border-bottom:1px solid #000;height:1em;vertical-align:baseline}
.ficha{display:grid;grid-template-columns:1fr 1fr;gap:4px 30px;margin:4px 0 12px 30px}
.firmas{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:70px;page-break-inside:avoid}
.firma{display:flex;gap:10px;align-items:flex-start}
.firma .linea{flex:1;border-top:1px solid #000;padding-top:4px;font-size:10pt;line-height:1.4}
.huella{width:68px;height:88px;border:1px solid #888;border-radius:6px;flex:none;display:flex;align-items:flex-end;justify-content:center;font-size:7pt;color:#777;padding-bottom:3px;box-sizing:border-box}
.pie{margin-top:28px;font-size:8pt;color:#555;border-top:1px solid #ccc;padding-top:4px}
.ok{display:none}
@media screen{body{max-width:180mm;margin:20px auto;padding:0 10mm}${vistaPrevia ? "" : ".ok{display:block;background:#fff5d6;border:1px solid #e6c65c;padding:8px 12px;border-radius:8px;font-size:10pt;margin-bottom:16px}"}}
</style></head><body>
<div class="ok">Vista para imprimir. En la ventana de impresión elige la impresora o <b>Guardar como PDF</b>.</div>
<h1>Contrato de Alquiler Venta de ${esMototaxi ? "Mototaxi" : "Motocicleta"}</h1>

<p>Conste por el presente documento el contrato de <b>ALQUILER VENTA</b> del vehículo de placa de rodaje N.º <b>${v(c.placa, 100)}</b> que celebran de una parte la empresa <b>${v(c.empresa, 260)}</b>, con número de RUC ${v(c.ruc, 110)}, representada por el Sr. ${v(c.representante, 220)} con DNI de N.º ${v(c.representante_dni, 90)} con domicilio en ${v(c.domicilio_empresa, 300)}, a quien en adelante se le llamará <b>EL ARRENDADOR</b>; y de la otra parte el Sr. <b>${v(c.cliente, 260)}</b> con ${documento(c)} con domicilio en ${v(c.domicilio_cliente, 300)}, que para los efectos del presente contrato se le denominará <b>EL ARRENDATARIO</b>, sujeto a los términos y condiciones siguientes:</p>

<p><b>PRIMERO.</b> <b>EL ARRENDADOR</b> da en alquiler venta a <b>EL ARRENDATARIO</b> el vehículo <b>${c.vehiculo} ${v(c.marca, 90)}</b> de placa de rodaje N.º <b>${v(c.placa, 100)}</b> y que presenta las siguientes características:</p>
<div class="ficha">
<div>Clase: ${v(c.clase, 100)}</div><div>Combustible: ${v(c.combustible, 140)}</div>
<div>Marca: ${v(c.marca, 100)}</div><div>Color: ${v(c.color, 120)}</div>
<div>Modelo: ${v(c.modelo, 140)}</div><div>N.º de serie: ${v(c.serie, 170)}</div>
<div>Año de modelo: ${v(c.anio, 70)}</div><div>N.º motor: ${v(c.motor, 170)}</div>
<div></div><div>Carrocería: ${v(c.carroceria, 150)}</div>
</div>

<p><b>SEGUNDO.</b> <b>EL ARRENDATARIO</b> destinará el vehículo materia del presente contrato única y exclusivamente al <b>SERVICIO DE ${esMototaxi ? "MOTOTAXI" : "TRANSPORTE"}</b>, quedando prohibido variar su finalidad.</p>

<p><b>TERCERO.</b> <b>EL ARRENDATARIO</b> está prohibido de traspasar o subarrendar el vehículo materia del presente contrato, total o parcialmente, a favor de terceros, reservándose <b>EL ARRENDADOR</b> el derecho de resolver el presente contrato.</p>

<p><b>CUARTO.</b> El plazo de duración del presente contrato es de ${plazo} previo acuerdo de ambas partes. La validez del presente contrato empieza el <b>${fecha(c.inicio)}</b> y termina el <b>${fecha(fechaFin(c))}</b>. Al no cumplir los términos y condiciones del presente contrato, <b>EL ARRENDATARIO</b> queda obligado a devolver el vehículo en las mismas condiciones en que lo recibió, sin necesidad de notificación, requerimiento o aviso previo de <b>EL ARRENDADOR</b>. De incumplir con las cláusulas precedentes, se resolverá el contrato de pleno derecho, amparado en el artículo 1429 del Código Civil.</p>

<p><b>QUINTO.</b> <b>EL ARRENDADOR</b> tiene el derecho a modificar el contrato, si se afectan las cláusulas pactadas en el contrato.</p>

<p><b>SEXTO.</b> La renta pactada de común acuerdo por el <b>ALQUILER VENTA</b> del vehículo es de ${textoRenta}, que se depositará en forma <b>${c.frecuencia}</b> en la cuenta <b>${v(c.cuenta, 220)}</b>, teniendo la obligación de mandar el váucher del depósito. Al no mandar el váucher de depósito, se tomará en cuenta que no realizó el depósito a <b>EL ARRENDADOR</b>, que tendrá el derecho de quitar el vehículo por <b>INCUMPLIMIENTO DEL ARRENDATARIO</b>.</p>

<p><b>SÉPTIMO.</b> <b>EL ARRENDATARIO</b> declara que recibe el vehículo en perfecto estado de conservación y funcionamiento, con sus llaves, tarjeta de propiedad y SOAT (vigente), dejando constancia de que el vencimiento del SOAT será única y exclusivamente responsabilidad de <b>EL ARRENDATARIO</b>. <b>EL ARRENDATARIO</b> tiene la obligación de tramitar un nuevo SOAT ante el seguro correspondiente.</p>

<p><b>OCTAVO.</b> Es obligación <b>DIARIA</b> de <b>EL ARRENDATARIO</b> la limpieza interior y exterior del vehículo, así como la revisión de freno, batería, embrague, aceite, etc., para el funcionamiento diario adecuado, haciéndolo presente a <b>EL ARRENDADOR</b>.</p>

<p><b>NOVENO.</b> Cualquier desperfecto o rotura que suceda en el vehículo durante la vigencia de este contrato deberá ser reparado o repuesto por <b>EL ARRENDATARIO</b>.</p>

<p><b>DÉCIMO.</b> Las infracciones de tránsito, temas ilegales, accidentes y choques que cometiera <b>EL ARRENDATARIO</b> y que correspondan al vehículo serán de responsabilidad de <b>EL ARRENDATARIO</b>, y deberá comunicarlo a <b>EL ARRENDADOR</b>.</p>

<p><b>DÉCIMO PRIMERO.</b> <b>EL ARRENDATARIO</b> dejará la suma de ${textoInicial} como inicial para responder por la integridad del vehículo.</p>

<p><b>DÉCIMO SEGUNDO.</b> <b>EL ARRENDADOR</b> tendrá el derecho de quitar el vehículo por el incumplimiento de alguna de las cláusulas anteriores por parte de <b>EL ARRENDATARIO</b>, exonerándose así del derecho de devolución de los <b>${inicial === null ? v(null, 80) : monto(inicial)} soles</b> de inicial.</p>

<p style="margin-top:22px">En señal de conformidad, las partes firman el presente contrato en ${v(c.ciudad, 100)}, el ${fecha(c.fecha_firma)}.</p>

<div class="firmas">
<div class="firma"><div class="linea"><b>${v(c.empresa, 180)}</b><br>RUC: ${v(c.ruc, 100)}<br>Gerente: ${v(c.representante, 150)}<br>DNI: ${v(c.representante_dni, 90)}<br><b>EL ARRENDADOR</b></div><div class="huella">Huella</div></div>
<div class="firma"><div class="linea"><b>${v(c.cliente, 180)}</b><br>${documentoCorto(c)}<br><b>EL ARRENDATARIO</b></div><div class="huella">Huella</div></div>
</div>
<div class="pie">Placa ${v(c.placa, 70)} · ${v(c.cliente, 120)} · ${documentoCorto(c)} — Una vez firmado, escanéalo y súbelo en la pantalla del contrato.</div>
${vistaPrevia ? "" : "<script>window.onload=function(){setTimeout(function(){window.print()},400)}</script>"}
</body></html>`;
}
