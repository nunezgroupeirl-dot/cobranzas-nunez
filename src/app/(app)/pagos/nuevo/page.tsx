"use client";
import { opcionesDeCuenta } from "@/lib/cuentas";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { useEmpresa } from "@/components/layout/empresa";
import { DIAS_ATRAS_TRABAJADOR, sumarDias } from "@/lib/supabase/reglas";
import { Aviso, Boton, Campo, Cargando, EtiquetaSemaforo, NOMBRE_MEDIO, OpcionesBoton, Placa, Selector, Tarjeta, TituloPagina, formatoSoles, hoyLima, mensajeDeError, useCarga } from "@/components/ui";
import { borrarFoto, prepararFotoPago } from "@/lib/fotos";
import type { Contrato, EstadoCliente, MedioPago, RegistrarPagoResultado } from "@/types/database";
import { BuscarContrato } from "../_componentes/BuscarContrato";
import { FotoComprobante } from "../_componentes/FotoComprobante";
import { PagoRegistrado } from "../_componentes/PagoRegistrado";
import { ResumenCliente } from "../_componentes/ResumenCliente";

const MEDIOS = Object.keys(NOMBRE_MEDIO) as MedioPago[];
/** "Otra entidad": transferencia desde un banco o billetera que no está entre las cuentas (Lemon, Scotiabank…). Se guarda como banco. */
const OTRA = "otra";
const OPCIONES_MEDIO = [...MEDIOS.map((m) => ({ valor: m as string, texto: NOMBRE_MEDIO[m] })), { valor: OTRA, texto: "Otra entidad" }];
const ENTIDADES_OTRAS = ["Lemon", "Scotiabank", "BBVA", "Interbank", "BCP", "Banco de la Nación", "Caja Huancayo", "Caja Arequipa", "Agora", "Tunki"];

interface Borrador {
  monto: string;
  fecha: string;
  medio: MedioPago;
  cuentaId: string;
  nroOp: string;
  foto: File | null;
  /** solo con "Otra entidad" */
  otra: boolean;
  entidad: string;
}

/** Revisa el formulario antes de subir nada. Devuelve los errores por campo (vacío = todo bien). */
function validar(b: Borrador, minimo: string): Record<string, string> {
  const e: Record<string, string> = {};
  const conCuenta = b.medio !== "efectivo";
  if (!(Number(b.monto) > 0)) e.monto = "Escribe el monto.";
  if (!b.fecha) e.fecha = "Elige la fecha.";
  else if (b.fecha > hoyLima()) e.fecha = "La fecha no puede ser futura.";
  else if (minimo && b.fecha < minimo) e.fecha = `Solo un administrador puede registrar pagos de hace más de ${DIAS_ATRAS_TRABAJADOR} días.`;
  if (b.otra && !b.entidad.trim()) e.entidad = "Escribe de qué entidad hizo el pago (Lemon, Scotiabank…).";
  if (conCuenta && !b.cuentaId) e.cuenta = "Elige la cuenta donde llegó el dinero.";
  if (conCuenta && !b.nroOp.trim()) e.nro = "Escribe el número de operación.";
  if (!b.foto) e.foto = b.medio === "efectivo" ? "Tómale una foto al cliente al recibir el dinero." : "La foto del comprobante es obligatoria.";
  return e;
}

const textoBoton = (paso: string, monto: string) =>
  paso === "foto" ? "Subiendo foto…" : paso === "guardando" ? "Guardando…" : `Registrar ${monto ? formatoSoles(Number(monto)) : "pago"}`;

export default function RegistrarPago() {
  const { datos, empresas, esAdmin } = useSesion();
  const minimo = esAdmin ? "" : sumarDias(hoyLima(), -DIAS_ATRAS_TRABAJADOR);
  const router = useRouter();
  const contratoParam = useSearchParams().get("contrato");
  const empresa = useEmpresa();

  const { datos: info, cargando, recargar } = useCarga(async () => {
    const [estados, cuentas, contratos, motos] = await Promise.all([datos.estadoClientes(), datos.cuentas(), datos.contratos(), datos.motos()]);
    // cliente con varios vehículos: "Vehículo 1, 2…" en el orden en que se registraron (como en su ficha)
    const motoPorId = new Map(motos.map((m) => [m.id, m]));
    const vehiculos = new Map<string, { numero: number; total: number; descripcion: string }>();
    const porCliente = new Map<string, Contrato[]>();
    for (const c of contratos.filter((x) => x.estado === "activo").sort((a, b) => a.creado_en.localeCompare(b.creado_en)))
      porCliente.set(c.cliente_id, [...(porCliente.get(c.cliente_id) ?? []), c]);
    for (const lista of porCliente.values())
      lista.forEach((c, i) => {
        const m = motoPorId.get(c.moto_id);
        vehiculos.set(c.id, { numero: i + 1, total: lista.length, descripcion: [m?.tipo, m?.marca].filter(Boolean).join(" ") });
      });
    return { estados, cuentas, vehiculos };
  }, [datos]);

  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(hoyLima);
  // lo elegido en los botones: un medio, o "otra" (entidad que no está registrada: se guarda como banco)
  const [eleccion, setEleccion] = useState<string>("yape");
  const otra = eleccion === OTRA;
  const medio: MedioPago = otra ? "banco" : (eleccion as MedioPago);
  const [entidad, setEntidad] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [nroOp, setNroOp] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [paso, setPaso] = useState<"" | "foto" | "guardando">("");
  const [resultado, setResultado] = useState<(RegistrarPagoResultado & { monto: number }) | null>(null);
  const enviando = useRef(false);

  const elegido = useMemo(() => info?.estados.find((e) => e.contrato_id === contratoParam) ?? null, [info, contratoParam]);
  const nombresEmpresa = useMemo(() => new Map(empresas.map((e) => [e.id, e.nombre])), [empresas]);

  // Andrés recibe en cualquiera de sus cuentas: se muestran todas las del medio elegido,
  // primero las de la empresa del cliente. Un depósito en agente llega a una cuenta de banco.
  const cuentasMedio = useMemo(
    () => (info?.cuentas ?? []).filter((c) => c.medio === medio || (medio === "agente" && c.medio === "banco")),
    [info, medio],
  );

  // elegir automáticamente la cuenta si solo hay una
  useEffect(() => {
    if (cuentasMedio.length === 1) setCuentaId(cuentasMedio[0].id);
    else if (!cuentasMedio.some((c) => c.id === cuentaId)) setCuentaId("");
  }, [cuentasMedio, cuentaId]);

  const elegirContrato = (id: string) => router.replace(`/pagos/nuevo?contrato=${id}${empresa ? `&empresa=${empresa}` : ""}`);

  const cambiarFoto = (f: File | null) => {
    setFoto(f);
    if (f) setErrores((e) => ({ ...e, foto: "" }));
  };

  const limpiar = () => {
    setMonto("");
    setNroOp("");
    setEntidad("");
    setFoto(null);
    setFecha(hoyLima());
    setErrores({});
    setError(null);
    setResultado(null);
    recargar();
  };

  const registrar = async () => {
    if (!elegido || enviando.current) return;
    const e = validar({ monto, fecha, medio, cuentaId, nroOp, foto, otra, entidad }, minimo);
    setErrores(e);
    if (Object.keys(e).length || !foto) return;

    enviando.current = true;
    setError(null);
    const efectivo = medio === "efectivo";
    let ruta: string | null = null;
    try {
      setPaso("foto");
      const subida = await prepararFotoPago(datos, elegido.empresa_id, elegido.cliente_id, foto);
      ruta = subida.ruta;
      setPaso("guardando");
      const r = await datos.registrarPago({
        contrato_id: elegido.contrato_id,
        monto: Number(monto),
        fecha_pago: fecha,
        medio,
        cuenta_id: efectivo ? null : cuentaId,
        nro_operacion: efectivo ? null : nroOp.trim(),
        foto_ruta: subida.ruta,
        foto_hash: subida.hash,
        entidad_origen: otra ? entidad.trim() : null,
      });
      setResultado({ ...r, monto: Number(monto) });
    } catch (err) {
      if (ruta) await borrarFoto(datos, "evidencias", ruta); // si la base rechaza, la foto no se queda
      setError(mensajeDeError(err));
    } finally {
      setPaso("");
      enviando.current = false;
    }
  };

  if (cargando && !info) return <Cargando variante="formulario" />;
  if (!elegido) return <BuscarContrato estados={info?.estados ?? []} vehiculos={info?.vehiculos} alElegir={elegirContrato} />;

  if (resultado) {
    return (
      <PagoRegistrado
        monto={resultado.monto}
        cuotasCubiertas={resultado.cuotas_cubiertas}
        cliente={elegido.cliente}
        clienteId={elegido.cliente_id}
        alOtroPago={limpiar}
        alOtroCliente={() => {
          limpiar();
          router.replace("/pagos/nuevo");
        }}
      />
    );
  }

  // primero las de la empresa del cliente, luego los Yape/Plin personales y al final las de otras empresas
  const opcionesCuenta = opcionesDeCuenta(cuentasMedio, elegido.empresa_id, nombresEmpresa);

  return (
    <>
      <TituloPagina titulo="Registrar pago" />
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-4">
          <ElegirVehiculo
            actual={elegido}
            delCliente={(info?.estados ?? []).filter((e) => e.cliente_id === elegido.cliente_id)}
            vehiculos={info?.vehiculos}
            alElegir={elegirContrato}
          />
          {error && <Aviso tipo="error">{error}</Aviso>}
          <Tarjeta>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Campo
                  etiqueta="Monto (S/)"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  error={errores.monto}
                  obligatorio
                  className="num text-2xl font-bold"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Boton variante="secundario" tamano="chico" onClick={() => setMonto(String(elegido.cuota))}>
                    1 cuota · {formatoSoles(elegido.cuota)}
                  </Boton>
                  {elegido.deuda > 0 && (
                    <Boton variante="secundario" tamano="chico" onClick={() => setMonto(String(elegido.deuda))}>
                      Todo lo vencido · {formatoSoles(elegido.deuda)}
                    </Boton>
                  )}
                </div>
              </div>
              <div className="sm:col-span-2">
                <OpcionesBoton
                  etiqueta="Medio de pago"
                  opciones={OPCIONES_MEDIO}
                  valor={eleccion}
                  alCambiar={(v) => {
                    // efectivo pide foto del cliente y los demás una captura: al cambiar entre ellos se vuelve a pedir la foto
                    if ((v === "efectivo") !== (medio === "efectivo")) cambiarFoto(null);
                    setEleccion(v);
                  }}
                  obligatorio
                />
              </div>
              {otra && (
                <div className="sm:col-span-2">
                  <Campo
                    etiqueta="¿De qué entidad pagó?"
                    value={entidad}
                    onChange={(e) => setEntidad(e.target.value)}
                    list="entidades-otras"
                    maxLength={60}
                    error={errores.entidad}
                    placeholder="Ej.: Lemon, Scotiabank"
                    ayuda="El banco o la billetera desde donde hizo la transferencia. Abajo elige la cuenta donde llegó el dinero."
                    obligatorio
                  />
                  <datalist id="entidades-otras">
                    {ENTIDADES_OTRAS.map((x) => (
                      <option key={x} value={x} />
                    ))}
                  </datalist>
                </div>
              )}
              {medio !== "efectivo" && (
                <>
                  <Selector
                    etiqueta="Cuenta destino"
                    opciones={opcionesCuenta}
                    value={cuentaId}
                    onChange={(e) => setCuentaId(e.target.value)}
                    error={errores.cuenta}
                    ayuda={cuentasMedio.length === 0 ? "No hay cuentas de este medio. El administrador las agrega en Configuración." : undefined}
                    obligatorio
                    vacio="Elige…"
                  />
                  <Campo
                    etiqueta="N.º de operación"
                    inputMode="numeric"
                    value={nroOp}
                    onChange={(e) => setNroOp(e.target.value.trim())}
                    error={errores.nro}
                    obligatorio
                    className="num font-semibold"
                    autoComplete="off"
                  />
                </>
              )}
              <Campo
                etiqueta="Fecha en que pagó"
                type="date"
                max={hoyLima()}
                min={minimo || undefined}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                error={errores.fecha}
                obligatorio
                ayuda={`Después de medianoche (12:00 a.m.) cuenta para el día siguiente.${esAdmin ? "" : ` Hasta ${DIAS_ATRAS_TRABAJADOR} días atrás; más antiguo, pídeselo a un administrador.`}`}
              />
            </div>
          </Tarjeta>
          <FotoComprobante foto={foto} medio={medio} error={errores.foto} alCambiar={cambiarFoto} />
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <ResumenCliente estado={elegido} alCambiar={() => router.replace("/pagos/nuevo")} />
          <Boton tamano="grande" ancho onClick={registrar} cargando={paso !== ""}>
            {textoBoton(paso, monto)}
          </Boton>
          <p className="text-center text-sm text-tenue">El sistema aplica el pago a la cuota pendiente más antigua.</p>
        </aside>
      </div>
    </>
  );
}

/**
 * Cliente con varios vehículos: de cuál es este pago. Cada uno con su placa (o "en trámite"), su cuota y lo que debe;
 * el elegido queda marcado y el pago va a su cronograma.
 */
function ElegirVehiculo({
  actual,
  delCliente,
  vehiculos,
  alElegir,
}: {
  actual: EstadoCliente;
  delCliente: EstadoCliente[];
  vehiculos?: Map<string, { numero: number; total: number; descripcion: string }>;
  alElegir: (contratoId: string) => void;
}) {
  if (delCliente.length < 2) return null;
  const orden = [...delCliente].sort((a, b) => (vehiculos?.get(a.contrato_id)?.numero ?? 0) - (vehiculos?.get(b.contrato_id)?.numero ?? 0));
  return (
    <section className="rounded-2xl border-2 border-marca bg-marca-suave/50 p-4" aria-label="Vehículo del pago">
      <p className="font-bold">¿De qué vehículo es este pago?</p>
      <p className="mb-3 text-sm text-tenue">{actual.cliente.split(" ")[0]} tiene {delCliente.length} vehículos. Cada uno tiene su propio cronograma.</p>
      <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
        {orden.map((e) => {
          const v = vehiculos?.get(e.contrato_id);
          const elegido = e.contrato_id === actual.contrato_id;
          return (
            <button
              key={e.contrato_id}
              type="button"
              role="radio"
              aria-checked={elegido}
              onClick={() => !elegido && alElegir(e.contrato_id)}
              className={`flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left ${elegido ? "border-marca bg-superficie ring-3 ring-marca/25" : "border-borde bg-superficie hover:border-marca/60"}`}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="font-bold">
                  {elegido ? "● " : "○ "}Vehículo {v?.numero ?? ""}
                </span>
                <EtiquetaSemaforo color={e.color} semanas={e.semanas_atraso} />
              </span>
              <span className="flex flex-wrap items-center gap-2 text-sm">
                <Placa placa={e.placa} tamano="chico" />
                {v?.descripcion && <span className="text-tenue">{v.descripcion}</span>}
              </span>
              <span className="text-sm">
                Cuota <b className="num">{formatoSoles(e.cuota)}</b>
                {e.deuda > 0 && (
                  <>
                    {" "}
                    · debe <b className="num text-rojo">{formatoSoles(e.deuda)}</b>
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
