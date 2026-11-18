"use client";
import { opcionesDeCuenta } from "@/lib/cuentas";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { useEmpresa } from "@/components/layout/empresa";
import { DIAS_ATRAS_TRABAJADOR, sumarDias } from "@/lib/supabase/reglas";
import { Aviso, Boton, Campo, Cargando, NOMBRE_MEDIO, OpcionesBoton, Selector, Tarjeta, TituloPagina, formatoSoles, hoyLima, mensajeDeError, useCarga } from "@/components/ui";
import { borrarFoto, prepararFotoPago } from "@/lib/fotos";
import type { MedioPago, RegistrarPagoResultado } from "@/types/database";
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
    const [estados, cuentas] = await Promise.all([datos.estadoClientes(), datos.cuentas()]);
    return { estados, cuentas };
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
  if (!elegido) return <BuscarContrato estados={info?.estados ?? []} alElegir={elegirContrato} />;

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
                ayuda={`Después de las 10:00 p.m. cuenta para el día siguiente.${esAdmin ? "" : ` Hasta ${DIAS_ATRAS_TRABAJADOR} días atrás; más antiguo, pídeselo a un administrador.`}`}
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
