"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { EtiquetaSemaforo, Placa, nombreDocumento } from "@/components/ui";
import { claveBusqueda, coincide, normalizar } from "@/lib/texto";
import type { EstadoCliente } from "@/types/database";
import { useSesion } from "./Sesion";

const MAXIMO = 8;
/** Los datos de la búsqueda se reutilizan 1 minuto para que abrir y cerrar sea instantáneo. */
const VIGENCIA_MS = 60_000;

const esCampoDeTexto = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

/**
 * Búsqueda rápida desde cualquier pantalla: Ctrl+K (⌘K en Mac) o la tecla "/".
 * Escribe nombre, DNI o placa; Enter abre la ficha y "Cobrar" va directo a registrar el pago.
 */
export function BuscadorGlobal() {
  const { datos, esAdmin } = useSesion();
  const router = useRouter();
  const dialogo = useRef<HTMLDialogElement>(null);
  const cache = useRef<{ en: number; filas: EstadoCliente[] } | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [filas, setFilas] = useState<EstadoCliente[] | null>(null);
  const [marcado, setMarcado] = useState(0);

  const abrir = () => {
    setTexto("");
    setMarcado(0);
    setAbierto(true);
    const vigente = cache.current && Date.now() - cache.current.en < VIGENCIA_MS;
    if (vigente && cache.current) {
      setFilas(cache.current.filas);
      return;
    }
    datos
      .estadoClientes()
      .then((r) => {
        cache.current = { en: Date.now(), filas: r };
        setFilas(r);
      })
      .catch(() => setFilas([]));
  };

  // Atajos de teclado globales
  useEffect(() => {
    const tecla = (e: globalThis.KeyboardEvent) => {
      const atajo = (e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey);
      const barra = e.key === "/" && !esCampoDeTexto(e.target);
      if (!atajo && !barra) return;
      e.preventDefault();
      abrir();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
    // abrir solo usa refs y setters estables
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos]);

  // Abrir y cerrar el <dialog> nativo (atrapa el foco y cierra con Escape)
  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  const indice = useMemo(() => (filas ?? []).map((e) => ({ e, clave: claveBusqueda(e.cliente, e.dni, e.placa) })), [filas]);
  const resultados = useMemo(() => {
    const q = normalizar(texto);
    if (!q) return [];
    const r: EstadoCliente[] = [];
    for (const { e, clave } of indice) {
      if (coincide(clave, q)) r.push(e);
      if (r.length === MAXIMO) break;
    }
    return r;
  }, [texto, indice]);

  const ir = (href: string) => {
    setAbierto(false);
    router.push(href);
  };
  const cobrar = (e: EstadoCliente) => ir(`/pagos/nuevo?contrato=${e.contrato_id}`);
  // el cobrador no entra a la ficha: tocar al cliente lo lleva a cobrarle
  const ficha = (e: EstadoCliente) => (esAdmin ? ir(`/clientes/ficha?id=${e.cliente_id}`) : cobrar(e));

  const teclas = (ev: KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      const paso = ev.key === "ArrowDown" ? 1 : -1;
      setMarcado((m) => (resultados.length ? (m + paso + resultados.length) % resultados.length : 0));
    } else if (ev.key === "Enter" && resultados[marcado]) {
      ev.preventDefault();
      if (ev.altKey) cobrar(resultados[marcado]);
      else ficha(resultados[marcado]);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="flex min-h-11 items-center gap-3 rounded-xl border border-borde bg-superficie px-3 text-left text-tenue hover:border-marca sm:w-full sm:max-w-md"
        aria-keyshortcuts="Control+K /"
        aria-label="Buscar cliente, DNI o placa"
      >
        <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M21 21l-4.3-4.3" />
        </svg>
        <span className="hidden flex-1 truncate sm:inline">Buscar cliente, DNI o placa</span>
        <kbd className="hidden rounded-md border border-borde bg-fondo px-1.5 font-sans text-xs font-semibold sm:inline">Ctrl K</kbd>
      </button>

      <dialog
        ref={dialogo}
        aria-label="Búsqueda rápida"
        onClose={() => setAbierto(false)}
        className="mx-auto mt-[10vh] w-[min(40rem,calc(100%-2rem))] max-w-none rounded-2xl bg-superficie p-0 text-tinta shadow-2xl backdrop:bg-tinta/40"
      >
        {abierto && (
          <div className="flex max-h-[75dvh] flex-col">
            <div className="flex items-center gap-3 border-b border-borde px-4">
              <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-tenue" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M21 21l-4.3-4.3" />
              </svg>
              <input
                // el buscador se abre para escribir de inmediato
                autoFocus
                value={texto}
                onChange={(e) => {
                  setTexto(e.target.value);
                  setMarcado(0);
                }}
                onKeyDown={teclas}
                placeholder="Nombre, DNI o placa"
                aria-label="Nombre, DNI o placa"
                aria-controls="resultados-busqueda"
                className="min-h-14 flex-1 bg-transparent text-lg outline-none focus-visible:outline-none"
              />
              <kbd className="rounded-md border border-borde bg-fondo px-1.5 font-sans text-xs font-semibold text-tenue">Esc</kbd>
            </div>

            <ul id="resultados-busqueda" className="overflow-y-auto p-2" aria-label="Resultados">
              {filas === null && <li className="p-4 text-center text-tenue">Cargando clientes…</li>}
              {filas !== null && texto && resultados.length === 0 && (
                <li className="p-4 text-center text-tenue">Nadie con contrato activo coincide con «{texto}».</li>
              )}
              {filas !== null && !texto && (
                <li className="p-4 text-center text-sm text-tenue">
                  {esAdmin ? (
                    <>
                      Escribe para buscar. <b>Enter</b> abre la ficha · <b>Alt + Enter</b> registra un pago.
                    </>
                  ) : (
                    <>
                      Escribe para buscar. <b>Enter</b> registra un pago.
                    </>
                  )}
                </li>
              )}
              {resultados.map((e, i) => (
                <li key={e.contrato_id}>
                  <div
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${i === marcado ? "bg-marca-suave" : ""}`}
                    onMouseEnter={() => setMarcado(i)}
                  >
                    <button type="button" onClick={() => ficha(e)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <Placa placa={e.placa} tamano="chico" />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{e.cliente}</span>
                        <span className="block truncate text-sm text-tenue">
                          {nombreDocumento(e.dni)} {e.dni} · {e.empresa}
                        </span>
                      </span>
                    </button>
                    <EtiquetaSemaforo color={e.color} semanas={e.semanas_atraso} />
                    <button type="button" onClick={() => cobrar(e)} className="min-h-10 shrink-0 rounded-lg bg-marca px-3 text-sm font-semibold text-white hover:bg-marca-oscura">
                      Cobrar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </dialog>
    </>
  );
}
