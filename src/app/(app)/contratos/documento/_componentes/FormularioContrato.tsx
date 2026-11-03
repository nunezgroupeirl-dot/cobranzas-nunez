"use client";
import { useDeferredValue, useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { camposFaltantes, etiquetaCampo, fechaFin, htmlContrato, type CamposContrato } from "@/components/reportes/ContratoImpreso";
import { Aviso, Boton, formatoFecha, mensajeDeError } from "@/components/ui";
import type { Cliente, Contrato, Empresa, Moto } from "@/types/database";
import { PASOS } from "./pasos";
import { PasoContrato } from "./PasoContrato";

interface Props {
  contrato: Contrato;
  cliente: Cliente;
  moto: Moto;
  empresa: Empresa;
  iniciales: CamposContrato;
  cuentas: string[];
}

const nulo = (x: string) => x.trim() || null;

/** Formulario de 4 pasos + vista previa en vivo del contrato. Guarda los datos con el contrato y genera el PDF listo para firmar. */
export function FormularioContrato({ contrato, cliente, moto, empresa, iniciales, cuentas }: Props) {
  const { datos } = useSesion();
  // Los datos iniciales solo arrancan el formulario (la página lo monta con key = id del contrato)
  // react-doctor-disable-next-line no-derived-useState
  const [f, setF] = useState<CamposContrato>(iniciales);
  const [actualizarFichas, setActualizarFichas] = useState(true);
  const [ocupado, setOcupado] = useState<"" | "guardar" | "pdf">("");
  const [aviso, setAviso] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);
  const previa = useDeferredValue(f);
  const faltan = camposFaltantes(f);
  const poner = (k: keyof CamposContrato, v: string) => setF((x) => ({ ...x, [k]: v }));

  /** Pasa a las fichas (empresa, cliente y moto) lo que se completó aquí, para no escribirlo otra vez. */
  const pasarAFichas = async () => {
    const tareas: Promise<unknown>[] = [];
    const empresaNueva = { ruc: nulo(f.ruc), representante: nulo(f.representante), representante_dni: nulo(f.representante_dni), domicilio: nulo(f.domicilio_empresa) };
    if ((Object.keys(empresaNueva) as (keyof typeof empresaNueva)[]).some((k) => empresaNueva[k] !== (empresa[k] ?? null)))
      tareas.push(datos.guardarEmpresa({ ...empresa, ...empresaNueva }));
    if (nulo(f.domicilio_cliente) !== (cliente.direccion ?? null)) {
      const { id, empresa_id, nombres, dni, celular, referencia, ubicacion } = cliente;
      tareas.push(datos.guardarCliente({ id, empresa_id, nombres, dni, celular, referencia, ubicacion, direccion: nulo(f.domicilio_cliente) }));
    }
    const ficha = {
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
    if (f.anio && (Number(f.anio) < 1990 || Number(f.anio) > 2100)) throw new Error("El año de modelo no es válido.");
    await datos.guardarDocumentoContrato(contrato.id, { ...f, fin: fechaFin(f) });
    if (actualizarFichas) await pasarAFichas();
  };

  const soloGuardar = async () => {
    setOcupado("guardar");
    setAviso(null);
    try {
      await guardar();
      setAviso({ tipo: "exito", texto: "Datos del contrato guardados." });
    } catch (e) {
      setAviso({ tipo: "error", texto: mensajeDeError(e) });
    } finally {
      setOcupado("");
    }
  };

  const guardarYDescargar = async () => {
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
      setAviso({ tipo: "exito", texto: "Listo: en la ventana nueva elige la impresora o “Guardar como PDF”. Después de firmar, sube las hojas en el contrato." });
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
        {PASOS.map((p) => (
          <PasoContrato key={p.titulo} paso={p} valores={f} cuentas={cuentas} alCambiar={poner} />
        ))}
        {f.inicio && Number(f.plazo_meses) >= 1 && <p className="text-sm text-tenue">El contrato termina el {formatoFecha(fechaFin(f))}.</p>}

        <div className="sticky bottom-20 z-10 flex flex-col gap-2 rounded-2xl border border-borde bg-superficie p-3 shadow-lg md:bottom-4">
          {faltan.length > 0 ? (
            <details className="text-sm">
              <summary className="cursor-pointer">
                <b className="text-amarillo">Faltan {faltan.length} datos</b> · saldrán con una raya para llenar a mano
              </summary>
              <p className="mt-1 text-tenue">{faltan.map(etiquetaCampo).join(", ")}.</p>
            </details>
          ) : (
            <p className="text-sm font-semibold text-verde">Todo completo: el PDF sale listo para firmar.</p>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={actualizarFichas} onChange={(e) => setActualizarFichas(e.target.checked)} className="size-5 shrink-0 accent-marca" />
            Pasar también estos datos a las fichas (empresa, dirección del cliente y moto)
          </label>
          {aviso && (
            <Aviso tipo={aviso.tipo} alCerrar={() => setAviso(null)}>
              {aviso.texto}
            </Aviso>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Boton variante="secundario" cargando={ocupado === "guardar"} onClick={soloGuardar}>
              Guardar
            </Boton>
            <Boton cargando={ocupado === "pdf"} onClick={guardarYDescargar}>
              Guardar y descargar PDF
            </Boton>
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
