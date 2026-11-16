"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * Vista previa de PDF dibujada en el navegador (pdf.js), igual en PC y en celular:
 * los celulares no muestran un PDF dentro de la página, así que cada hoja se pinta como imagen.
 * Se usa la versión "legacy" para que funcione en celulares y tablets antiguos. El "worker" se copia a public/pdf/ al instalar (script postinstall de package.json).
 */

let cargador: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null = null;
const pdfjs = () => {
  cargador ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((m) => {
    m.GlobalWorkerOptions.workerSrc = "/pdf/pdf.worker.min.js";
    return m;
  });
  return cargador;
};


async function abrir(fuente: Blob | string): Promise<PDFDocumentProxy> {
  const lib = await pdfjs();
  const tarea = typeof fuente === "string" ? lib.getDocument({ url: fuente }) : lib.getDocument({ data: new Uint8Array(await fuente.arrayBuffer()) });
  return tarea.promise;
}

/** Pinta una hoja al ancho del lienzo (nítida en pantallas de alta densidad). */
async function pintar(doc: PDFDocumentProxy, numero: number, lienzo: HTMLCanvasElement, ancho: number) {
  const hoja = await doc.getPage(numero);
  const base = hoja.getViewport({ scale: 1 });
  const escala = (ancho * (window.devicePixelRatio || 1)) / base.width;
  const vista = hoja.getViewport({ scale: escala });
  lienzo.width = Math.floor(vista.width);
  lienzo.height = Math.floor(vista.height);
  await hoja.render({ canvas: lienzo, viewport: vista }).promise;
}

/** Primera hoja del PDF como miniatura, con una etiqueta "PDF · N hojas". */
export function MiniaturaPdf({ fuente, className = "" }: { fuente: Blob | string; className?: string }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [estado, setEstado] = useState<{ hojas: number } | "cargando" | "error">("cargando");

  useEffect(() => {
    let vivo = true;
    let doc: PDFDocumentProxy | null = null;
    (async () => {
      try {
        doc = await abrir(fuente);
        const c = lienzo.current;
        if (!vivo || !c) return;
        await pintar(doc, 1, c, c.parentElement?.clientWidth || 240);
        if (vivo) setEstado({ hojas: doc.numPages });
      } catch {
        if (vivo) setEstado("error");
      }
    })();
    return () => {
      vivo = false;
      void doc?.destroy();
    };
  }, [fuente]);

  return (
    <div className={`relative overflow-hidden bg-white ${className}`}>
      <canvas ref={lienzo} className="block w-full" aria-hidden />
      {estado === "cargando" && <div className="esqueleto absolute inset-0 rounded-none" aria-hidden />}
      {estado === "error" && <div className="absolute inset-0 grid place-items-center p-2 text-center text-xs text-tenue">No se pudo mostrar el PDF</div>}
      <span className="absolute top-1.5 left-1.5 rounded-md bg-rojo px-1.5 py-0.5 text-[11px] font-bold text-white">
        PDF{typeof estado === "object" && estado.hojas > 1 ? ` · ${estado.hojas} hojas` : ""}
      </span>
    </div>
  );
}

const MAX_HOJAS = 20;

/** Todas las hojas del PDF, una debajo de otra (para la vista ampliada). */
export function HojasPdf({ fuente }: { fuente: Blob | string }) {
  const caja = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let vivo = true;
    let doc: PDFDocumentProxy | null = null;
    (async () => {
      try {
        doc = await abrir(fuente);
        const c = caja.current;
        if (!vivo || !c) return;
        setTotal(doc.numPages);
        c.replaceChildren();
        const ancho = c.clientWidth || 800;
        for (let n = 1; n <= Math.min(doc.numPages, MAX_HOJAS) && vivo; n++) {
          const lienzo = document.createElement("canvas");
          lienzo.className = "block w-full rounded-lg border border-borde bg-white";
          c.appendChild(lienzo);
          // una hoja a la vez a propósito: pintar todas juntas agota la memoria del celular
          // react-doctor-disable-next-line async-await-in-loop
          await pintar(doc, n, lienzo, ancho);
        }
      } catch {
        if (vivo) setError(true);
      }
    })();
    return () => {
      vivo = false;
      void doc?.destroy();
    };
  }, [fuente]);

  if (error) return <p className="text-center text-tenue">No se pudo mostrar el PDF.</p>;
  return (
    <div className="flex flex-col gap-2">
      <div ref={caja} className="flex flex-col gap-3" />
      {total > MAX_HOJAS && <p className="text-center text-sm text-tenue">Se muestran las primeras {MAX_HOJAS} de {total} hojas.</p>}
    </div>
  );
}
