"use client";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useRef, useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { htmlContrato } from "@/components/reportes/ContratoImpreso";
import { Aviso, Boton, formatoFecha, mensajeDeError } from "@/components/ui";
import type { Cliente, Contrato, Cuenta, Moto } from "@/types/database";
import { Avance } from "../../documento/_componentes/Avance";
import { PasoContrato } from "../../documento/_componentes/PasoContrato";
import { Revision } from "../../documento/_componentes/Revision";
import {
  PASOS_NUEVO,
  aCampos,
  borradorInicial,
  cuentaPorDefecto,
  datosCliente,
  datosEmpresa,
  datosMoto,
  etiquetaBorrador,
  pasoNuevoListo,
  plazoMeses,
  problemaBorrador,
  ultimaCuota,
  type Borrador,
  type ClaveBorrador,
} from "./borrador";
import { crearTodo, type Hechos } from "./crear";
import { ElegirCliente, ElegirEmpresa, ElegirMoto } from "./Elegir";

interface Props {
  clientes: Cliente[];
  motos: Moto[];
  contratos: Contrato[];
  cuentas: Cuenta[];
  hoy: string;
  primeraCuota: string;
  clienteInicial: Cliente | null;
}

const ULTIMO = PASOS_NUEVO.length;

function Dato({ t, v }: { t: string; v: string }) {
  return (
    <div>
      <dt className="text-tenue">{t}</dt>
      <dd className="font-semibold">{v}</dd>
    </div>
  );
}

/** Nuevo contrato: la plantilla del contrato se llena paso a paso y al final se crea todo y sale el PDF para firmar. */
export function AsistenteContrato({ clientes, motos, contratos, cuentas, hoy, primeraCuota, clienteInicial }: Props) {
  const { datos, empresas } = useSesion();
  const router = useRouter();
  const [b, setB] = useState<Borrador>(() => ({ ...borradorInicial(hoy, primeraCuota), ...(clienteInicial ? datosCliente(clienteInicial) : {}) }));
  const [empresaId, setEmpresaId] = useState(clienteInicial?.empresa_id ?? "");
  // react-doctor-disable-next-line no-derived-useState
  const [cliente, setCliente] = useState<Cliente | null>(clienteInicial);
  const [moto, setMoto] = useState<Moto | null>(null);
  const [paso, setPaso] = useState(0);
  const [intentado, setIntentado] = useState<Set<number>>(() => new Set());
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const hechos = useRef<Hechos>({});
  const previa = useDeferredValue(b);

  const empresa = empresas.find((e) => e.id === empresaId) ?? null;
  const libres = useMemo(() => {
    const ocupadas = new Set(contratos.filter((c) => c.estado === "activo").map((c) => c.moto_id));
    return cliente ? motos.filter((m) => m.cliente_id === cliente.id && !ocupadas.has(m.id)) : [];
  }, [contratos, motos, cliente]);
  const listos = PASOS_NUEVO.map((_, i) => pasoNuevoListo(i, b) && (i !== 0 || !!empresa));
  const completo = listos.every(Boolean);
  const poner = (k: ClaveBorrador, v: string) => setB((x) => ({ ...x, [k]: v }));
  const problema = (k: ClaveBorrador) => problemaBorrador(b, k);

  const elegirEmpresa = (id: string) => {
    const e = empresas.find((x) => x.id === id);
    if (!e) return;
    setEmpresaId(e.id);
    setB((x) => ({ ...x, ...datosEmpresa(e), cuenta: cuentaPorDefecto(cuentas, e.id) }));
  };
  const elegirCliente = (c: Cliente | null) => {
    setCliente(c);
    setMoto(null);
    setB((x) => ({ ...x, ...datosCliente(c), ...datosMoto(null) }));
    if (c && !empresaId) elegirEmpresa(c.empresa_id);
  };
  const elegirMoto = (m: Moto | null) => {
    setMoto(m);
    setB((x) => ({ ...x, ...datosMoto(m) }));
  };

  const ir = (i: number) => {
    setPaso(i);
    setAviso(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const siguiente = () => {
    if (!listos[paso]) {
      setIntentado((s) => new Set(s).add(paso));
      return setAviso(paso === 0 && !empresa ? "Elige la empresa." : "Completa lo marcado en rojo para seguir.");
    }
    ir(paso + 1);
  };

  const crear = async () => {
    if (!completo || !empresa) return setAviso("Aún faltan datos: corrígelos con el botón “Corregir”.");
    // la ventana se abre en el clic (si no, el navegador la bloquea) y se llena después de guardar
    const ventana = window.open("", "_blank");
    if (!ventana) return setAviso("El navegador bloqueó la ventana. Permite las ventanas emergentes para este sitio.");
    setOcupado(true);
    setAviso(null);
    try {
      const id = await crearTodo({ datos, b, empresa, cliente, moto, hechos: hechos.current });
      ventana.document.open();
      ventana.document.write(htmlContrato(aCampos(b)));
      ventana.document.close();
      router.push(`/contratos/ver?id=${id}&nuevo=1`);
    } catch (e) {
      ventana.close();
      setAviso(mensajeDeError(e));
      setOcupado(false);
    }
  };

  const plazo = plazoMeses(b);
  const resumenCuotas = plazo ? (
    <p className="mt-4 rounded-xl bg-fondo p-3 text-sm">
      Plazo del contrato: <b>{plazo} meses</b>
      {ultimaCuota(b) && (
        <>
          {" "}· última cuota el <b>{formatoFecha(ultimaCuota(b))}</b>
        </>
      )}
      {Number(b.renta) > 0 && (
        <>
          {" "}· total en cuotas <b>S/ {(Number(b.renta) * Number(b.nro_cuotas)).toLocaleString("es-PE", { minimumFractionDigits: 2 })}</b>
        </>
      )}
    </p>
  ) : null;

  const arriba = [
    <ElegirEmpresa key="e" empresas={empresas} valor={empresaId} alElegir={(e) => elegirEmpresa(e.id)} error={intentado.has(0) && !empresa ? "Elige la empresa." : null} />,
    <ElegirCliente key="c" clientes={clientes} elegido={cliente} alElegir={elegirCliente} />,
    <ElegirMoto key="m" motos={libres} elegida={moto} alElegir={elegirMoto} />,
    null,
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <Avance nombres={PASOS_NUEVO.map((p) => p.corto)} listos={listos} actual={paso} alIr={ir} />
        {paso < ULTIMO ? (
          <PasoContrato
            paso={PASOS_NUEVO[paso]}
            valores={b as unknown as Record<ClaveBorrador, string>}
            etiqueta={etiquetaBorrador}
            problema={problema}
            cuentas={cuentas.filter((c) => c.empresa_id === empresaId && c.activa).map((c) => c.nombre)}
            mostrarErrores={intentado.has(paso)}
            alCambiar={poner}
            arriba={arriba[paso]}
            abajo={paso === 3 ? resumenCuotas : null}
          />
        ) : (
          <Revision
            pasos={PASOS_NUEVO}
            valores={b as unknown as Record<ClaveBorrador, string>}
            etiqueta={etiquetaBorrador}
            problema={problema}
            titulo="Revisa y crea el contrato"
            extra={(i) => (i === 3 && plazo ? <Dato t="Plazo" v={`${plazo} meses · última cuota ${formatoFecha(ultimaCuota(b))}`} /> : null)}
            alEditar={(i) => {
              setIntentado((s) => new Set(s).add(i));
              ir(i);
            }}
          />
        )}

        <div className="sticky bottom-20 z-10 flex flex-col gap-3 rounded-2xl border border-borde bg-superficie p-3 shadow-lg md:bottom-4">
          {aviso && (
            <Aviso tipo="error" alCerrar={() => setAviso(null)}>
              {aviso}
            </Aviso>
          )}
          {paso === ULTIMO && <p className="text-sm text-tenue">Al crear se registran el cliente y la moto (si son nuevos), se arma el cronograma y se abre el contrato para imprimir y firmar.</p>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Boton variante="fantasma" onClick={() => (paso === 0 ? router.back() : ir(paso - 1))}>
              {paso === 0 ? "Cancelar" : "← Atrás"}
            </Boton>
            {paso < ULTIMO ? (
              <Boton onClick={siguiente}>Siguiente →</Boton>
            ) : (
              <Boton cargando={ocupado} onClick={crear} disabled={!completo}>
                Crear contrato y descargar PDF
              </Boton>
            )}
          </div>
        </div>
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-20 flex flex-col gap-2">
          <p className="text-sm font-semibold text-tenue">Vista previa · así saldrá el contrato</p>
          <iframe title="Vista previa del contrato" sandbox="" srcDoc={htmlContrato(aCampos(previa), { vistaPrevia: true })} className="h-[calc(100dvh-8rem)] w-full rounded-2xl border border-borde bg-white" />
        </div>
      </aside>
    </div>
  );
}
