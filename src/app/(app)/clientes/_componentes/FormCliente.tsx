"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { useEmpresa } from "@/components/layout/empresa";
import { AreaTexto, Aviso, Boton, Campo, NOMBRE_DOCUMENTO, Selector, DOCUMENTOS, TIPOS_DOC, Tarjeta, esDocumentoValido, limpiarDocumento, mensajeDeError } from "@/components/ui";
import { subirDocumento } from "@/lib/fotos";
import { borrarBorrador, guardarArchivosBorrador, guardarBorrador, leerArchivosBorrador, leerBorrador } from "@/lib/borrador";
import { ubicacionValida } from "@/lib/mapa";
import type { TipoDoc, Cliente, Documento } from "@/types/database";
import { CampoUbicacion } from "./CampoUbicacion";
import { FotosPorTipo } from "./FotosPorTipo";
import { MotoYCronograma } from "./MotoYCronograma";
import { GRUPOS_FOTOS, TOTAL_FOTOS, tipoDeClave } from "./secciones";
import { TarjetaContratoFirmado } from "../../contratos/_componentes/TarjetaContratoFirmado";
import { useVehiculos } from "./useVehiculos";
import type { VentaActual } from "./venta";


/** Datos del cliente, sus vehículos (cada uno con su cronograma), sus fotos y sus contratos firmados, en ese orden. */
export function FormCliente({ cliente, actuales }: { cliente?: Cliente; actuales?: VentaActual[] }) {
  const { datos, empresas } = useSesion();
  const empresaFiltro = useEmpresa();
  const router = useRouter();

  const [f, setF] = useState({
    nombres: cliente?.nombres ?? "",
    // el tipo se elige antes del número; los antiguos sin tipo se deducen del largo
    tipo_doc: (cliente?.tipo_doc ?? (cliente?.dni ? (cliente.dni.length === 8 ? "DNI" : "CE") : "")) as "" | TipoDoc,
    dni: cliente?.dni ?? "",
    celular: cliente?.celular ?? "",
    direccion: cliente?.direccion ?? "",
    referencia: cliente?.referencia ?? "",
    recomendado_por: cliente?.recomendado_por ?? "",
    ubicacion: cliente?.ubicacion ?? "",
    empresa_id: cliente?.empresa_id ?? empresaFiltro ?? empresas[0]?.id ?? "",
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<"" | "solo" | "contrato">("");
  // sus vehículos y cronogramas en el mismo formulario (el contrato en papel se llena después)
  const vehiculos = useVehiculos(!cliente, actuales);
  const hechos = useRef<{ cliente?: Cliente }>({});
  const [existentes, setExistentes] = useState<Documento[]>([]);
  // una foto nueva por tipo (cliente, DNI, moto…): se suben al guardar
  const [pendientes, setPendientes] = useState<Record<string, File>>({}); // clave: tipo, o "otro:n" (ver tipoDeClave)

  useEffect(() => {
    if (cliente) datos.documentos(cliente.id).then((d) => setExistentes(d.filter((x) => x.tipo !== "contrato")));
  }, [cliente, datos]);

  // Borrador: lo que se va llenando queda guardado en este navegador hasta tocar "Guardar".
  // Si se sale sin querer a otra sección, al volver aparece todo como estaba (también las fotos elegidas).
  const claveBorrador = `cn-borrador-cliente:${cliente?.id ?? "nuevo"}`;
  const [recuperado, setRecuperado] = useState(false);
  const borradorListo = useRef(false);
  useEffect(() => {
    const b = leerBorrador<{ f: typeof f; items: Parameters<typeof vehiculos.restaurar>[0] }>(claveBorrador);
    if (b) {
      setF((x) => ({ ...x, ...b.f }));
      vehiculos.restaurar(b.items ?? []);
      setRecuperado(true);
    }
    leerArchivosBorrador(claveBorrador)
      .then((a) => {
        if (Object.keys(a).length) {
          setPendientes(a);
          setRecuperado(true);
        }
      })
      .finally(() => {
        borradorListo.current = true;
      });
    // solo al abrir el formulario
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveBorrador]);
  useEffect(() => {
    if (!borradorListo.current || guardando) return;
    const t = window.setTimeout(() => {
      guardarBorrador(claveBorrador, { f, items: vehiculos.items.map(({ clave, v, actual, activo }) => ({ clave, v, actual, activo })) });
    }, 400);
    return () => window.clearTimeout(t);
  }, [claveBorrador, f, vehiculos.items, guardando]);
  useEffect(() => {
    if (!borradorListo.current || guardando) return;
    void guardarArchivosBorrador(claveBorrador, pendientes);
  }, [claveBorrador, pendientes, guardando]);
  const descartarBorrador = async () => {
    if (!confirm("¿Borrar lo que llenaste y empezar de nuevo?")) return;
    await borrarBorrador(claveBorrador);
    window.location.reload();
  };

  const poner = (campo: keyof typeof f, valor: string) => setF((x) => ({ ...x, [campo]: valor }));

  const validar = () => {
    const e: Record<string, string> = {};
    if (!f.nombres.trim()) e.nombres = "Escribe el nombre completo.";
    if (f.dni && !f.tipo_doc) e.tipo_doc = "Elige el tipo de documento.";
    else if (f.dni && f.tipo_doc && !esDocumentoValido(f.dni, f.tipo_doc)) e.dni = DOCUMENTOS[f.tipo_doc].ayuda;
    if (f.celular && !/^9\d{8}$/.test(f.celular)) e.celular = "El celular debe tener 9 números y empezar con 9.";
    if (!f.empresa_id) e.empresa_id = "Elige la empresa.";
    if (!ubicacionValida(f.ubicacion)) e.ubicacion = "Pega un enlace de Google Maps o coordenadas como -12.0464,-77.0428.";
    setErrores(e);
    const vehiculosOk = vehiculos.validar();
    return Object.keys(e).length === 0 && vehiculosOk;
  };

  const quitarExistente = async (d: Documento) => {
    if (!confirm(`¿Quitar "${NOMBRE_DOCUMENTO[d.tipo]}"?`)) return;
    await datos.borrarDocumento(d.id); // también borra el archivo guardado
    setExistentes((x) => x.filter((y) => y.id !== d.id));
  };

  const guardar = async (e: { preventDefault: () => void }, despues: "solo" | "contrato") => {
    e.preventDefault();
    if (!validar()) return;
    setGuardando(despues);
    setError(null);
    try {
      const guardado = await datos.guardarCliente({
        id: cliente?.id ?? hechos.current.cliente?.id,
        empresa_id: f.empresa_id,
        nombres: f.nombres.trim(),
        dni: f.dni || null,
        tipo_doc: f.tipo_doc || null,
        celular: f.celular || null,
        direccion: f.direccion.trim() || null,
        referencia: f.referencia.trim() || null,
        recomendado_por: f.recomendado_por.trim() || null,
        ubicacion: f.ubicacion.trim() || null,
      });
      // Una foto por tipo (máximo 6): se suben a la vez (cada una se comprime, sube y registra por su cuenta)
      await Promise.all(
        Object.entries(pendientes).map(async ([clave, archivo]) => {
          const tipo = tipoDeClave(clave);
          const ruta = await subirDocumento(datos, guardado.empresa_id, guardado.id, tipo, archivo);
          await datos.agregarDocumento({ cliente_id: guardado.id, tipo, ruta });
        }),
      );
      hechos.current.cliente = guardado;
      setPendientes({});
      const primerNuevo = await vehiculos.guardarTodos(datos, guardado);
      await borrarBorrador(claveBorrador); // ya quedó guardado de verdad
      if (despues === "contrato" && !cliente) {
        // "Guardar y llenar el contrato": directo al contrato con todo ya puesto (cliente, vehículo y cuotas)
        router.push(primerNuevo ? `/contratos/documento?id=${primerNuevo}` : `/contratos/nuevo?cliente=${guardado.id}`);
        return;
      }
      router.push(`/clientes/ficha?id=${guardado.id}`);
    } catch (err) {
      setError(mensajeDeError(err));
      setGuardando("");
    }
  };

  const opcionesEmpresa = useMemo(() => empresas.map((e) => ({ valor: e.id, texto: e.nombre })), [empresas]);

  return (
    <form onSubmit={(e) => guardar(e, cliente ? "solo" : "contrato")} className="flex flex-col gap-4" noValidate>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {recuperado && (
        <Aviso tipo="exito">
          Recuperamos lo que estabas llenando (aún sin guardar).{" "}
          <button type="button" onClick={descartarBorrador} className="font-semibold underline">
            Empezar de nuevo
          </button>
        </Aviso>
      )}
      <Tarjeta titulo="Datos del cliente">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Campo etiqueta="Nombres y apellidos" value={f.nombres} onChange={(e) => poner("nombres", e.target.value)} error={errores.nombres} obligatorio autoComplete="off" />
          </div>
          <Selector
            etiqueta="Tipo de documento"
            opciones={TIPOS_DOC}
            value={f.tipo_doc}
            onChange={(e) => {
              const tipo = e.target.value as "" | TipoDoc;
              setF((x) => ({ ...x, tipo_doc: tipo, dni: tipo ? limpiarDocumento(x.dni, tipo).slice(0, DOCUMENTOS[tipo].largo) : x.dni }));
            }}
            error={errores.tipo_doc}
            vacio="Elige…"
          />
          <Campo
            etiqueta={f.tipo_doc ? `N.º de ${DOCUMENTOS[f.tipo_doc].texto}` : "N.º de documento"}
            inputMode={f.tipo_doc && DOCUMENTOS[f.tipo_doc].letras ? "text" : "numeric"}
            maxLength={f.tipo_doc ? DOCUMENTOS[f.tipo_doc].largo : 12}
            disabled={!f.tipo_doc}
            value={f.dni}
            onChange={(e) => poner("dni", limpiarDocumento(e.target.value, f.tipo_doc || null))}
            error={errores.dni}
            ayuda={!f.tipo_doc ? "Primero elige el tipo de documento." : f.dni ? undefined : "Si aún no lo tienes, déjalo vacío: saldrá en “Datos pendientes”."}
          />
          <Campo
            etiqueta="Celular"
            inputMode="tel"
            maxLength={9}
            value={f.celular}
            onChange={(e) => poner("celular", e.target.value.replace(/\D/g, ""))}
            error={errores.celular}
          />
          <Selector etiqueta="Empresa" opciones={opcionesEmpresa} value={f.empresa_id} onChange={(e) => poner("empresa_id", e.target.value)} error={errores.empresa_id} obligatorio vacio="Elige…" />
          <Campo etiqueta="Dirección" value={f.direccion} onChange={(e) => poner("direccion", e.target.value)} />
          <div className="sm:col-span-2">
            <CampoUbicacion valor={f.ubicacion} direccion={f.direccion} error={errores.ubicacion} alCambiar={(v) => poner("ubicacion", v)} />
          </div>
          <div className="sm:col-span-2">
            <AreaTexto etiqueta="Referencia" value={f.referencia} onChange={(e) => poner("referencia", e.target.value)} ayuda="Cómo llegar, a quién preguntar, etc." />
          </div>
          <div className="sm:col-span-2">
            <Campo
              etiqueta="Recomendado por"
              maxLength={200}
              value={f.recomendado_por}
              onChange={(e) => poner("recomendado_por", e.target.value)}
              ayuda="Quién lo recomendó o el asesor de tienda que lo mandó a la empresa."
            />
          </div>
        </div>
      </Tarjeta>

      <ListaVehiculos vehiculos={vehiculos} />

      <Tarjeta titulo={`Fotos y documentos (${espaciosLlenos(existentes, pendientes)} de ${TOTAL_FOTOS})`}>
        <FotosPorTipo
          existentes={existentes}
          pendientes={pendientes}
          alElegir={(clave, archivo) => setPendientes((p) => ({ ...p, [clave]: archivo }))}
          alQuitarPendiente={(clave) =>
            setPendientes((p) => {
              const resto = { ...p };
              delete resto[clave];
              return resto;
            })
          }
          alQuitarExistente={quitarExistente}
        />
        <p className="mt-3 text-sm text-tenue">Cada foto se sube por separado y se comprime a unos 120 KB. Para cambiar una, quítala y toma otra.</p>
      </Tarjeta>

      {cliente && <ContratosFirmados cliente={cliente} actuales={actuales ?? []} />}

      {vehiculos.items.some((x) => Object.keys(x.errores).length > 0) && <Aviso tipo="error">Revisa los datos del vehículo y del cronograma.</Aviso>}

      <BotonesGuardar
        editando={!!cliente}
        conVenta={vehiculos.alguno}
        guardando={guardando}
        alCancelar={() => router.back()}
        alGuardarSolo={(e) => guardar(e, "solo")}
      />
    </form>
  );
}

interface PropsBotones {
  editando: boolean;
  conVenta: boolean;
  guardando: "" | "solo" | "contrato";
  alCancelar: () => void;
  alGuardarSolo: (e: { preventDefault: () => void }) => void;
}

/** Al crear: guardar (con su moto y cronograma) o guardar y pasar a llenar el contrato. El botón principal envía el formulario. */
function BotonesGuardar({ editando, conVenta, guardando, alCancelar, alGuardarSolo }: PropsBotones) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Boton variante="secundario" tamano="grande" onClick={alCancelar}>
        Cancelar
      </Boton>
      {editando ? (
        <Boton type="submit" tamano="grande" cargando={guardando === "solo"}>
          Guardar cambios
        </Boton>
      ) : (
        <>
          <Boton variante="secundario" tamano="grande" cargando={guardando === "solo"} onClick={alGuardarSolo}>
            {conVenta ? "Guardar cliente" : "Guardar sin vehículo"}
          </Boton>
          <Boton type="submit" tamano="grande" cargando={guardando === "contrato"}>
            {conVenta ? "Guardar y llenar el contrato →" : "Siguiente: vehículo, placa y contrato →"}
          </Boton>
        </>
      )}
    </div>
  );
}

/** Al editar: el contrato firmado de cada vehículo, junto a las fotos. */
function ContratosFirmados({ cliente, actuales }: { cliente: Cliente; actuales: VentaActual[] }) {
  const { empresas } = useSesion();
  return actuales.map(
    (a) =>
      a.contrato && (
        <TarjetaContratoFirmado
          key={a.contrato.id}
          contrato={a.contrato}
          cliente={cliente}
          moto={a.moto}
          empresa={empresas.find((x) => x.id === a.contrato?.empresa_id) ?? null}
        />
      ),
  );
}

/** Un formulario por vehículo (cada uno con su cronograma) y el botón para registrar otro. */
function ListaVehiculos({ vehiculos }: { vehiculos: ReturnType<typeof useVehiculos> }) {
  return (
    <>
      {vehiculos.items.map((x, n) => (
        <MotoYCronograma
          key={x.clave}
          titulo={vehiculos.items.length > 1 ? `Vehículo ${n + 1}` : "Vehículo"}
          activa={x.actual || n > 0 ? null : x.activo}
          alActivar={(a) => vehiculos.activar(x.clave, a)}
          alQuitar={!x.actual && n > 0 ? () => vehiculos.quitar(x.clave) : undefined}
          v={x.v}
          errores={x.errores}
          conContrato={!!x.actual?.contrato}
          alCambiar={(cambio) => vehiculos.cambiar(x.clave, cambio)}
        />
      ))}
      {vehiculos.alguno && (
        <Boton variante="secundario" className="self-start" onClick={vehiculos.agregar}>
          + Registrar otro vehículo
        </Boton>
      )}
    </>
  );
}

/** Cuántos espacios de foto ya tienen algo (los de "varios" cuentan una vez). */
function espaciosLlenos(existentes: Documento[], pendientes: Record<string, File>): number {
  const tipos = new Set<string>([...existentes.map((d) => d.tipo), ...Object.keys(pendientes).map(tipoDeClave)]);
  return GRUPOS_FOTOS.reduce((n, g) => n + g.espacios.filter((e) => tipos.has(e.tipo)).length, 0);
}
