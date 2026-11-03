"use client";
import { BotonPdfCronograma } from "@/components/reportes/PdfCronograma";
import { BotonEnlace, Cargando, Dato, EtiquetaSemaforo, NOMBRE_DOCUMENTO, NOMBRE_ESTADO_CONTRATO, Tarjeta, formatoFecha, formatoSoles } from "@/components/ui";
import type { Cliente, Contrato, Cuota, Documento, EstadoCliente, Moto } from "@/types/database";
import { Cronograma } from "../../contratos/_componentes/Cronograma";
import { Foto } from "./Foto";
import { MapaCliente } from "./MapaCliente";

/** Semáforo, deuda y próxima cuota del contrato elegido. */
export function TarjetaSituacion({ estado, deudaTotal }: { estado?: EstadoCliente; deudaTotal: number }) {
  return (
    <Tarjeta className="lg:col-span-1" titulo="Situación">
      {estado ? (
        <div className="flex flex-col gap-3">
          <EtiquetaSemaforo color={estado.color} semanas={estado.semanas_atraso} grande />
          <div>
            <p className="text-sm text-tenue">Deuda vencida</p>
            <p className={`num text-3xl font-extrabold ${deudaTotal > 0 ? "text-rojo" : "text-verde"}`}>{formatoSoles(deudaTotal)}</p>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <Dato etiqueta="Cuota semanal">{formatoSoles(estado.cuota)}</Dato>
            <Dato etiqueta="Próxima cuota">{formatoFecha(estado.proxima_cuota)}</Dato>
            <Dato etiqueta="Último pago">{formatoFecha(estado.ultimo_pago)}</Dato>
            <Dato etiqueta="Empresa">{estado.empresa}</Dato>
          </dl>
        </div>
      ) : (
        <p className="text-tenue">Este cliente no tiene un contrato activo.</p>
      )}
    </Tarjeta>
  );
}

/** Contacto y fotos de documentos. */
export function TarjetaDatos({ cliente, documentos }: { cliente: Cliente; documentos: Documento[] }) {
  return (
    <Tarjeta className="lg:col-span-2" titulo="Datos">
      <dl className="grid gap-3 sm:grid-cols-2">
        <Dato etiqueta="Celular">
          {cliente.celular ? (
            <a href={`tel:${cliente.celular}`} className="text-marca underline">
              {cliente.celular}
            </a>
          ) : null}
        </Dato>
        <Dato etiqueta="Dirección">{cliente.direccion}</Dato>
        <div className="sm:col-span-2">
          <Dato etiqueta="Referencia">{cliente.referencia}</Dato>
        </div>
      </dl>
      <h3 className="mt-4 mb-2 font-bold">Ubicación</h3>
      <MapaCliente ubicacion={cliente.ubicacion} direccion={cliente.direccion} nombre={cliente.nombres} />
      <h3 className="mt-4 mb-2 font-bold">Fotos</h3>
      {documentos.length === 0 ? (
        <p className="text-sm text-tenue">Sin fotos. Agrégalas desde “Editar”.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {documentos.map((d) => (
            <figure key={d.id} className="flex flex-col gap-1">
              <Foto bucket="documentos" ruta={d.ruta} titulo={`${NOMBRE_DOCUMENTO[d.tipo]} · ${cliente.nombres}`} className="size-24" />
              <figcaption className="text-xs font-semibold">{NOMBRE_DOCUMENTO[d.tipo]}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </Tarjeta>
  );
}

interface PropsCronograma {
  cliente: Cliente;
  empresa: string;
  contratos: Contrato[];
  motos: Map<string, Moto>;
  contratoActivo: string | null;
  alElegir: (id: string) => void;
  cuotas: Cuota[] | null;
}

/** Cronograma del contrato elegido, con selector si el cliente tiene varios. */
export function TarjetaCronograma({ cliente, empresa, contratos, motos, contratoActivo, alElegir, cuotas }: PropsCronograma) {
  const contrato = contratos.find((c) => c.id === contratoActivo);
  const moto = contrato ? motos.get(contrato.moto_id) : undefined;
  return (
    <Tarjeta
      className="mt-4"
      titulo={moto ? `Cronograma · ${moto.placa} (${moto.marca} ${moto.tipo})` : "Cronograma"}
      accion={
        <div className="flex flex-wrap items-center gap-2">
          {contratos.length > 1 && (
            <select
              value={contratoActivo ?? ""}
              onChange={(e) => alElegir(e.target.value)}
              className="min-h-11 rounded-xl border border-borde bg-superficie px-3"
              aria-label="Elegir contrato"
            >
              {contratos.map((c) => (
                <option key={c.id} value={c.id}>
                  {motos.get(c.moto_id)?.placa} · desde {formatoFecha(c.fecha_inicio)} ({NOMBRE_ESTADO_CONTRATO[c.estado]})
                </option>
              ))}
            </select>
          )}
          {contrato && cuotas && moto && (
            <BotonPdfCronograma cliente={cliente.nombres} dni={cliente.dni} placa={moto.placa} empresa={empresa} contrato={contrato} cuotas={cuotas} />
          )}
          {contrato && (
            <BotonEnlace href={`/contratos/ver?id=${contrato.id}`} variante="fantasma" tamano="chico">
              Ver contrato
            </BotonEnlace>
          )}
        </div>
      }
    >
      {cuotas ? <Cronograma cuotas={cuotas} /> : <Cargando />}
    </Tarjeta>
  );
}
