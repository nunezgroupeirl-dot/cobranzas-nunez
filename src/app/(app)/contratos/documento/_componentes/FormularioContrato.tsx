"use client";
import { useDeferredValue, useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { camposFaltantes, fechaFin, htmlContrato, problemaCampo, type CamposContrato } from "@/components/reportes/ContratoImpreso";
import { Aviso, Boton, mensajeDeError } from "@/components/ui";
import type { Cliente, Contrato, Empresa, Moto } from "@/types/database";
import { Avance } from "./Avance";
import { PASOS, TOTAL_PASOS, pasoListo } from "./pasos";
import { PasoContrato } from "./PasoContrato";
import { Revision } from "./Revision";

interface Props {
  contrato: Contrato;
  cliente: Cliente;
  moto: Moto;
  empresa: Empresa;
  iniciales: CamposContrato;
  cuentas: string[];
}

const nulo = (x: string) => x.trim() || null;
const ULTIMO = TOTAL_PASOS - 1;

/**
 * Pasarela del contrato: 4 pasos + revisión, uno a la vez. Todo es obligatorio
 * (solo quedan en blanco firmas y huellas). Al final sale la plantilla del contrato ya llenada, lista para firmar.
 */
export function FormularioContrato({ contrato, cliente, moto, empresa, iniciales, cuentas }: Props) {
  const { datos } = useSesion();
  // Los datos iniciales solo arrancan el formulario (la página lo monta con key = id del contrato)
  // react-doctor-disable-next-line no-derived-useState
  const [f, setF] = useState<CamposContrato>(iniciales);
  const [paso, setPaso] = useState(0);
  const [intentado, setIntentado] = useState<Set<number>>(() => new Set());
  const [actualizarFichas, setActualizarFichas] = useState(true);
  const [ocupado, setOcupado] = useState<"" | "guardar" | "pdf">("");
  const [aviso, setAviso] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);
  const previa = useDeferredValue(f);
  const problemas = (Object.keys(f) as (keyof CamposContrato)[]).filter((k) => problemaCampo(f, k));
  const completo = problemas.length === 0;
  const poner = (k: keyof CamposContrato, v: string) => setF((x) => ({ ...x, [k]: v }));

  const ir = (i: number) => {
    setPaso(i);
    setAviso(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const siguiente = () => {
    if (!pasoListo(paso, f)) {
      setIntentado((s) => new Set(s).add(paso));
      setAviso({ tipo: "error", texto: "Completa lo marcado en rojo para seguir." });
      return;
    }
    ir(paso + 1);
  };

  /** Pasa a las fichas (empresa, cliente y moto) lo que se completó aquí, para no escribirlo otra vez. */
  const pasarAFichas = async () => {
    const tareas: Promise<unknown>[] = [];
    const empresaNueva = { ruc: nulo(f.ruc), representante: nulo(f.representante), representante_dni: nulo(f.representante_dni), domicilio: nulo(f.domicilio_empresa) };
    if ((Object.keys(empresaNueva) as (keyof typeof empresaNueva)[]).some((k) => empresaNueva[k] !== (empresa[k] ?? null)))
      tareas.push(datos.guardarEmpresa({ ...empresa, ...empresaNueva }));
    // El DNI solo se completa si faltaba (el del sistema no se cambia desde aquí)
    const dni = cliente.dni ?? (problemaCampo(f, "doc_numero") ? null : f.doc_numero);
    if (nulo(f.domicilio_cliente) !== (cliente.direccion ?? null) || dni !== cliente.dni) {
      const { id, empresa_id, nombres, celular, referencia, ubicacion } = cliente;
      tareas.push(datos.guardarCliente({ id, empresa_id, nombres, dni, celular, referencia, ubicacion, direccion: nulo(f.domicilio_cliente) }));
    }
    const ficha = {
      placa: moto.placa ?? nulo(f.placa),
      marca: f.marca.trim() || moto.marca,
      color: f.color.trim() || moto.color,
      modelo: nulo(f.modelo),
      anio: f.anio ? Number(f.anio) : null,
      clase: nulo(f.clase),
      combustible: nulo(f.combustible),
      serie: nulo(f.serie),
      motor: nulo(f.motor),
      carroceria: nulo(f.carroceria),
    };
    if ((Object.keys(ficha) as (keyof typeof ficha)[]).some((k) => ficha[k] !== (moto[k] ?? null))) tareas.push(datos.guardarMoto({ ...moto, ...ficha }));
    await Promise.all(tareas);
  };

  const guardar = async () => {
    await datos.guardarDocumentoContrato(contrato.id, { ...f, fin: fechaFin(f) });
    if (actualizarFichas) await pasarAFichas();
  };

  const soloGuardar = async () => {
    setOcupado("guardar");
    setAviso(null);
    try {
      await guardar();
      setAviso({ tipo: "exito", texto: completo ? "Contrato guardado." : `Avance guardado. Faltan ${camposFaltantes(f).length || problemas.length} datos.` });
    } catch (e) {
      setAviso({ tipo: "error", texto: mensajeDeError(e) });
    } finally {
      setOcupado("");
    }
  };

  const guardarYDescargar = async () => {
    if (!completo) return setAviso({ tipo: "error", texto: "Aún faltan datos: corrígelos con el botón “Corregir”." });
    // la ventana se abre en el clic (si no, el navegador la bloquea) y se llena después de guardar
    const ventana = window.open("", "_blank");
    if (!ventana) return setAviso({ tipo: "error", texto: "El navegador bloqueó la ventana. Permite las ventanas emergentes para este sitio." });
    setOcupado("pdf");
    setAviso(null);
    try {
      await guardar();
      ventana.document.open();
      ventana.document.write(htmlContrato(f));
      ventana.document.close();
      setAviso({ tipo: "exito", texto: "Listo: en la ventana nueva elige la impresora o “Guardar como PDF”. Ya firmado, súbelo en la pantalla del contrato." });
    } catch (e) {
      ventana.close();
      setAviso({ tipo: "error", texto: mensajeDeError(e) });
    } finally {
      setOcupado("");
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <Avance actual={paso} valores={f} alIr={ir} />
        {paso < PASOS.length ? (
          <PasoContrato paso={PASOS[paso]} valores={f} cuentas={cuentas} mostrarErrores={intentado.has(paso)} alCambiar={poner} />
        ) : (
          <Revision valores={f} alEditar={(i) => { setIntentado((s) => new Set(s).add(i)); ir(i); }} />
        )}

        <div className="sticky bottom-20 z-10 flex flex-col gap-3 rounded-2xl border border-borde bg-superficie p-3 shadow-lg md:bottom-4">
          {aviso && (
            <Aviso tipo={aviso.tipo} alCerrar={() => setAviso(null)}>
              {aviso.texto}
            </Aviso>
          )}
          {paso === ULTIMO && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={actualizarFichas} onChange={(e) => setActualizarFichas(e.target.checked)} className="size-5 shrink-0 accent-marca" />
              Pasar también estos datos a las fichas (empresa, DNI y dirección del cliente, placa y ficha de la moto)
            </label>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Boton variante="fantasma" onClick={() => ir(paso - 1)} disabled={paso === 0}>
              ← Atrás
            </Boton>
            <div className="flex flex-wrap gap-2">
              <Boton variante="secundario" cargando={ocupado === "guardar"} onClick={soloGuardar}>
                Guardar avance
              </Boton>
              {paso < ULTIMO ? (
                <Boton onClick={siguiente}>Siguiente →</Boton>
              ) : (
                <Boton cargando={ocupado === "pdf"} onClick={guardarYDescargar} disabled={!completo}>
                  Guardar y descargar PDF
                </Boton>
              )}
            </div>
          </div>
        </div>
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-20 flex flex-col gap-2">
          <p className="text-sm font-semibold text-tenue">Vista previa · así saldrá el contrato</p>
          <iframe title="Vista previa del contrato" sandbox="" srcDoc={htmlContrato(previa, { vistaPrevia: true })} className="h-[calc(100dvh-8rem)] w-full rounded-2xl border border-borde bg-white" />
        </div>
      </aside>
    </div>
  );
}
