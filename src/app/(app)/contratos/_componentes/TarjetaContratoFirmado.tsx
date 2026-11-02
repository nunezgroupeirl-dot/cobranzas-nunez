"use client";
import { useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { Aviso, Boton, Tarjeta, mensajeDeError, useCarga } from "@/components/ui";
import { CALIDAD_HOJA, subirDocumento } from "@/lib/fotos";
import type { Cliente, Contrato, Empresa, Moto } from "@/types/database";
import { Foto } from "../../clientes/_componentes/Foto";
import { BotonPlantillaContrato } from "./BotonPlantillaContrato";
import { ModalImprimirContrato } from "./ModalImprimirContrato";

interface Props {
  contrato: Contrato;
  cliente: Cliente | null;
  moto: Moto | null;
  empresa: Empresa | null;
}

/** Contrato en papel: se imprime desde aquí y, ya firmado, se escanea y se suben sus páginas. */
export function TarjetaContratoFirmado({ contrato, cliente, moto, empresa }: Props) {
  if (!cliente || !moto || !empresa) return null;
  return <Contenido contrato={contrato} cliente={cliente} moto={moto} empresa={empresa} />;
}

function Contenido({ contrato, cliente, moto, empresa }: { contrato: Contrato; cliente: Cliente; moto: Moto; empresa: Empresa }) {
  const { datos } = useSesion();
  const [imprimiendo, setImprimiendo] = useState(false);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { datos: info, recargar } = useCarga(async () => {
    const [docs, cuentas] = await Promise.all([datos.documentos(cliente.id), datos.cuentas()]);
    return { paginas: docs.filter((d) => d.contrato_id === contrato.id), cuentas };
  }, [datos, cliente.id, contrato.id]);
  const paginas = info?.paginas ?? [];

  const subir = async (lista: FileList | null) => {
    const archivos = Array.from(lista ?? []);
    if (!archivos.length) return;
    setError(null);
    try {
      // una por una, para que las páginas queden en orden
      for (const [i, archivo] of archivos.entries()) {
        setSubiendo(`Subiendo página ${i + 1} de ${archivos.length}…`);
        // react-doctor-disable-next-line async-await-in-loop
        const ruta = await subirDocumento(datos, contrato.empresa_id, cliente.id, "contrato", archivo, CALIDAD_HOJA);
        // react-doctor-disable-next-line async-await-in-loop
        await datos.agregarDocumento({ cliente_id: cliente.id, tipo: "contrato", ruta, contrato_id: contrato.id });
      }
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setSubiendo(null);
      recargar();
    }
  };

  const quitar = async (id: string, n: number) => {
    if (!confirm(`¿Quitar la página ${n} del contrato firmado?`)) return;
    try {
      await datos.borrarDocumento(id);
      recargar();
    } catch (e) {
      setError(mensajeDeError(e));
    }
  };

  return (
    <Tarjeta
      className="mt-4"
      titulo={`Contrato firmado ${paginas.length ? `(${paginas.length} ${paginas.length === 1 ? "página" : "páginas"})` : ""}`}
      accion={
        <div className="flex flex-wrap gap-2">
          <BotonPlantillaContrato />
          <Boton variante="secundario" tamano="chico" onClick={() => setImprimiendo(true)}>
            Con los datos (PDF)
          </Boton>
        </div>
      }
    >
      <p className="mb-3 text-sm text-tenue">
        1. Imprime la plantilla en blanco para llenarla a mano, o el contrato ya lleno con los datos del sistema. 2. Fírmenlo y pongan la huella. 3. Escanéalo o
        tómale foto a cada hoja y súbelas aquí, en orden.
      </p>
      {paginas.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-3">
          {paginas.map((p, i) => (
            <figure key={p.id} className="flex w-32 flex-col gap-1">
              <Foto bucket="documentos" ruta={p.ruta} titulo={`Contrato firmado · página ${i + 1}`} className="h-44 w-32" />
              <figcaption className="flex justify-between text-xs">
                <span className="font-semibold">Página {i + 1}</span>
                <button type="button" onClick={() => quitar(p.id, i + 1)} className="font-semibold text-rojo">
                  Quitar
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <label
        className={`inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-marca px-5 font-semibold text-marca hover:bg-marca-suave ${subiendo ? "pointer-events-none opacity-60" : ""}`}
      >
        {subiendo ?? (paginas.length ? "+ Agregar más páginas" : "+ Subir hojas firmadas")}
        <input
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          aria-label="Subir hojas del contrato firmado"
          disabled={!!subiendo}
          onChange={(e) => {
            subir(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      <p className="mt-2 text-xs text-tenue">Fotos o escaneos en JPG o PNG. Puedes elegir varias hojas a la vez.</p>
      {error && (
        <div className="mt-3">
          <Aviso tipo="error">{error}</Aviso>
        </div>
      )}
      {imprimiendo && (
        <ModalImprimirContrato contrato={contrato} cliente={cliente} moto={moto} empresa={empresa} cuentas={info?.cuentas ?? []} alCerrar={() => setImprimiendo(false)} />
      )}
    </Tarjeta>
  );
}
