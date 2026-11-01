"use client";
import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { getDatos } from "@/lib/supabase/datos";
import { Aviso, Boton, formatoSoles, hoyLima, formatoFecha, mensajeDeError, Placa } from "@/components/ui";
import { Cronograma } from "@/app/(app)/contratos/_componentes/Cronograma";
import type { ConsultaPublica } from "@/types/database";

function Consulta() {
  const dniUrl = useSearchParams().get("dni") ?? "";
  const [dni, setDni] = useState(dniUrl);
  const [resultado, setResultado] = useState<ConsultaPublica | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);

  const buscar = useCallback(async (valor: string) => {
    if (!/^\d{8}$/.test(valor)) {
      setError("Escribe tu DNI de 8 números.");
      return;
    }
    setBuscando(true);
    setError(null);
    try {
      const d = await getDatos();
      setResultado(await d.consultaPublica(valor));
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setBuscando(false);
    }
  }, []);

  useEffect(() => {
    if (dniUrl) buscar(dniUrl);
  }, [dniUrl, buscar]);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    buscar(dni);
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <form onSubmit={enviar} className="rounded-3xl bg-superficie p-5 shadow-sm sm:p-6">
        <label htmlFor="dni" className="text-lg font-bold">
          Consulta tu deuda
        </label>
        <p className="mb-3 text-tenue">Escribe tu número de DNI.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="dni"
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
            placeholder="12345678"
            className="num min-h-14 flex-1 rounded-2xl border border-borde px-5 text-2xl font-bold tracking-widest focus:border-marca focus:ring-3 focus:ring-marca/20 focus:outline-none"
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

      {resultado === null && <Aviso tipo="alerta">No encontramos un contrato activo con ese DNI. Si crees que es un error, comunícate con la oficina.</Aviso>}

      {resultado && (
        <>
          <section className="rounded-3xl bg-superficie p-5 shadow-sm sm:p-6">
            <p className="text-sm text-tenue">Consulta del {formatoFecha(hoyLima())}</p>
            <h2 className="text-2xl font-extrabold">{resultado.nombre}</h2>
            <p><Placa placa={resultado.placa} /></p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className={`rounded-2xl p-4 ${resultado.deuda > 0 ? "bg-rojo-suave" : "bg-verde-suave"}`}>
                <p className="text-sm font-semibold text-tenue">Deuda vencida</p>
                <p className={`num text-3xl font-extrabold ${resultado.deuda > 0 ? "text-rojo" : "text-verde"}`}>{formatoSoles(resultado.deuda)}</p>
              </div>
              <div className="rounded-2xl bg-fondo p-4">
                <p className="text-sm font-semibold text-tenue">Semanas de atraso</p>
                <p className="num text-3xl font-extrabold">{resultado.semanas_atraso}</p>
              </div>
            </div>
            {resultado.deuda === 0 && <p className="mt-3 font-semibold text-verde">¡Estás al día! Gracias por tu puntualidad.</p>}
          </section>
          <section className="rounded-3xl bg-superficie p-5 shadow-sm sm:p-6">
            <h3 className="mb-3 text-lg font-bold">Tu cronograma</h3>
            <Cronograma cuotas={resultado.cuotas} />
          </section>
        </>
      )}
    </div>
  );
}

export default function PaginaConsulta() {
  return (
    <main className="min-h-dvh bg-fondo">
      <header className="bg-tinta px-4 py-5 text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <img src="/logo.png" alt="" className="size-10 rounded-lg bg-white object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-white/60 uppercase">Cobranzas</p>
            <p className="text-xl font-extrabold">Núñez</p>
          </div>
        </div>
      </header>
      <div className="px-4 py-6">
        <Suspense>
          <Consulta />
        </Suspense>
      </div>
    </main>
  );
}
