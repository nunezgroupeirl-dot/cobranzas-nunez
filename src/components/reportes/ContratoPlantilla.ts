/**
 * EL contrato de alquiler venta (A4, 2 hojas). Una sola plantilla para todo:
 *  · sin datos → sale EN BLANCO, con rayas y casillas para llenarlo a mano;
 *  · con datos (pasarela de la página) → cada raya sale con su dato y las casillas marcadas.
 * Lo único que siempre queda en blanco: las firmas y las huellas.
 */
import { enteroEnLetras, sumarMeses } from "@/lib/letras";
import type { CamposContrato } from "./ContratoImpreso";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const esc = (x: string) => x.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch] ?? ch);

/** Raya para escribir a mano, o el dato escrito sobre la raya. */
const r = (ancho: number, valor?: string | null) => {
  const x = (valor ?? "").trim();
  return x ? `<span class="dato" style="min-width:${Math.round(ancho * 0.6)}px">${esc(x)}</span>` : `<span class="raya" style="width:${ancho}px"></span>`;
};
/** Casilla para marcar (con ✓ si va marcada). */
const casilla = (texto: string, marcada = false) => `<span class="op"><span class="casilla">${marcada ? "✓" : ""}</span> ${texto}</span>`;

/** "2026-09-16" → día, mes y año en rayas: "16 de septiembre del 2026" */
function fechaRayas(f: string | undefined) {
  const ok = !!f && /^\d{4}-\d{2}-\d{2}$/.test(f);
  const [a, m, d] = ok ? f.split("-").map(Number) : [0, 0, 0];
  return `${r(40, ok ? String(d) : "")} de ${r(110, ok ? MESES[m - 1] : "")} del ${r(60, ok ? String(a) : "")}`;
}

const numero = (x: string | undefined) => {
  const t = String(x ?? "").replace(/,/g, "").trim();
  const n = Number(t);
  return t && Number.isFinite(n) && n >= 0 ? n : null;
};
const monto = (n: number) => n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** "S/ 57.80 (cincuenta y siete con 80/100 soles)" en rayas */
function montoRayas(x: string | undefined) {
  const n = numero(x);
  if (n === null) return `S/ ${r(90)} (${r(330)} soles)`;
  const centimos = Math.round(n * 100);
  return `S/ ${r(90, monto(n))} (${r(330, `${enteroEnLetras(Math.floor(centimos / 100))} con ${String(centimos % 100).padStart(2, "0")}/100`)} soles)`;
}

/** "BCP 1944202917005" → banco "BCP" y número "1944202917005" (para las 2 rayas de la cláusula sexta). */
export function partirCuenta(cuenta: string | undefined): { banco: string; numero: string } {
  const t = (cuenta ?? "").trim();
  const m = t.match(/^(.*?)[\s·:#-]*(\d[\d\s-]{5,})$/);
  if (!m) return { banco: t, numero: "" };
  return { banco: m[1].replace(/[·\s-]+$/, "").trim(), numero: m[2].replace(/\s/g, "") };
}

/** Fin del contrato: inicio + plazo en meses. */
const fin = (c: Partial<CamposContrato>) => (c.inicio && Number(c.plazo_meses) >= 1 ? sumarMeses(c.inicio, Number(c.plazo_meses)) : "");

interface Opciones {
  /** Para el recuadro de vista previa: sin aviso de pantalla ni impresión automática. */
  vistaPrevia?: boolean;
}

/** HTML del contrato: en blanco (sin `c`) o llenado con los datos de la pasarela. */
export function htmlPlantillaContrato(c?: Partial<CamposContrato> | null, { vistaPrevia = false }: Opciones = {}): string {
  const d: Partial<CamposContrato> = c ?? {};
  const lleno = !!c;
  const mototaxi = d.vehiculo !== "MOTOCICLETA";
  const cuenta = partirCuenta(d.cuenta);
  const titulo = lleno ? `Contrato ${d.placa || "sin placa"} - ${d.cliente || ""}` : "Contrato de Alquiler Venta - plantilla en blanco";
  const aviso = lleno
    ? "Contrato llenado. En la ventana de impresión elige la impresora o <b>Guardar como PDF</b>. Solo faltan las firmas y las huellas."
    : "Plantilla en blanco. En la ventana de impresión elige la impresora o <b>Guardar como PDF</b>.";

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<style>
@page{size:A4;margin:14mm 16mm 12mm}
body{font-family:Arial,Helvetica,sans-serif;color:#000;font-size:10.5pt;line-height:1.8;margin:0}
h1{text-align:center;font-size:14pt;margin:0 0 6px;line-height:1.3}
.codigo{text-align:right;font-size:9pt;margin-bottom:8px}
p{margin:0 0 6px;text-align:justify}
p.llenar{text-align:left}
.op{white-space:nowrap}
b{font-weight:700}
.raya{display:inline-block;border-bottom:1px solid #000;height:1.1em;vertical-align:baseline}
.dato{display:inline-block;border-bottom:1px solid #000;padding:0 4px;font-weight:700;line-height:1.3;text-align:center}
.casilla{display:inline-block;width:11px;height:11px;border:1.2px solid #000;vertical-align:-1px;margin-left:4px;font-size:10px;line-height:11px;text-align:center;font-weight:700}
.ficha{display:grid;grid-template-columns:1fr 1fr;gap:0 26px;margin:0 0 8px 24px}
.firmas{display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:52px;page-break-inside:avoid}
.firma{display:flex;gap:10px;align-items:flex-start}
.firma .linea{flex:1;border-top:1px solid #000;padding-top:4px;font-size:9.5pt;line-height:1.9}
.huella{width:68px;height:88px;border:1px solid #888;border-radius:6px;flex:none;display:flex;align-items:flex-end;justify-content:center;font-size:7pt;color:#777;padding-bottom:3px;box-sizing:border-box}
.pie{margin-top:22px;font-size:8pt;color:#555;border-top:1px solid #ccc;padding-top:4px;line-height:1.4}
.ok{display:none}
@media screen{body{max-width:180mm;margin:20px auto;padding:0 10mm}${vistaPrevia ? "" : ".ok{display:block;background:#fff5d6;border:1px solid #e6c65c;padding:8px 12px;border-radius:8px;font-size:10pt;margin-bottom:16px;line-height:1.4}"}}
</style></head><body>
<div class="ok">${aviso}</div>
<h1>Contrato de Alquiler Venta de ${lleno && !mototaxi ? "Motocicleta" : "Mototaxi"}</h1>
<div class="codigo">Placa N.º ${r(110, d.placa)}</div>

<p class="llenar">Conste por el presente documento el contrato de <b>ALQUILER VENTA</b> del vehículo de placa de rodaje N.º ${r(100, d.placa)} que celebran de una parte la empresa ${r(300, d.empresa)}, con número de RUC ${r(130, d.ruc)}, representada por el Sr. ${r(270, d.representante)} con DNI de N.º ${r(110, d.representante_dni)}, con domicilio en ${d.domicilio_empresa?.trim() ? r(560, d.domicilio_empresa) : `${r(560)} ${r(300)}`}, a quien en adelante se le llamará <b>EL ARRENDADOR</b>; y de la otra parte el Sr. ${r(330, d.cliente)} con ${casilla("DNI", lleno && d.doc_tipo === "DNI")} ${casilla("Carné de Extranjería", lleno && d.doc_tipo === "CE")} N.º ${r(130, d.doc_numero)}, con domicilio en ${d.domicilio_cliente?.trim() ? r(520, d.domicilio_cliente) : `${r(520)} ${r(340)}`}, que para los efectos del presente contrato se le denominará <b>EL ARRENDATARIO</b>, sujeto a los términos y condiciones siguientes:</p>

<p class="llenar"><b>PRIMERO.</b> <b>EL ARRENDADOR</b> da en alquiler venta a <b>EL ARRENDATARIO</b> el vehículo ${casilla("MOTOTAXI", lleno && mototaxi)} ${casilla("MOTOCICLETA", lleno && !mototaxi)} de placa de rodaje N.º ${r(100, d.placa)}, que presenta las siguientes características:</p>
<div class="ficha">
<div>Clase: ${r(150, d.clase)}</div><div>Combustible: ${r(170, d.combustible)}</div>
<div>Marca: ${r(150, d.marca)}</div><div>Color: ${r(200, d.color)}</div>
<div>Modelo: ${r(145, d.modelo)}</div><div>N.º de serie: ${r(170, d.serie)}</div>
<div>Año de modelo: ${r(100, d.anio)}</div><div>N.º motor: ${r(185, d.motor)}</div>
<div></div><div>Carrocería: ${r(180, d.carroceria)}</div>
</div>

<p><b>SEGUNDO.</b> <b>EL ARRENDATARIO</b> destinará el vehículo materia del presente contrato única y exclusivamente al <b>SERVICIO DE ${lleno && !mototaxi ? "TRANSPORTE" : "MOTOTAXI"}</b>, quedando prohibido variar su finalidad.</p>

<p><b>TERCERO.</b> <b>EL ARRENDATARIO</b> está prohibido de traspasar o subarrendar el vehículo materia del presente contrato, total o parcialmente, a favor de terceros, reservándose <b>EL ARRENDADOR</b> el derecho de resolver el presente contrato.</p>

<p class="llenar"><b>CUARTO.</b> El plazo de duración del presente contrato es de ${r(50, d.plazo_meses)} meses previo acuerdo de ambas partes. La validez del presente contrato empieza el ${fechaRayas(d.inicio)} y termina el ${fechaRayas(fin(d))}. Al no cumplir los términos y condiciones del presente contrato, <b>EL ARRENDATARIO</b> queda obligado a devolver el vehículo en las mismas condiciones en que lo recibió, sin necesidad de notificación, requerimiento o aviso previo de <b>EL ARRENDADOR</b>. De incumplir con las cláusulas precedentes, se resolverá el contrato de pleno derecho, amparado en el artículo 1429 del Código Civil.</p>

<p><b>QUINTO.</b> <b>EL ARRENDADOR</b> tiene el derecho a modificar el contrato, si se afectan las cláusulas pactadas en el contrato.</p>

<p class="llenar"><b>SEXTO.</b> La renta pactada de común acuerdo por el <b>ALQUILER VENTA</b> del vehículo es de ${montoRayas(d.renta)}, que se depositará en forma ${casilla("DIARIA", d.frecuencia === "DIARIA")} ${casilla("SEMANAL", lleno && d.frecuencia === "SEMANAL")} ${casilla("QUINCENAL", d.frecuencia === "QUINCENAL")} ${casilla("MENSUAL", d.frecuencia === "MENSUAL")} en la cuenta ${r(140, cuenta.banco)} N.º ${r(200, cuenta.numero)}, teniendo la obligación de mandar el váucher del depósito. Al no mandar el váucher de depósito, se tomará en cuenta que no realizó el depósito a <b>EL ARRENDADOR</b>, que tendrá el derecho de quitar el vehículo por <b>INCUMPLIMIENTO DEL ARRENDATARIO</b>.</p>

<p><b>SÉPTIMO.</b> <b>EL ARRENDATARIO</b> declara que recibe el vehículo en perfecto estado de conservación y funcionamiento, con sus llaves, tarjeta de propiedad y SOAT (vigente), dejando constancia de que el vencimiento del SOAT será única y exclusivamente responsabilidad de <b>EL ARRENDATARIO</b>. <b>EL ARRENDATARIO</b> tiene la obligación de tramitar un nuevo SOAT ante el seguro correspondiente.</p>

<p><b>OCTAVO.</b> Es obligación <b>DIARIA</b> de <b>EL ARRENDATARIO</b> la limpieza interior y exterior del vehículo, así como la revisión de freno, batería, embrague, aceite, etc., para el funcionamiento diario adecuado, haciéndolo presente a <b>EL ARRENDADOR</b>.</p>

<p><b>NOVENO.</b> Cualquier desperfecto o rotura que suceda en el vehículo durante la vigencia de este contrato deberá ser reparado o repuesto por <b>EL ARRENDATARIO</b>.</p>

<p><b>DÉCIMO.</b> Las infracciones de tránsito, temas ilegales, accidentes y choques que cometiera <b>EL ARRENDATARIO</b> y que correspondan al vehículo serán de responsabilidad de <b>EL ARRENDATARIO</b>, y deberá comunicarlo a <b>EL ARRENDADOR</b>.</p>

<p class="llenar"><b>DÉCIMO PRIMERO.</b> <b>EL ARRENDATARIO</b> dejará la suma de ${montoRayas(d.inicial)} como inicial para responder por la integridad del vehículo.</p>

<p><b>DÉCIMO SEGUNDO.</b> <b>EL ARRENDADOR</b> tendrá el derecho de quitar el vehículo por el incumplimiento de alguna de las cláusulas anteriores por parte de <b>EL ARRENDATARIO</b>, exonerándose así del derecho de devolución de la inicial.</p>

<p class="llenar" style="margin-top:12px">En señal de conformidad, las partes firman el presente contrato en ${r(120, d.ciudad)}, el ${fechaRayas(d.fecha_firma)}.</p>

<div class="firmas">
<div class="firma"><div class="linea">Empresa: ${r(165, d.empresa)}<br>RUC: ${r(185, d.ruc)}<br>Gerente: ${r(170, d.representante)}<br>DNI: ${r(175, d.representante_dni)}<br><b>EL ARRENDADOR</b></div><div class="huella">Huella</div></div>
<div class="firma"><div class="linea">Nombre: ${r(170, d.cliente)}<br>${casilla("DNI", lleno && d.doc_tipo === "DNI")} ${casilla("C.E.", lleno && d.doc_tipo === "CE")} N.º ${r(105, d.doc_numero)}<br><b>EL ARRENDATARIO</b></div><div class="huella">Huella</div></div>
</div>
<div class="pie">Inversiones Núñez &amp; Asociados — Una vez firmado, escanea o fotografía cada hoja y súbela en la app: Motos y contratos → el contrato → “Contrato firmado”.</div>
${vistaPrevia ? "" : "<script>window.onload=function(){setTimeout(function(){window.print()},400)}</script>"}
</body></html>`;
}

/** Abre la plantilla en blanco lista para imprimir o guardar como PDF. */
export function abrirPlantillaContrato(): boolean {
  const ventana = window.open("", "_blank");
  if (!ventana) return false;
  ventana.document.open();
  ventana.document.write(htmlPlantillaContrato());
  ventana.document.close();
  return true;
}
