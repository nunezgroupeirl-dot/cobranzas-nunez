"use client";
import Link from "next/link";
import { useState } from "react";
import { DIAS_TRAMITE, type TramiteVencido } from "@/lib/tramite";

const A_LA_VISTA = 3;

/**
 * Aviso para los administradores: vehículos que salieron con placa en trámite, ya pasaron los 30 días
 * y todavía no tienen su contrato firmado. No se puede cerrar: se va solo cuando se sube el contrato firmado.
 */
export function AvisoTramite({ lista, conEmpresa }: { lista: TramiteVencido[]; conEmpresa: (ruta: string) => string }) {
  const [todos, setTodos] = useState(false);
  if (!lista.length) return null;
  const visibles = todos ? lista : lista.slice(0, A_LA_VISTA);
  return (
    <section role="alert" className="no-imprimir mb-4 rounded-2xl border-2 border-amarillo bg-amarillo-suave p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none" aria-hidden>
          📝
        </span>
        <div className="flex-1">
          <p className="font-bold">{lista.length === 1 ? "Falta hacer 1 contrato" : `Faltan hacer ${lista.length} contratos`}</p>
          <p className="text-sm">
            Salieron con placa en trámite y ya pasaron {DIAS_TRAMITE} días. Registra la placa, llena el contrato y sube el firmado: este aviso se quita solo
            cuando el contrato firmado está subido.
          </p>
        </div>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {visibles.map((t) => (
          <li key={t.contrato_id} className="flex flex-col gap-2 rounded-xl bg-superficie px-3 py-2 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <Link href={conEmpresa(`/clientes/ficha?id=${t.cliente_id}&contrato=${t.contrato_id}`)} className="font-semibold hover:underline">
                {t.cliente}
              </Link>
              <p className="text-sm text-tenue">
                {t.placa ? `Placa ${t.placa}` : "Placa aún en trámite"} · hace <b className="num text-tinta">{t.dias}</b> días
              </p>
            </div>
            <Link
              href={conEmpresa(`/contratos/documento?id=${t.contrato_id}`)}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-marca px-4 font-bold text-white hover:bg-marca-oscura"
            >
              Hacer el contrato
            </Link>
          </li>
        ))}
      </ul>
      {lista.length > A_LA_VISTA && (
        <button type="button" onClick={() => setTodos(!todos)} className="mt-2 min-h-11 text-sm font-semibold text-marca hover:underline">
          {todos ? "Ver menos" : `Ver los ${lista.length}`}
        </button>
      )}
    </section>
  );
}
