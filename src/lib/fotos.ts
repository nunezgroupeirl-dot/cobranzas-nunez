/**
 * Fotos: comprimir en el navegador (~200 KB), calcular SHA-256 de la ORIGINAL y subir.
 * Ruta en los buckets: empresa_id/cliente_id/archivo.jpg
 */
import type { Bucket } from "@/types/database";
import type { Datos } from "@/lib/supabase/datos";

const OBJETIVO_BYTES = 200 * 1024;
const LADO_MAXIMO = 1600;

/* ---------------- SHA-256 ---------------- */

const aHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

/** SHA-256 en hexadecimal. Usa crypto.subtle; si no existe (http sin https en la tablet), usa la versión en JS. */
export async function sha256(archivo: Blob): Promise<string> {
  const datos = await archivo.arrayBuffer();
  if (typeof crypto !== "undefined" && crypto.subtle) {
    return aHex(await crypto.subtle.digest("SHA-256", datos));
  }
  return sha256Js(new Uint8Array(datos));
}

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256Js(msg: Uint8Array): string {
  const largo = msg.length;
  const total = Math.ceil((largo + 9) / 64) * 64;
  const buf = new Uint8Array(total);
  buf.set(msg);
  buf[largo] = 0x80;
  const vista = new DataView(buf.buffer);
  vista.setUint32(total - 8, Math.floor((largo * 8) / 2 ** 32));
  vista.setUint32(total - 4, (largo * 8) >>> 0);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rot = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let i = 0; i < total; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = vista.getUint32(i + t * 4);
    for (let t = 16; t < 64; t++) {
      const s0 = rot(w[t - 15], 7) ^ rot(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rot(w[t - 2], 17) ^ rot(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let t = 0; t < 64; t++) {
      const S1 = rot(e, 6) ^ rot(e, 11) ^ rot(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[t] + w[t]) >>> 0;
      const S0 = rot(a, 2) ^ rot(a, 13) ^ rot(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] += a;
    h[1] += b;
    h[2] += c;
    h[3] += d;
    h[4] += e;
    h[5] += f;
    h[6] += g;
    h[7] += hh;
  }
  return Array.from(h, (x) => x.toString(16).padStart(8, "0")).join("");
}

/* ---------------- compresión ---------------- */

/** Decodifica la foto sin URL temporales y respetando la rotación con la que la tomó el celular. */
async function cargarImagen(archivo: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(archivo, { imageOrientation: "from-image" });
  } catch {
    throw new Error("No se pudo leer la imagen. Usa una foto JPG o PNG.");
  }
}

const aBlob = (canvas: HTMLCanvasElement, calidad: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo comprimir la foto."))), "image/jpeg", calidad));

/** Reduce la foto a JPG de ~200 KB (baja calidad y tamaño hasta lograrlo). */
export async function comprimirImagen(archivo: File | Blob): Promise<Blob> {
  if (!archivo.type.startsWith("image/")) throw new Error("El archivo debe ser una foto.");
  const img = await cargarImagen(archivo);
  try {
    let lado = LADO_MAXIMO;
    for (let intento = 0; intento < 6; intento++) {
      const escala = Math.min(1, lado / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Este navegador no puede procesar fotos.");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      for (const calidad of [0.82, 0.72, 0.62, 0.52]) {
        const blob = await aBlob(canvas, calidad); // cada intento depende del anterior
        if (blob.size <= OBJETIVO_BYTES) return blob;
      }
      lado = Math.round(lado * 0.75);
    }
    throw new Error("La foto es demasiado grande. Toma otra con menos resolución.");
  } finally {
    img.close(); // libera la memoria de la foto decodificada
  }
}

/* ---------------- subir ---------------- */

export function rutaArchivo(empresaId: string, clienteId: string, prefijo: string): string {
  const azar = Math.random().toString(36).slice(2, 8);
  return `${empresaId}/${clienteId}/${prefijo}-${Date.now()}-${azar}.jpg`;
}

/** Foto de evidencia de un pago: hash de la ORIGINAL, luego comprime y sube a "evidencias". */
export async function prepararFotoPago(datos: Datos, empresaId: string, clienteId: string, archivo: File): Promise<{ ruta: string; hash: string }> {
  // El hash es de la foto ORIGINAL; hash y compresión son independientes y corren a la vez
  const [hash, comprimida] = await Promise.all([sha256(archivo), comprimirImagen(archivo)]);
  const ruta = rutaArchivo(empresaId, clienteId, "pago");
  await datos.subirArchivo("evidencias", ruta, comprimida);
  return { ruta, hash };
}

/** Foto o documento del cliente: comprime y sube a "documentos". */
export async function subirDocumento(datos: Datos, empresaId: string, clienteId: string, tipo: string, archivo: File): Promise<string> {
  const comprimida = await comprimirImagen(archivo);
  const ruta = rutaArchivo(empresaId, clienteId, tipo);
  await datos.subirArchivo("documentos", ruta, comprimida);
  return ruta;
}

/** Si registrar_pago rechaza, se borra la foto ya subida. */
export async function borrarFoto(datos: Datos, bucket: Bucket, ruta: string) {
  try {
    await datos.borrarArchivo(bucket, ruta);
  } catch {
    /* si falla el borrado no bloqueamos al usuario */
  }
}
