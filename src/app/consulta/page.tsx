"use client";
import { useState, type FormEvent } from "react";
import { Marca } from "@/components/layout/Marca";
import { Aviso, Boton, EtiquetaSemaforo, Placa, diaSemana, fechaLarga, formatoFecha, formatoSoles, hoyLima, mensajeDeError } from "@/components/ui";
import { Bloque } from "@/components/ui/Esqueleto";
import { getDatos } from "@/lib/supabase/datos";
import { colorPorSemanas } from "@/lib/supabase/reglas";
import { mesesDelPlazo } from "@/app/(app)/clientes/_componentes/venta";
import type { ConsultaPublica, ContratoPublico } from "@/types/database";

/** Un contrato del cliente: lo que debe hoy, lo que le falta en total, su próximo pago y cómo baja su saldo. */
/** Mientras se consulta: la forma del resultado en gris con brillo (en lugar del círculo que gira). */
function ConsultandoEsqueleto() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex animate-[aparecer_.25s_ease-out] flex-col gap-4">
      <span className="sr-only">Consultando…</span>
      <div className="flex flex-col gap-2 px-1">
        <Bloque className="h-4 w-40" />
        <Bloque className="h-8 w-56" />
      </div>
      <section className="overflow-hidden rounded-2xl border border-borde bg-superficie">
        <div className="flex items-center justify-between gap-3 border-b border-borde px-5 py-4">
          <Bloque className="h-12 w-40 rounded-xl" />
          <Bloque className="h-9 w-32 rounded-full" />
        </div>
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Bloque className="h-4 w-24" />
            <Bloque className="h-12 w-44" />
            <Bloque className="h-4 w-32" />
          </div>
          <div className="flex flex-col gap-2 rounded-xl bg-fondo p-4">
            <Bloque className="h-4 w-32" />
            <Bloque className="h-8 w-28" />
            <Bloque className="h-4 w-24" />
          </div>
        </div>
        <div className="flex flex-col gap-2 px-5 pb-5">
          <Bloque className="h-3 w-full rounded-full" />
          <Bloque className="h-4 w-48" />
        </div>
      </section>
    </div>
  );
}

const UNIDAD: Record<ContratoPublico["frecuencia"], [string, string]> = {
  diario: ["día", "días"],
  semanal: ["semana", "semanas"],
  quincenal: ["quincena", "quincenas"],
  mensual: ["mes", "meses"],
};

/** "S/ 379.40 × 52 semanas · 12 meses": cuánto paga, cuántas veces y en cuánto tiempo. */
function PlanDePago({ c }: { c: ContratoPublico }) {
  const n = c.nro_cuotas ?? 0;
  if (!n) return null;
  const [una, varias] = UNIDAD[c.frecuencia] ?? UNIDAD.semanal;
  const meses = mesesDelPlazo(n, c.frecuencia);
  const textoMeses = Number.isInteger(meses) ? String(meses) : meses.toLocaleString("es-PE", { maximumFractionDigits: 1 });
  return (
    <div className="border-b border-borde bg-marca-suave px-5 py-3">
      <p className="text-sm font-semibold text-tenue">Tu plan de pago</p>
      <p className="num text-2xl leading-tight font-bold">
        {formatoSoles(c.cuota)} × {n} {n === 1 ? una : varias}
        {c.frecuencia !== "mensual" && (
          <span className="text-marca">
            {" "}
            · {textoMeses} {meses === 1 ? "mes" : "meses"}
          </span>
        )}
      </p>
    </div>
  );
}

function TarjetaContrato({ c }: { c: ContratoPublico }) {
  const alDia = c.deuda === 0;
  const avance = c.total > 0 ? Math.min(100, Math.round((c.pagado / c.total) * 100)) : 0;
  return (
    <section className="overflow-hidden rounded-2xl border border-borde bg-superficie">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borde px-5 py-4">
        <Placa placa={c.placa} tramite={c.tramite} tamano="grande" />
        <EtiquetaSemaforo color={colorPorSemanas(c.semanas_atraso)} semanas={c.semanas_atraso} grande />
      </div>
      <PlanDePago c={c} />

      <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-tenue">{alDia ? "Estás al día" : "Debes hoy"}</p>
          <p className={`num font-display text-5xl leading-tight font-bold ${alDia ? "text-verde" : "text-rojo"}`}>{formatoSoles(c.deuda)}</p>
          {!alDia && <p className="mt-1 text-tenue">{c.semanas_atraso === 1 ? "1 cuota vencida" : `${c.semanas_atraso} cuotas vencidas`}</p>}
        </div>
        <div className="rounded-xl bg-fondo p-4">
          <p className="text-sm font-semibold text-tenue">Tu próximo pago</p>
          {c.proxima_fecha ? (
            <>
              <p className="num text-2xl font-bold">{formatoSoles(c.proxima_monto ?? c.cuota)}</p>
              <p className="text-lg leading-tight font-bold text-marca">el {fechaLarga(c.proxima_fecha)}</p>
              {c.frecuencia === "semanal" && <p className="mt-1 font-extrabold text-marca uppercase">Pagas todos los {diaSemana(c.proxima_fecha)}</p>}
            </>
          ) : (
            <p className="font-semibold">Ya no tienes cuotas por vencer.</p>
          )}
        </div>
      </div>

      <div className="border-t border-borde px-5 py-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-tenue">Te falta pagar en total</p>
            <p className="num text-3xl font-bold">{formatoSoles(c.saldo)}</p>
          </div>
          <p className="num text-sm text-tenue">
            Pagaste {formatoSoles(c.pagado)} de {formatoSoles(c.total)}
          </p>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-fondo" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={avance} aria-label="Avance de tu contrato">
          <div className="h-full rounded-full bg-marca" style={{ width: `${avance}%` }} />
        </div>
        <p className="mt-1 text-right text-sm font-semibold text-marca">{avance}% pagado</p>
      </div>

      {c.pagos.length > 0 && (
        <div className="border-t border-borde px-5 py-5">
          <p className="mb-2 font-semibold">Tus últimos pagos</p>
          <ul className="flex flex-col divide-y divide-borde">
            {c.pagos.map((p) => (
              // el saldo después de cada pago es distinto en cada fila: sirve de clave
              <li key={`${p.fecha}-${p.saldo}`} className="flex items-center justify-between gap-3 py-2.5">
                <span>
                  <span className="block font-semibold">
                    <span className="capitalize">{diaSemana(p.fecha)}</span> {formatoFecha(p.fecha)}
                  </span>
                  <span className="num block text-sm text-tenue">Pagaste {formatoSoles(p.monto)}</span>
                </span>
                <span className="text-right">
                  <span className="block text-xs text-tenue">Te quedó</span>
                  <span className="num block font-bold">{formatoSoles(p.saldo)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default function PaginaConsulta() {
  const [dni, setDni] = useState("");
  const [resultado, setResultado] = useState<ConsultaPublica | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);

  const consultar = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^[A-Z0-9]{5,12}$/.test(dni)) {
      setError("Escribe el número de tu documento (DNI, Carné de Extranjería, Cédula o Pasaporte).");
      return;
    }
    setBuscando(true);
    setError(null);
    try {
      const d = await getDatos();
      setResultado(await d.consultaPublica(dni));
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setBuscando(false);
    }
  };

  const total = resultado ? resultado.contratos.reduce((t, c) => t + c.deuda, 0) : 0;

  return (
    <main className="min-h-dvh bg-fondo">
      <header className="bg-tinta px-4 pt-6 pb-16 text-white">
        <div className="mx-auto max-w-2xl">
          <Marca claro />
          <h1 className="mt-6 text-4xl font-bold sm:text-5xl">Consulta tu deuda</h1>
          <p className="mt-2 text-lg text-white/75">Escribe tu DNI y mira cuánto debes, tu próximo pago y cómo va bajando tu deuda.</p>
        </div>
      </header>

      <div className="mx-auto -mt-10 flex max-w-2xl flex-col gap-4 px-4 pb-10">
        <form onSubmit={consultar} className="rounded-2xl bg-superficie p-5 shadow-lg sm:p-6">
          <label htmlFor="dni" className="font-semibold">
            Número de tu documento
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="dni"
              autoComplete="off"
              autoCapitalize="characters"
              maxLength={12}
              value={dni}
              onChange={(e) => {
                setDni(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
                setResultado(undefined);
              }}
              placeholder="DNI, C.E., cédula…"
              className="num min-h-16 flex-1 rounded-xl border border-borde px-5 font-display text-3xl font-bold tracking-[0.15em] focus:border-marca focus:ring-3 focus:ring-marca/20 focus:outline-none"
            />
            <Boton type="submit" tamano="grande" disabled={buscando}>
              Consultar
            </Boton>
          </div>
          {error && (
            <div className="mt-3">
              <Aviso tipo="error">{error}</Aviso>
            </div>
          )}
        </form>

        {buscando && <ConsultandoEsqueleto />}

        {!buscando && resultado === null && (
          <Aviso tipo="alerta">No encontramos un contrato activo con ese DNI. Revisa el número; si está bien, comunícate con la oficina.</Aviso>
        )}

        {!buscando && resultado && (
          <div aria-live="polite" className="flex flex-col gap-4">
            <div className="px-1">
              <p className="text-sm text-tenue">Consulta del {formatoFecha(hoyLima())}</p>
              <p className="text-2xl font-bold">Hola, {resultado.nombre}</p>
              {resultado.contratos.length > 1 && (
                <p className="num mt-1 text-lg">
                  Tienes {resultado.contratos.length} motos. Deuda total: <b className={total > 0 ? "text-rojo" : "text-verde"}>{formatoSoles(total)}</b>
                </p>
              )}
            </div>
            {resultado.contratos.map((c) => (
              <TarjetaContrato key={c.placa} c={c} />
            ))}
            <p className="px-1 text-sm text-tenue">
              Lo que pagaste hoy puede tardar en aparecer hasta que la oficina lo registre. Lo pagado después de medianoche cuenta para el día siguiente.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
