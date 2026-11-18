"use client";
import { BotonPdfCronograma } from "@/components/reportes/PdfCronograma";
import { useSesion } from "@/components/layout/Sesion";
import { BotonEnlace, Cargando, Dato, EtiquetaSemaforo, NOMBRE_DOCUMENTO, NOMBRE_ESTADO_CONTRATO, Tarjeta, formatoFecha, formatoSoles } from "@/components/ui";
import type { Cliente, Contrato, Cuota, Documento, EstadoCliente, Moto } from "@/types/database";
import { CronogramaConComprobantes } from "../../contratos/_componentes/ComprobanteAnterior";
import { Foto } from "./Foto";
import { MapaCliente } from "./MapaCliente";
import { GRUPOS_FOTOS, GRUPO_VEHICULO, TIPOS_VEHICULO, type GrupoFotos } from "./secciones";

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
            <Dato etiqueta="Cuota">{formatoSoles(estado.cuota)}</Dato>
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
        <div className="sm:col-span-2">
          <Dato etiqueta="Recomendado por">{cliente.recomendado_por}</Dato>
        </div>
      </dl>
      <h3 className="mt-4 mb-2 font-bold">Ubicación</h3>
      <MapaCliente ubicacion={cliente.ubicacion} direccion={cliente.direccion} nombre={cliente.nombres} />
      <h3 className="mt-4 mb-2 font-bold">Fotos</h3>
      {/* las del vehículo salen en el cronograma de cada vehículo */}
      <GaleriaFotos grupos={GRUPOS_FOTOS} documentos={documentos.filter((d) => !d.moto_id && !TIPOS_VEHICULO.has(d.tipo))} nombre={cliente.nombres} />
    </Tarjeta>
  );
}

/** Miniaturas por grupo (se amplían al tocarlas). */
function GaleriaFotos({ grupos, documentos, nombre, vacio = "Sin fotos todavía." }: { grupos: GrupoFotos[]; documentos: Documento[]; nombre: string; vacio?: string }) {
  if (!documentos.length) return <p className="text-sm text-tenue">{vacio}</p>;
  return (
    <div className="flex flex-col gap-3">
      {grupos.map((g) => {
        const espacios = g.espacios.flatMap((e) => documentos.filter((d) => d.tipo === e.tipo).map((d) => ({ d, etiqueta: e.etiqueta })));
        if (!espacios.length) return null;
        return (
          <section key={g.titulo} className="flex flex-col gap-1.5">
            <h4 className="text-sm font-semibold text-tenue">{g.titulo}</h4>
            <div className="flex flex-wrap gap-2">
              {espacios.map(({ d, etiqueta }) => (
                <figure key={d.id} className="flex w-20 flex-col gap-1">
                  <Foto bucket="documentos" ruta={d.ruta} titulo={`${NOMBRE_DOCUMENTO[d.tipo]} · ${nombre}`} className="size-20" />
                  <figcaption className="truncate text-xs leading-tight font-semibold" title={etiqueta}>
                    {etiqueta}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** "CVN298", "En trámite" o "Sin placa". */
const textoPlaca = (m?: Moto) => m?.placa ?? (m?.placa_tramite ? "Placa en trámite" : "Sin placa");

interface PropsCronograma {
  cliente: Cliente;
  empresa?: string;
  contratos: Contrato[];
  motos: Map<string, Moto>;
  /** para mostrar las fotos de cada vehículo */
  documentos: Documento[];
  contratoActivo: string | null;
  alElegir: (id: string) => void;
  cuotas: Cuota[] | null;
  /** cajero de oficina: sin enlace al contrato */
  soloLectura?: boolean;
  /** tras subir el comprobante de cuotas del cuaderno */
  alCambiar: () => void;
}

/**
 * Cronograma del vehículo elegido. Con varios vehículos, una pestaña por cada uno ("Vehículo 1 · placa"),
 * en el orden en que se registraron; cada uno con sus fotos.
 */
export function TarjetaCronograma({ cliente, empresa, contratos, motos, documentos, contratoActivo, alElegir, cuotas, soloLectura, alCambiar }: PropsCronograma) {
  const { esAdmin } = useSesion();
  const contrato = contratos.find((c) => c.id === contratoActivo);
  const moto = contrato ? motos.get(contrato.moto_id) : undefined;
  const enOrden = [...contratos].sort((a, b) => a.creado_en.localeCompare(b.creado_en));
  const numero = enOrden.findIndex((c) => c.id === contratoActivo) + 1;
  const varios = contratos.length > 1;
  const fotosMoto = moto ? documentos.filter((d) => d.moto_id === moto.id) : [];
  return (
    <Tarjeta
      className="mt-4"
      titulo={
        moto
          ? `${varios ? `Vehículo ${numero}` : "Cronograma"} · ${textoPlaca(moto)} (${[moto.marca, moto.tipo].filter(Boolean).join(" ")})${empresa ? ` · ${empresa}` : ""}`
          : "Cronograma"
      }
      accion={
        <div className="flex flex-wrap items-center gap-2">
          {contrato && cuotas && moto && (
            <BotonPdfCronograma cliente={cliente.nombres} dni={cliente.dni} tipoDoc={cliente.tipo_doc} placa={moto.placa ?? (moto.placa_tramite ? "PLACA EN TRÁMITE" : null)} empresa={empresa ?? ""} contrato={contrato} cuotas={cuotas} />
          )}
          {contrato && soloLectura !== true && (
            <BotonEnlace href={`/contratos/ver?id=${contrato.id}`} variante="fantasma" tamano="chico">
              Ver contrato
            </BotonEnlace>
          )}
        </div>
      }
    >
      {varios && (
        <div role="tablist" aria-label="Vehículos del cliente" className="-mt-1 mb-4 flex flex-wrap gap-2">
          {enOrden.map((c, i) => {
            const m = motos.get(c.moto_id);
            const elegido = c.id === contratoActivo;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={elegido}
                onClick={() => alElegir(c.id)}
                className={`flex min-h-11 flex-col items-start rounded-xl border-2 px-3 py-1.5 text-left leading-tight ${elegido ? "border-marca bg-marca-suave" : "border-borde bg-superficie hover:border-marca/60"}`}
              >
                <span className="text-sm font-bold">Vehículo {i + 1}</span>
                <span className={`text-xs font-semibold ${m?.placa ? "" : "text-amarillo"}`}>
                  {textoPlaca(m)}
                  {c.estado !== "activo" ? ` · ${NOMBRE_ESTADO_CONTRATO[c.estado]}` : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {moto && (
        <details className="mb-4 rounded-xl border border-borde p-3" open={fotosMoto.length > 0}>
          <summary className="cursor-pointer font-semibold">Fotos de este vehículo ({fotosMoto.length})</summary>
          <div className="mt-3">
            <GaleriaFotos grupos={[GRUPO_VEHICULO]} documentos={fotosMoto} nombre={`${cliente.nombres} · ${textoPlaca(moto)}`} vacio="Sin fotos de este vehículo todavía (se agregan en Editar)." />
          </div>
        </details>
      )}
      {contrato && esAdmin && (contrato.capital != null || contrato.fecha_entrega) && <ResumenCapital contrato={contrato} />}
      {cuotas && contrato ? <CronogramaConComprobantes contrato={contrato} cuotas={cuotas} alGuardar={alCambiar} /> : <Cargando variante="cuotas" />}
    </Tarjeta>
  );
}

/** Capital, interés, GPS y entrega del vehículo (solo administradores: el cliente no lo ve). */
function ResumenCapital({ contrato }: { contrato: Contrato }) {
  const total = contrato.monto_cuota * contrato.nro_cuotas;
  const interes =
    contrato.interes_pct != null
      ? `${contrato.interes_pct.toLocaleString("es-PE")} % ${(contrato.capital ?? 0) > 12000 ? "al año" : "por mes"}`
      : contrato.interes_mes != null
        ? `${formatoSoles(contrato.interes_mes)} por mes`
        : "—";
  return (
    <dl className="mb-4 grid gap-3 rounded-xl border border-borde bg-fondo p-3 sm:grid-cols-3 lg:grid-cols-6">
      {contrato.capital != null && (
        <>
          <Dato etiqueta="Capital prestado">
            <span className="num font-bold">{formatoSoles(contrato.capital)}</span>
          </Dato>
          <Dato etiqueta="Interés">
            <span className="num font-bold">{interes}</span>
          </Dato>
          {contrato.gps_mes != null && (
            <Dato etiqueta="GPS">
              <span className="num font-bold">{formatoSoles(contrato.gps_mes)} por mes</span>
            </Dato>
          )}
          <Dato etiqueta="Interés y GPS en soles">
            <span className="num font-bold">{formatoSoles(total - contrato.capital)}</span>
          </Dato>
          <Dato etiqueta="Total del cronograma">
            <span className="num font-bold">{formatoSoles(total)}</span>
          </Dato>
        </>
      )}
      {contrato.fecha_entrega && (
        <Dato etiqueta="Entrega del vehículo">
          <span className="font-bold">{formatoFecha(contrato.fecha_entrega)}</span>
        </Dato>
      )}
    </dl>
  );
}
