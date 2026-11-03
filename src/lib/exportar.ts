/**
 * Exportar: copiar lista en formato WhatsApp y generar Excel (.xlsx) sin librerías externas.
 */
import type { EstadoCliente } from "@/types/database";

/* ---------------- WhatsApp ---------------- */

const soles = (n: number) => `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fecha = (f: string | null) => (f ? f.split("-").reverse().join("/") : "—");
const EMOJI = { verde: "🟢", amarillo: "🟡", rojo: "🔴" } as const;

/** Lista de morosos lista para pegar en WhatsApp (usa *negrita* de WhatsApp). */
export function textoWhatsApp(filas: EstadoCliente[], titulo: string): string {
  const total = filas.reduce((s, f) => s + f.deuda, 0);
  const lineas = filas.map(
    (f, i) =>
      `${i + 1}. ${EMOJI[f.color]} *${f.placa ?? "sin placa"}* · ${f.cliente}\n` +
      `   📞 ${f.celular ?? "—"} · ${f.semanas_atraso} sem. · debe ${soles(f.deuda)} · últ. pago ${fecha(f.ultimo_pago)}`,
  );
  return [`*${titulo}*`, `${filas.length} clientes · Total ${soles(total)}`, "", ...lineas].join("\n");
}

/** Copia texto; funciona también en http (tablet en la red local) con un respaldo. */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    /* seguimos con el respaldo */
  }
  const area = document.createElement("textarea");
  area.value = texto;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(area);
  return ok;
}

/** Abre WhatsApp con el texto (en celular abre la app). */
export function enlaceWhatsApp(texto: string, celular?: string | null): string {
  const numero = celular ? `51${celular.replace(/\D/g, "").slice(-9)}` : "";
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/* ---------------- Excel (.xlsx) ---------------- */

export type Celda = string | number | null | undefined;
export interface Hoja {
  nombre: string;
  columnas: string[];
  filas: Celda[][];
  /** ancho de cada columna en caracteres */
  anchos?: number[];
}

const escapar = (t: string) =>
  t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // caracteres de control no permitidos en XML
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

function letraColumna(i: number): string {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function celdaXml(valor: Celda, ref: string, estilo = 0): string {
  const s = estilo ? ` s="${estilo}"` : "";
  if (valor === null || valor === undefined || valor === "") return `<c r="${ref}"${s}/>`;
  if (typeof valor === "number" && Number.isFinite(valor)) return `<c r="${ref}"${s}><v>${valor}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapar(String(valor))}</t></is></c>`;
}

function hojaXml(h: Hoja): string {
  const anchos = h.columnas.map((c, i) => h.anchos?.[i] ?? Math.min(45, Math.max(10, c.length + 2, ...h.filas.slice(0, 200).map((f) => String(f[i] ?? "").length + 2))));
  const cols = anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
  const cabecera = `<row r="1">${h.columnas.map((c, i) => celdaXml(c, `${letraColumna(i)}1`, 1)).join("")}</row>`;
  const cuerpo = h.filas.map((f, r) => `<row r="${r + 2}">${f.map((v, i) => celdaXml(v, `${letraColumna(i)}${r + 2}`)).join("")}</row>`).join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<cols>${cols}</cols><sheetData>${cabecera}${cuerpo}</sheetData>` +
    (h.filas.length ? `<autoFilter ref="A1:${letraColumna(h.columnas.length - 1)}${h.filas.length + 1}"/>` : "") +
    `</worksheet>`
  );
}

const nombreHoja = (n: string, i: number) => escapar(n.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || `Hoja${i + 1}`);

function archivosXlsx(hojas: Hoja[]): [string, string][] {
  const ct =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    hojas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
    `</Types>`;
  const rels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const libro =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` +
    hojas.map((h, i) => `<sheet name="${nombreHoja(h.nombre, i)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
    `</sheets></workbook>`;
  const librorels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
    `<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const estilos =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>` +
    `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1D2A2F"/><bgColor indexed="64"/></patternFill></fill></fills>` +
    `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `</styleSheet>`;
  return [
    ["[Content_Types].xml", ct],
    ["_rels/.rels", rels],
    ["xl/workbook.xml", libro],
    ["xl/_rels/workbook.xml.rels", librorels],
    ["xl/styles.xml", estilos],
    ...hojas.map((h, i) => [`xl/worksheets/sheet${i + 1}.xml`, hojaXml(h)] as [string, string]),
  ];
}

/* ZIP sin compresión (método "store"), suficiente para Excel */
const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(d: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < d.length; i++) c = TABLA_CRC[(c ^ d[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function crearZip(archivos: [string, string | Uint8Array][]): Uint8Array {
  const enc = new TextEncoder();
  const locales: Uint8Array[] = [];
  const centrales: Uint8Array[] = [];
  let desplazamiento = 0;
  for (const [nombre, contenido] of archivos) {
    const n = enc.encode(nombre);
    const datos = typeof contenido === "string" ? enc.encode(contenido) : contenido;
    const crc = crc32(datos);
    const loc = new Uint8Array(30 + n.length);
    const vl = new DataView(loc.buffer);
    vl.setUint32(0, 0x04034b50, true);
    vl.setUint16(4, 20, true);
    vl.setUint16(6, 0x0800, true); // nombres en UTF-8
    vl.setUint16(8, 0, true);
    vl.setUint32(14, crc, true);
    vl.setUint32(18, datos.length, true);
    vl.setUint32(22, datos.length, true);
    vl.setUint16(26, n.length, true);
    loc.set(n, 30);
    const cen = new Uint8Array(46 + n.length);
    const vc = new DataView(cen.buffer);
    vc.setUint32(0, 0x02014b50, true);
    vc.setUint16(4, 20, true);
    vc.setUint16(6, 20, true);
    vc.setUint16(8, 0x0800, true);
    vc.setUint32(16, crc, true);
    vc.setUint32(20, datos.length, true);
    vc.setUint32(24, datos.length, true);
    vc.setUint16(28, n.length, true);
    vc.setUint32(42, desplazamiento, true);
    cen.set(n, 46);
    locales.push(loc, datos);
    centrales.push(cen);
    desplazamiento += loc.length + datos.length;
  }
  const tamCentral = centrales.reduce((s, c) => s + c.length, 0);
  const fin = new Uint8Array(22);
  const vf = new DataView(fin.buffer);
  vf.setUint32(0, 0x06054b50, true);
  vf.setUint16(8, archivos.length, true);
  vf.setUint16(10, archivos.length, true);
  vf.setUint32(12, tamCentral, true);
  vf.setUint32(16, desplazamiento, true);
  const partes = [...locales, ...centrales, fin];
  const total = new Uint8Array(partes.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of partes) {
    total.set(p, o);
    o += p.length;
  }
  return total;
}

export function crearXlsx(hojas: Hoja[]): Uint8Array {
  return crearZip(archivosXlsx(hojas));
}

/** Descarga un Excel con una o varias hojas. */
export function descargarExcel(nombreArchivo: string, hojas: Hoja[]) {
  const bytes = crearXlsx(hojas);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo.endsWith(".xlsx") ? nombreArchivo : `${nombreArchivo}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
