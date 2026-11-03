"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { Aviso, Boton, Campo, Cargando, Selector, Tarjeta, TituloPagina, formatoFecha, formatoSoles, hoyLima, mensajeDeError, sumarDias, useCarga, Placa, textoDocumento, nombreCuota } from "@/components/ui";
import type { Frecuencia, Moto } from "@/types/database";
import { fechaCuota } from "@/lib/supabase/reglas";
import { claveBusqueda, coincide, normalizar } from "../../clientes/_componentes/buscar";
import { FormMoto } from "../_componentes/FormMoto";

export default function NuevoContrato() {
  const { datos } = useSesion();
  const router = useRouter();
  const clienteInicial = useSearchParams().get("cliente");

  const { datos: info, cargando, recargar } = useCarga(async () => {
    const [clientes, motos, contratos] = await Promise.all([datos.clientes(), datos.motos(), datos.contratos()]);
    const ocupadas = new Set(contratos.filter((c) => c.estado === "activo").map((c) => c.moto_id));
    return { clientes, motos: motos.filter((m) => !ocupadas.has(m.id)) };
  }, [datos]);

  const [clienteId, setClienteId] = useState<string | null>(clienteInicial);
  const [busca, setBusca] = useState("");
  const [motoId, setMotoId] = useState<string | null>(null);
  const [motoNueva, setMotoNueva] = useState(false);
  const [frecuencia, setFrecuencia] = useState<Frecuencia>("semanal");
  const [cuota, setCuota] = useState("");
  const [nroCuotas, setNroCuotas] = useState("52");
  const [inicio, setInicio] = useState(() => sumarDias(hoyLima(), 7));
  const [precio, setPrecio] = useState("");
  const [inicial, setInicial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  const cliente = info?.clientes.find((c) => c.id === clienteId) ?? null;
  const indice = useMemo(() => (info?.clientes ?? []).map((c) => ({ c, clave: claveBusqueda(c.nombres, c.dni) })), [info]);
  const coincidencias = useMemo(() => {
    const q = normalizar(busca);
    if (!q) return [];
    return indice.filter((i) => coincide(i.clave, q)).slice(0, 8).map((i) => i.c);
  }, [busca, indice]);

  // motos libres: primero las de este cliente, luego las que no tienen dueño
  const motosLibres = useMemo(
    () => (info?.motos ?? []).filter((m) => m.cliente_id === clienteId || m.cliente_id === null).sort((a, b) => Number(b.cliente_id === clienteId) - Number(a.cliente_id === clienteId)),
    [info, clienteId],
  );

  const montoCuota = Number(cuota);
  const n = Number(nroCuotas);
  const valido = montoCuota > 0 && Number.isInteger(n) && n > 0;

  const crear = async () => {
    const e: Record<string, string> = {};
    if (!clienteId) e.cliente = "Elige el cliente.";
    if (!motoId) e.moto = "Elige o registra la moto.";
    if (!(montoCuota > 0)) e.cuota = "Escribe el monto de la cuota.";
    if (!Number.isInteger(n) || n <= 0 || n > 260) e.nro = "Número de cuotas entre 1 y 260.";
    if (!inicio) e.inicio = "Elige la fecha de la primera cuota.";
    if (precio && !(Number(precio) >= 0)) e.precio = "Escribe un monto válido.";
    if (inicial && !(Number(inicial) >= 0)) e.inicial = "Escribe un monto válido.";
    setErrores(e);
    if (Object.keys(e).length || !clienteId || !motoId) return;
    setGuardando(true);
    setError(null);
    try {
      const id = await datos.crearContrato({
        cliente_id: clienteId,
        moto_id: motoId,
        monto_cuota: montoCuota,
        nro_cuotas: n,
        fecha_inicio: inicio,
        precio_total: precio ? Number(precio) : null,
        inicial: inicial ? Number(inicial) : null,
        frecuencia,
      });
      router.push(`/contratos/ver?id=${id}&nuevo=1`);
    } catch (err) {
      setError(mensajeDeError(err));
      setGuardando(false);
    }
  };

  const alGuardarMoto = (m: Moto) => {
    setMotoNueva(false);
    setMotoId(m.id);
    recargar();
  };

  if (cargando && !info) return <Cargando />;

  return (
    <>
      <TituloPagina titulo="Nuevo contrato" sub="Paso 2 de 2: la moto y las cuotas. Las cuotas se crean solas." />
      {error && (
        <div className="mb-4">
          <Aviso tipo="error">{error}</Aviso>
        </div>
      )}
      <div className="flex flex-col gap-4">
        <Tarjeta titulo="1. Cliente">
          {cliente ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-marca-suave p-4">
              <div>
                <p className="text-lg font-bold">{cliente.nombres}</p>
                <p className="text-tenue">{textoDocumento(cliente.dni)}</p>
              </div>
              <Boton variante="secundario" tamano="chico" onClick={() => { setClienteId(null); setMotoId(null); }}>
                Cambiar
              </Boton>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Campo etiqueta="Buscar cliente por nombre o DNI" value={busca} onChange={(e) => setBusca(e.target.value)} error={errores.cliente} autoFocus />
              <ul className="flex flex-col gap-1">
                {coincidencias.map((c) => (
                  <li key={c.id}>
                    <button onClick={() => setClienteId(c.id)} className="flex min-h-12 w-full items-center justify-between rounded-xl border border-borde px-4 text-left hover:border-marca">
                      <span className="font-semibold">{c.nombres}</span>
                      <span className="num text-tenue">{c.dni}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Tarjeta>

        <Tarjeta titulo="2. Moto">
          {errores.moto && <p className="mb-2 text-sm font-semibold text-rojo">{errores.moto}</p>}
          {motoNueva ? (
            <FormMoto clienteId={clienteId} empresaInicial={cliente?.empresa_id} alGuardar={alGuardarMoto} alCancelar={() => setMotoNueva(false)} />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {motosLibres.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMotoId(m.id)}
                  aria-pressed={motoId === m.id}
                  className={`rounded-xl border-2 p-3 text-left ${motoId === m.id ? "border-marca bg-marca-suave" : "border-borde hover:border-marca"}`}
                >
                  <Placa placa={m.placa} />
                  <p className="text-sm text-tenue">
                    {m.tipo} · {m.marca} · {m.color}
                  </p>
                </button>
              ))}
              <button onClick={() => setMotoNueva(true)} className="min-h-20 rounded-xl border-2 border-dashed border-marca p-3 font-semibold text-marca hover:bg-marca-suave">
                + Registrar moto nueva
              </button>
            </div>
          )}
        </Tarjeta>

        <Tarjeta titulo="3. Cuotas">
          <div className="grid gap-4 sm:grid-cols-4">
            <Selector
              etiqueta="Se paga"
              value={frecuencia}
              onChange={(e) => setFrecuencia(e.target.value as Frecuencia)}
              opciones={[
                { valor: "semanal", texto: "Cada semana" },
                { valor: "quincenal", texto: "Cada quincena" },
                { valor: "mensual", texto: "Cada mes" },
              ]}
            />
            <Campo etiqueta={`${nombreCuota(frecuencia)} (S/)`} type="number" inputMode="decimal" min="0" step="0.01" value={cuota} onChange={(e) => setCuota(e.target.value)} error={errores.cuota} obligatorio />
            <Campo etiqueta="Número de cuotas" type="number" inputMode="numeric" min="1" value={nroCuotas} onChange={(e) => setNroCuotas(e.target.value)} error={errores.nro} obligatorio />
            <Campo etiqueta="Fecha de la 1.ª cuota" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} error={errores.inicio} obligatorio />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Campo etiqueta="Precio de la moto (S/)" type="number" inputMode="decimal" min="0" step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} error={errores.precio} ayuda="Opcional" />
            <Campo etiqueta="Inicial entregada (S/)" type="number" inputMode="decimal" min="0" step="0.01" value={inicial} onChange={(e) => setInicial(e.target.value)} error={errores.inicial} ayuda="Opcional" />
          </div>
          {valido && inicio && (
            <p className="mt-4 rounded-xl bg-fondo p-4">
              {n} cuotas de <b>{formatoSoles(montoCuota)}</b> { { semanal: "cada semana", quincenal: "cada quincena", mensual: "cada mes" }[frecuencia] }, del <b>{formatoFecha(inicio)}</b> al <b>{formatoFecha(fechaCuota(inicio, n - 1, frecuencia))}</b>. Total{" "}
              <b>{formatoSoles(montoCuota * n)}</b>.
            </p>
          )}
        </Tarjeta>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton variante="secundario" tamano="grande" onClick={() => router.back()}>
            Cancelar
          </Boton>
          <Boton tamano="grande" onClick={crear} cargando={guardando} disabled={motoNueva}>
            Crear contrato y cronograma
          </Boton>
        </div>
      </div>
    </>
  );
}
