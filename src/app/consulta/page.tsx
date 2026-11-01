"use client";
import { useState, type FormEvent } from "react";
import { Cronograma } from "@/app/(app)/contratos/_componentes/Cronograma";
import { Marca } from "@/components/layout/Marca";
import { Aviso, Boton, EtiquetaSemaforo, Placa, formatoFecha, formatoSoles, hoyLima, mensajeDeError } from "@/components/ui";
import { getDatos } from "@/lib/supabase/datos";
import { colorPorSemanas } from "@/lib/supabase/reglas";
import type { ConsultaPublica, ContratoPublico } from "@/types/database";

/** Un contrato del cliente: lo que debe hoy y su cronograma. */
function TarjetaContrato({ c }: { c: ContratoPublico }) {
  const proxima = c.cuotas.find((q) => q.estado === "pendiente");
  const alDia = c.deuda === 0;
  return (
    <section className="overflow-hidden rounded-2xl border border-borde bg-superficie">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borde px-5 py-4">
        <Placa placa={c.placa} tamano="grande" />
        <EtiquetaSemaforo color={colorPorSemanas(c.semanas_atraso)} semanas={c.semanas_atraso} grande />
      </div>
      <div className="grid gap-4 px-5 py-5 sm:grid-cols-[1.3fr_1fr]">
        <div>
          <p className="text-sm font-semibold text-tenue">{alDia ? "Estás al día" : "Debes hoy"}</p>
          <p className={`num font-display text-5xl leading-tight font-bold ${alDia ? "text-verde" : "text-rojo"}`}>{formatoSoles(c.deuda)}</p>
          {!alDia && (
            <p className="mt-1 text-tenue">
              {c.semanas_atraso === 1 ? "1 cuota vencida" : `${c.semanas_atraso} cuotas vencidas`}
            </p>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-3 self-center sm:grid-cols-1">
          <div>
            <dt className="text-sm text-tenue">Cuota semanal</dt>
            <dd className="num font-semibold">{formatoSoles(c.cuota)}</dd>
          </div>
          <div>
            <dt className="text-sm text-tenue">Próxima cuota</dt>
            <dd className="font-semibold">{proxima ? formatoFecha(proxima.fecha_vencimiento) : "—"}</dd>
          </div>
        </dl>
      </div>
      <details className="group border-t border-borde">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-5 font-semibold text-marca">
          Ver mi cronograma
          <span aria-hidden className="transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="px-5 pb-5">
          <Cronograma cuotas={c.cuotas} />
        </div>
      </details>
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
    if (!/^\d{8}$/.test(dni)) {
      setError("Escribe tu DNI: son 8 números.");
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
          <p className="mt-2 text-lg text-white/75">Escribe tu DNI y mira cuánto debes y tu cronograma de cuotas.</p>
        </div>
      </header>

      <div className="mx-auto -mt-10 flex max-w-2xl flex-col gap-4 px-4 pb-10">
        <form onSubmit={consultar} className="rounded-2xl bg-superficie p-5 shadow-lg sm:p-6">
          <label htmlFor="dni" className="font-semibold">
            Número de DNI
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="dni"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={dni}
              onChange={(e) => {
                setDni(e.target.value.replace(/\D/g, ""));
                setResultado(undefined);
              }}
              placeholder="8 números"
              className="num min-h-16 flex-1 rounded-xl border border-borde px-5 font-display text-3xl font-bold tracking-[0.15em] focus:border-marca focus:ring-3 focus:ring-marca/20 focus:outline-none"
            />
            <Boton type="submit" tamano="grande" cargando={buscando}>
              Consultar
            </Boton>
          </div>
          {error && (
            <div className="mt-3">
              <Aviso tipo="error">{error}</Aviso>
            </div>
          )}
        </form>

        {resultado === null && (
          <Aviso tipo="alerta">No encontramos un contrato activo con ese DNI. Revisa el número; si está bien, comunícate con la oficina.</Aviso>
        )}

        {resultado && (
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
              Lo que pagaste hoy puede tardar en aparecer hasta que la oficina lo registre. Lo pagado después de las 10:00 p.m. cuenta para el día siguiente.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
