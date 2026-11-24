"use client";
import { CELULAR_2_VALIDO, limpiarCelular2 } from "@/lib/telefono";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { useEmpresa } from "@/components/layout/empresa";
import { AreaTexto, Aviso, Boton, Campo, NOMBRE_DOCUMENTO, Selector, DOCUMENTOS, TIPOS_DOC, Tarjeta, esDocumentoValido, limpiarDocumento, mensajeDeError } from "@/components/ui";
import { borrarFoto, prepararFotoPago, sha256, subirDocumento } from "@/lib/fotos";
import { fechaCuota } from "@/lib/supabase/reglas";
import { borrarBorrador, guardarArchivosBorrador, guardarBorrador, leerArchivosBorrador, leerBorrador } from "@/lib/borrador";
import { ubicacionValida } from "@/lib/mapa";
import type { TipoDoc, Cliente, Cuenta, Documento } from "@/types/database";
import { CampoUbicacion } from "./CampoUbicacion";
import { ComprobantesPagadas } from "./ComprobantesPagadas";
import { FotosPorTipo } from "./FotosPorTipo";
import { ProgresoGuardado, type EstadoFoto, type Progreso } from "./ProgresoGuardado";
import { MotoYCronograma } from "./MotoYCronograma";
import { GRUPOS_FOTOS, GRUPO_VEHICULO, TIPOS_VEHICULO, TOTAL_FOTOS, tipoDeClave, vehiculoDeClave } from "./secciones";
import { TarjetaContratoFirmado } from "../../contratos/_componentes/TarjetaContratoFirmado";
import { useVehiculos, type ItemVehiculo } from "./useVehiculos";
import { cuotasPorComprobar, type VentaActual } from "./venta";


/** Datos del cliente, sus vehículos (cada uno con su cronograma), sus fotos y sus contratos firmados, en ese orden. */
export function FormCliente({ cliente, actuales }: { cliente?: Cliente; actuales?: VentaActual[] }) {
  const { datos, empresas } = useSesion();
  // cuentas activas: para los comprobantes de cuotas ya pagadas
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  useEffect(() => {
    datos
      .cuentas()
      .then(setCuentas)
      .catch(() => undefined);
  }, [datos]);
  const empresaFiltro = useEmpresa();
  const router = useRouter();

  const [f, setF] = useState({
    nombres: cliente?.nombres ?? "",
    // el tipo se elige antes del número; los antiguos sin tipo se deducen del largo
    tipo_doc: (cliente?.tipo_doc ?? (cliente?.dni ? (cliente.dni.length === 8 ? "DNI" : "CE") : "")) as "" | TipoDoc,
    dni: cliente?.dni ?? "",
    celular: cliente?.celular ?? "",
    celular2: cliente?.celular2 ?? "",
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
  // las fotos nuevas (del cliente y de cada vehículo): se suben al guardar. Clave: ver tipoDeClave y vehiculoDeClave
  const [pendientes, setPendientes] = useState<Record<string, File>>({});
  const sinPendiente = (clave: string) =>
    setPendientes((p) => {
      const resto = { ...p };
      delete resto[clave];
      return resto;
    });

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
    // fotos del vehículo de un borrador de antes (sin vehículo): pasan al primer vehículo
    const primero = b?.items?.[0]?.clave ?? vehiculos.items[0]?.clave;
    leerArchivosBorrador(claveBorrador)
      .then((a) => {
        if (Object.keys(a).length) {
          setPendientes(
            Object.fromEntries(Object.entries(a).map(([k, archivo]) => [!vehiculoDeClave(k) && TIPOS_VEHICULO.has(tipoDeClave(k)) && primero ? `${primero}|${k}` : k, archivo])),
          );
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
    if (f.celular2 && !CELULAR_2_VALIDO.test(f.celular2))
      e.celular2 = f.celular2.startsWith("+") ? "Revisa el número: el código del país y el número completo (ej.: +58 4121234567)." : "Escribe 9 números (Perú) o, si es de otro país, empieza con + y su código.";
    else if (f.celular2 && f.celular2 === f.celular) e.celular2 = "Es el mismo número de arriba.";
    if (!f.empresa_id) e.empresa_id = "Elige la empresa.";
    if (!ubicacionValida(f.ubicacion)) e.ubicacion = "Pega un enlace de Google Maps o coordenadas como -12.0464,-77.0428.";
    setErrores(e);
    // los comprobantes de cuotas pagadas piden su foto, y no puede ser la misma en dos cuotas
    const vehiculosOk = vehiculos.validar((id) => !!pendientes[COMP + id], repetidaDe);
    return Object.keys(e).length === 0 && vehiculosOk;
  };

  const quitarExistente = async (d: Documento) => {
    if (!confirm(`¿Quitar "${NOMBRE_DOCUMENTO[d.tipo]}"?`)) return;
    await datos.borrarDocumento(d.id); // también borra el archivo guardado
    setExistentes((x) => x.filter((y) => y.id !== d.id));
  };

  // la ventana que muestra el avance del guardado (pasos y fotos); null = cerrada
  const [progreso, setProgreso] = useState<Progreso | null>(null);
  const avanzar = (cambio: Partial<Progreso>) => setProgreso((p) => (p ? { ...p, ...cambio } : p));
  const estadoFoto = (clave: string, estado: EstadoFoto) =>
    setProgreso((p) => (p ? { ...p, fotos: p.fotos.map((x) => (x.clave === clave ? { ...x, estado } : x)) } : p));

  const ultimo = useRef<"solo" | "contrato">("contrato"); // para "Reintentar"
  const compHechos = useRef(new Set<string>()); // comprobantes ya registrados (no se repiten al reintentar)
  // huella (SHA-256) de la captura de cada comprobante de cuota pagada
  const [huellas, setHuellas] = useState<Record<string, string>>({});
  /** Si la captura de ese comprobante es igual a la de otro (con foto puesta): el número de esa otra cuota. */
  const repetidaDe = (id: string): number | null => {
    const h = huellas[id];
    if (!h || !pendientes[COMP + id]) return null;
    const cuota = (k: string) => Number(/-cuota-(\d+)$/.exec(k)?.[1] ?? 0);
    // la que se repite es la de número mayor: avisa cuál cuota ya tiene esa captura
    const otro = Object.keys(huellas).find((k) => k !== id && huellas[k] === h && pendientes[COMP + k] && cuota(k) < cuota(id));
    return otro ? cuota(otro) || null : null;
  };
  // capturas que vienen del borrador: también se les saca la huella
  useEffect(() => {
    for (const [k, archivo] of Object.entries(pendientes))
      if (k.startsWith(COMP) && !huellas[k.slice(COMP.length)])
        void sha256(archivo).then((h) => setHuellas((x) => ({ ...x, [k.slice(COMP.length)]: h })));
  }, [pendientes, huellas]);
  const guardar = async (e: { preventDefault: () => void } | null, despues: "solo" | "contrato") => {
    e?.preventDefault();
    if (!validar()) return;
    ultimo.current = despues;
    // un préstamo no tiene contrato en papel: si lo primero que se registra es un préstamo, se va a la ficha, no al contrato
    const primeraNueva = vehiculos.items.find((x) => x.activo && !x.actual);
    const primerEsPrestamo = primeraNueva?.v.es_prestamo ?? false;
    const destino = despues === "contrato" && !cliente && !primerEsPrestamo ? "contrato" : "ficha";
    const activos = new Set(vehiculos.items.filter((x) => x.activo).map((x) => x.clave));
    // las fotos que se van a subir: las del cliente y las de cada vehículo que se registra
    const entradas = Object.entries(pendientes).filter(([clave]) => {
      if (clave.startsWith(COMP)) return false; // las fotos de comprobantes van con su pago (abajo)
      const veh = vehiculoDeClave(clave);
      return !veh || activos.has(veh);
    });
    // los comprobantes de cuotas pagadas que faltan registrar (de cada vehículo que se guarda)
    const porRegistrar = vehiculos.items
      .filter((x) => x.activo)
      .flatMap((x) => {
        const faltan = cuotasPorComprobar(x.v, x.actual?.contrato?.cuotas_pagadas_inicial ?? 0);
        return x.v.comprobantes
          .filter((c) => !compHechos.current.has(c.id) && c.cuotas.some((n) => faltan.includes(n)))
          .map((c) => ({ clave: x.clave, empresa: x.v.empresa_id || f.empresa_id, c: { ...c, cuotas: c.cuotas.filter((n) => faltan.includes(n)) } }));
      });
    setGuardando(despues);
    setError(null);
    setProgreso({
      nombre: f.nombres.trim().split(/\s+/).slice(0, 2).join(" "),
      editando: !!cliente,
      conVehiculo: activos.size > 0,
      destino,
      paso: 0,
      fotos: entradas.map(([clave, archivo]) => ({ clave, archivo, estado: "espera" })),
      comprobantes: { total: porRegistrar.length, listos: 0 },
      error: null,
    });
    try {
      const guardado = await datos.guardarCliente({
        id: cliente?.id ?? hechos.current.cliente?.id,
        empresa_id: f.empresa_id,
        nombres: f.nombres.trim(),
        dni: f.dni || null,
        tipo_doc: f.tipo_doc || null,
        celular: f.celular || null,
        celular2: f.celular2 || null,
        direccion: f.direccion.trim() || null,
        referencia: f.referencia.trim() || null,
        recomendado_por: f.recomendado_por.trim() || null,
        ubicacion: f.ubicacion.trim() || null,
      });
      hechos.current.cliente = guardado; // al reintentar se actualiza este mismo cliente (no se crea otro)
      avanzar({ paso: 1 });
      const primerNuevo = await vehiculos.guardarTodos(datos, guardado);
      avanzar({ paso: 2 });
      // Fotos: de 3 en 3 (con señal de celular rinde más que todas a la vez). Cada una se comprime, sube y registra
      // por su cuenta; la que sube se quita de pendientes, así al reintentar no se sube dos veces.
      const cola = [...entradas];
      let fallidas = 0;
      const trabajador = async () => {
        for (let x = cola.shift(); x; x = cola.shift()) {
          const [clave, archivo] = x;
          estadoFoto(clave, "subiendo");
          try {
            const veh = vehiculoDeClave(clave);
            const tipo = tipoDeClave(clave);
            const ruta = await subirDocumento(datos, guardado.empresa_id, guardado.id, tipo, archivo);
            await datos.agregarDocumento({ cliente_id: guardado.id, tipo, ruta, moto_id: veh ? (vehiculos.motoDe(veh) ?? null) : null });
            sinPendiente(clave);
            estadoFoto(clave, "listo");
          } catch {
            fallidas++;
            estadoFoto(clave, "error");
          }
        }
      };
      await Promise.all([trabajador(), trabajador(), trabajador()]);
      if (fallidas) throw new Error(`No se pudo subir ${fallidas === 1 ? "1 foto" : `${fallidas} fotos`}. Las demás ya quedaron guardadas.`);
      // Comprobantes de las cuotas que ya venía pagando: cada uno queda como pago anterior de esas cuotas
      // (con el control de N.º de operación y captura repetidos). Uno por uno, para decir cuál falló.
      avanzar({ paso: 3 });
      for (const [i, { clave, empresa, c }] of porRegistrar.entries()) {
        const contratoId = vehiculos.contratoDe(clave);
        const archivo = pendientes[COMP + c.id];
        if (!contratoId || !archivo) continue;
        let ruta = "";
        try {
          // react-doctor-disable-next-line async-await-in-loop
          const foto = await prepararFotoPago(datos, empresa, guardado.id, archivo);
          ruta = foto.ruta;
          // react-doctor-disable-next-line async-await-in-loop
          await datos.registrarPagoAnterior({
            contrato_id: contratoId,
            cuotas: c.cuotas,
            fecha_pago: c.fecha,
            medio: c.medio,
            cuenta_id: c.medio === "efectivo" ? null : c.cuenta_id,
            nro_operacion: c.medio === "efectivo" ? null : c.nro_operacion.trim(),
            foto_ruta: foto.ruta,
            foto_hash: foto.hash,
          });
        } catch (err) {
          if (ruta) void borrarFoto(datos, "evidencias", ruta); // la foto no quedó en ningún pago
          throw new Error(`Comprobante de la cuota ${c.cuotas.join(", ")}: ${mensajeDeError(err)}`);
        }
        compHechos.current.add(c.id); // al reintentar, este ya no se vuelve a registrar
        sinPendiente(COMP + c.id);
        avanzar({ comprobantes: { total: porRegistrar.length, listos: i + 1 } });
      }
      await borrarBorrador(claveBorrador); // ya quedó guardado de verdad
      avanzar({ paso: 4 });
      await new Promise((r) => setTimeout(r, 900)); // que se vea el check antes de cambiar de pantalla
      router.push(
        destino === "contrato"
          ? // "Guardar y llenar el contrato": directo al contrato con todo ya puesto (cliente, vehículo y cuotas)
            primerNuevo
            ? `/contratos/documento?id=${primerNuevo}`
            : `/contratos/nuevo?cliente=${guardado.id}`
          : `/clientes/ficha?id=${guardado.id}`,
      );
    } catch (err) {
      avanzar({ error: mensajeDeError(err) });
      setGuardando("");
    }
  };

  const opcionesEmpresa = useMemo(() => empresas.map((e) => ({ valor: e.id, texto: e.nombre })), [empresas]);
  const nombresEmpresa = useMemo(() => new Map(empresas.map((e) => [e.id, e.nombre])), [empresas]);
  // las fotos del vehículo se muestran dentro de cada vehículo
  const delCliente = existentes.filter((d) => !d.moto_id && !TIPOS_VEHICULO.has(d.tipo));

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
          <Campo
            etiqueta="Celular 2"
            inputMode="tel"
            maxLength={16}
            value={f.celular2}
            onChange={(e) => poner("celular2", limpiarCelular2(e.target.value))}
            error={errores.celular2}
            placeholder="Ej.: 987654321 o +58 4121234567"
            ayuda="Opcional. Puede ser de otro país: empieza con + y su código (Venezuela +58, Cuba +53, México +52, Colombia +57)."
          />
          <Selector
            etiqueta="Empresa"
            opciones={opcionesEmpresa}
            value={f.empresa_id}
            onChange={(e) => {
              vehiculos.seguirEmpresa(f.empresa_id, e.target.value); // sus vehículos de esa empresa la siguen
              poner("empresa_id", e.target.value);
            }}
            error={errores.empresa_id}
            ayuda="Cada vehículo puede ser de otra empresa: se elige en el vehículo."
            obligatorio
            vacio="Elige…"
          />
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

      <ListaVehiculos
        vehiculos={vehiculos}
        empresas={opcionesEmpresa}
        empresaCliente={f.empresa_id}
        fotosDe={(x) => {
          const prefijo = `${x.clave}|`;
          const motoId = x.actual?.moto?.id;
          return (
            <div>
              <FotosPorTipo
                grupos={[GRUPO_VEHICULO]}
                existentes={motoId ? existentes.filter((d) => d.moto_id === motoId) : []}
                pendientes={Object.fromEntries(Object.entries(pendientes).flatMap(([k, a]) => (k.startsWith(prefijo) ? [[k.slice(prefijo.length), a]] : [])))}
                alElegir={(clave, archivo) => setPendientes((p) => ({ ...p, [prefijo + clave]: archivo }))}
                alQuitarPendiente={(clave) => sinPendiente(prefijo + clave)}
                alQuitarExistente={quitarExistente}
              />
            </div>
          );
        }}
        comprobantesDe={(x) => (
          <ComprobantesPagadas
            faltan={cuotasPorComprobar(x.v, x.actual?.contrato?.cuotas_pagadas_inicial ?? 0)}
            comprobantes={x.v.comprobantes ?? []}
            alCambiar={(lista) => vehiculos.cambiar(x.clave, { comprobantes: lista })}
            archivos={Object.fromEntries((x.v.comprobantes ?? []).flatMap((c) => (pendientes[COMP + c.id] ? [[c.id, pendientes[COMP + c.id]]] : [])))}
            alElegirArchivo={(id, archivo) => {
              if (!archivo) return sinPendiente(COMP + id);
              setPendientes((p) => ({ ...p, [COMP + id]: archivo }));
              // huella de la imagen: así se nota si suben la misma captura en dos cuotas
              void sha256(archivo).then((h) => setHuellas((x) => ({ ...x, [id]: h })));
            }}
            fechaDe={(n) => (x.v.fecha_inicio ? fechaCuota(x.v.fecha_inicio, n - 1, x.v.frecuencia) : null)}
            repetidaDe={repetidaDe}
            prefijo={x.clave}
            cuentas={cuentas}
            empresaId={x.v.empresa_id || f.empresa_id}
            nombresEmpresa={nombresEmpresa}
            error={x.errores.comprobantes}
          />
        )}
        alQuitar={(clave) => {
          vehiculos.quitar(clave);
          setPendientes((p) => Object.fromEntries(Object.entries(p).filter(([k]) => vehiculoDeClave(k) !== clave)));
        }}
      />

      <Tarjeta titulo={`Fotos del cliente y documentos (${espaciosLlenos(delCliente, pendientes)} de ${TOTAL_FOTOS})`}>
        <FotosPorTipo
          existentes={delCliente}
          pendientes={Object.fromEntries(Object.entries(pendientes).filter(([k]) => !vehiculoDeClave(k)))}
          alElegir={(clave, archivo) => setPendientes((p) => ({ ...p, [clave]: archivo }))}
          alQuitarPendiente={sinPendiente}
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

      {progreso && (
        <ProgresoGuardado
          progreso={progreso}
          alReintentar={() => void guardar(null, ultimo.current)}
          alCerrar={() => {
            setError(progreso.error); // el aviso queda en el formulario
            setProgreso(null);
          }}
        />
      )}
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
function ListaVehiculos({
  vehiculos,
  empresas,
  empresaCliente,
  fotosDe,
  comprobantesDe,
  alQuitar,
}: {
  vehiculos: ReturnType<typeof useVehiculos>;
  empresas: { valor: string; texto: string }[];
  empresaCliente: string;
  fotosDe: (x: ItemVehiculo) => ReactNode;
  comprobantesDe: (x: ItemVehiculo) => ReactNode;
  alQuitar: (clave: string) => void;
}) {
  return (
    <>
      {vehiculos.items.map((x, n) => (
        <MotoYCronograma
          key={x.clave}
          titulo={vehiculos.items.length > 1 ? `Vehículo ${n + 1}` : "Vehículo"}
          activa={x.actual || n > 0 ? null : x.activo}
          alActivar={(a) => vehiculos.activar(x.clave, a)}
          alQuitar={!x.actual && n > 0 ? () => alQuitar(x.clave) : undefined}
          empresas={empresas}
          empresaCliente={empresaCliente}
          fotos={fotosDe(x)}
          comprobantes={comprobantesDe(x)}
          v={x.v}
          errores={x.errores}
          conContrato={!!x.actual?.contrato}
          alCambiar={(cambio) => vehiculos.cambiar(x.clave, cambio)}
        />
      ))}
      <div className="flex flex-wrap gap-2">
        {vehiculos.alguno && (
          <Boton variante="secundario" onClick={vehiculos.agregar}>
            + Registrar otro vehículo
          </Boton>
        )}
        <Boton variante="secundario" onClick={vehiculos.agregarPrestamo}>
          + Registrar un préstamo
        </Boton>
      </div>
    </>
  );
}

/** Cuántos espacios de foto ya tienen algo (los de "varios" cuentan una vez). */
function espaciosLlenos(existentes: Documento[], pendientes: Record<string, File>): number {
  const tipos = new Set<string>([...existentes.map((d) => d.tipo), ...Object.keys(pendientes).map(tipoDeClave)]);
  return GRUPOS_FOTOS.reduce((n, g) => n + g.espacios.filter((e) => tipos.has(e.tipo)).length, 0);
}

/** Clave de la foto de un comprobante de cuotas pagadas (va con los demás archivos del borrador, pero no como foto del cliente). */
const COMP = "comprobante:";
