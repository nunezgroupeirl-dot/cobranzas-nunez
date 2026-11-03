"use client";
import { useMemo, useState } from "react";
import { OpcionesBoton, Placa, textoDocumento } from "@/components/ui";
import { claveBusqueda, coincide, normalizar } from "@/lib/texto";
import type { Cliente, Empresa, Moto } from "@/types/database";

/** Paso 1: la empresa que alquila (de ella salen RUC, representante y cuentas). */
export function ElegirEmpresa({ empresas, valor, alElegir, error }: { empresas: Empresa[]; valor: string; alElegir: (e: Empresa) => void; error?: string | null }) {
  return (
    <div className="mb-4">
      <OpcionesBoton
        etiqueta="¿Qué empresa hace el contrato?"
        obligatorio
        error={error}
        valor={valor}
        opciones={empresas.map((e) => ({ valor: e.id, texto: e.nombre }))}
        alCambiar={(id) => {
          const e = empresas.find((x) => x.id === id);
          if (e) alElegir(e);
        }}
      />
    </div>
  );
}

/** Paso 2: buscar un cliente ya registrado, o dejarlo vacío para uno nuevo. */
export function ElegirCliente({ clientes, elegido, alElegir }: { clientes: Cliente[]; elegido: Cliente | null; alElegir: (c: Cliente | null) => void }) {
  const [busca, setBusca] = useState("");
  const indice = useMemo(() => clientes.map((c) => ({ c, clave: claveBusqueda(c.nombres, c.dni) })), [clientes]);
  const q = normalizar(busca);
  const encontrados = q.length < 2 ? [] : indice.filter((i) => coincide(i.clave, q)).slice(0, 6);

  if (elegido)
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-marca-suave p-3">
        <p>
          <span className="block text-sm text-tenue">Cliente ya registrado</span>
          <b>{elegido.nombres}</b> · {textoDocumento(elegido.dni)}
        </p>
        <button type="button" onClick={() => alElegir(null)} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-marca hover:bg-white">
          Es otro cliente (nuevo)
        </button>
      </div>
    );
  return (
    <div className="mb-4 flex flex-col gap-2 rounded-xl border border-dashed border-borde p-3">
      <label className="text-sm font-semibold" htmlFor="buscar-cliente">
        ¿Ya está registrado? Búscalo por nombre o DNI
      </label>
      <input
        id="buscar-cliente"
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Escribe al menos 2 letras"
        className="min-h-12 rounded-xl border border-borde bg-superficie px-4 focus:border-marca focus:outline-none"
      />
      {encontrados.length > 0 && (
        <ul className="flex flex-col gap-1">
          {encontrados.map(({ c }) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  alElegir(c);
                  setBusca("");
                }}
                className="flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border border-borde px-3 text-left hover:border-marca"
              >
                <span className="font-semibold">{c.nombres}</span>
                <span className="num text-sm text-tenue">{textoDocumento(c.dni)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-tenue">Si es un cliente nuevo, llena sus datos abajo: se registra solo al crear el contrato.</p>
    </div>
  );
}

/** Paso 3: si el cliente ya tiene motos sin contrato, elegir una; si no, moto nueva. */
export function ElegirMoto({ motos, elegida, alElegir }: { motos: Moto[]; elegida: Moto | null; alElegir: (m: Moto | null) => void }) {
  if (!motos.length) return null;
  return (
    <div className="mb-4 flex flex-col gap-2">
      <p className="text-sm font-semibold">Motos de este cliente sin contrato</p>
      <div className="flex flex-wrap gap-2">
        {motos.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={elegida?.id === m.id}
            onClick={() => alElegir(m)}
            className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${elegida?.id === m.id ? "border-marca bg-marca-suave" : "border-borde hover:border-marca"}`}
          >
            <Placa placa={m.placa} tamano="chico" /> {m.marca} {m.tipo}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={!elegida}
          onClick={() => alElegir(null)}
          className={`min-h-12 rounded-xl border border-dashed px-3 text-sm font-semibold ${!elegida ? "border-marca bg-marca-suave" : "border-borde hover:border-marca"}`}
        >
          + Moto nueva
        </button>
      </div>
    </div>
  );
}
