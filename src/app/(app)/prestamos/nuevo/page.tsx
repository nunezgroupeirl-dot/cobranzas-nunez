"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { useEmpresa } from "@/components/layout/empresa";
import {
  Aviso,
  Boton,
  Campo,
  DOCUMENTOS,
  TIPOS_DOC,
  Selector,
  Tarjeta,
  TituloPagina,
  esDocumentoValido,
  limpiarDocumento,
  mensajeDeError,
  sumarDias,
} from "@/components/ui";
import { CELULAR_2_VALIDO, limpiarCelular2 } from "@/lib/telefono";
import { ubicacionValida } from "@/lib/mapa";
import type { Cliente, TipoDoc } from "@/types/database";
import { CamposPrestamo } from "./_componentes/CamposPrestamo";
import { prestamoVacio, validarPrestamo, type Prestamo } from "./_componentes/prestamo";

/** Dar un préstamo de dinero a un cliente (sin vehículo): se cobra por días y cuotas, igual que una venta. */
export default function NuevoPrestamo() {
  return (
    <>
      <TituloPagina titulo="Nuevo préstamo" sub="Un préstamo de dinero a un cliente, sin vehículo. Se cobra por días y cuotas, con capital e interés como una venta." />
      <FormPrestamo />
    </>
  );
}

function FormPrestamo() {
  const { datos, empresas } = useSesion();
  const empresaFiltro = useEmpresa();
  const router = useRouter();
  // si se llega desde la ficha de un cliente (?cliente=<id>), queda elegido
  const clienteParam = useSearchParams().get("cliente") ?? "";

  const [modo, setModo] = useState<"existente" | "nuevo">("existente");
  // cliente existente elegido
  const [cliente, setCliente] = useState<Cliente | null>(null);
  // datos de un cliente nuevo
  const [nuevo, setNuevo] = useState({
    nombres: "",
    tipo_doc: "" as "" | TipoDoc,
    dni: "",
    celular: "",
    celular2: "",
    direccion: "",
    referencia: "",
    recomendado_por: "",
    ubicacion: "",
  });
  const empresaInicial = empresaFiltro ?? empresas[0]?.id ?? "";
  const [empresaId, setEmpresaId] = useState(empresaInicial);
  const [v, setV] = useState<Prestamo>(() => ({ ...prestamoVacio(sumarDias(new Date().toISOString().slice(0, 10), 7)) }));
  const cambiarV = (cambio: Partial<Prestamo>) => setV((x) => ({ ...x, ...cambio }));
  // si se llega desde la ficha de un cliente, queda elegido y su empresa por defecto
  useEffect(() => {
    if (!clienteParam) return;
    datos
      .cliente(clienteParam)
      .then((c) => {
        if (!c) return;
        setModo("existente");
        setCliente(c);
        setEmpresaId((e) => e || c.empresa_id);
      })
      .catch(() => undefined);
  }, [clienteParam, datos]);

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const validar = () => {
    const e: Record<string, string> = {};
    if (modo === "existente") {
      if (!cliente) e.cliente = "Elige el cliente.";
    } else {
      if (!nuevo.nombres.trim()) e.nombres = "Escribe el nombre completo.";
      if (nuevo.dni && !nuevo.tipo_doc) e.tipo_doc = "Elige el tipo de documento.";
      else if (nuevo.dni && nuevo.tipo_doc && !esDocumentoValido(nuevo.dni, nuevo.tipo_doc)) e.dni = DOCUMENTOS[nuevo.tipo_doc].ayuda;
      if (nuevo.celular && !/^9\d{8}$/.test(nuevo.celular)) e.celular = "El celular debe tener 9 números y empezar con 9.";
      if (nuevo.celular2 && !CELULAR_2_VALIDO.test(nuevo.celular2)) e.celular2 = "Revisa el número (9 dígitos en Perú, o + y el código del país).";
      if (!ubicacionValida(nuevo.ubicacion)) e.ubicacion = "Pega un enlace de Google Maps o coordenadas como -12.0464,-77.0428.";
    }
    if (!empresaId) e.empresa = "Elige la empresa.";
    Object.assign(e, validarPrestamo(v));
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const guardar = async (ev: { preventDefault: () => void }) => {
    ev.preventDefault();
    if (!validar()) return;
    setGuardando(true);
    setError(null);
    try {
      const cli =
        modo === "existente"
          ? cliente!
          : await datos.guardarCliente({
              empresa_id: empresaId,
              nombres: nuevo.nombres.trim(),
              dni: nuevo.dni || null,
              tipo_doc: nuevo.tipo_doc || null,
              celular: nuevo.celular || null,
              celular2: nuevo.celular2 || null,
              direccion: nuevo.direccion.trim() || null,
              referencia: nuevo.referencia.trim() || null,
              recomendado_por: nuevo.recomendado_por.trim() || null,
              ubicacion: nuevo.ubicacion.trim() || null,
            });
      const usa = v.usar_capital && v.capital.trim() !== "";
      const enPct = usa && Number(v.capital) !== 0 ? Number(v.capital) > 12000 || Number(v.capital) < 2500 : false;
      await datos.crearPrestamo({
        cliente_id: cli.id,
        empresa_id: empresaId,
        monto_cuota: Number(v.cuota),
        nro_cuotas: Number(v.nro_cuotas),
        fecha_inicio: v.fecha_inicio,
        frecuencia: v.frecuencia,
        precio_total: v.precio.trim() ? Number(v.precio) : null,
        inicial: v.inicial.trim() ? Number(v.inicial) : null,
        capital: usa ? Number(v.capital) : null,
        interes_pct: usa && enPct && v.interes.trim() ? Number(v.interes) : null,
        interes_mes: usa && !enPct && v.interes.trim() ? Number(v.interes) : null,
        gps_mes: usa && v.gps.trim() ? Number(v.gps) : null,
      });
      router.push(`/clientes/ficha?id=${cli.id}`);
    } catch (err) {
      setError(mensajeDeError(err));
      setGuardando(false);
    }
  };

  const ponerNuevo = (campo: keyof typeof nuevo, valor: string) => setNuevo((x) => ({ ...x, [campo]: valor }));

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4" noValidate>
      {error && <Aviso tipo="error">{error}</Aviso>}

      <Tarjeta titulo="¿A quién es el préstamo?">
        <div className="mb-4 flex gap-2">
          {(["existente", "nuevo"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              aria-pressed={modo === m}
              className={`min-h-11 rounded-xl border px-4 font-semibold ${modo === m ? "border-tinta bg-tinta text-white" : "border-borde bg-superficie"}`}
            >
              {m === "existente" ? "Cliente que ya existe" : "Cliente nuevo"}
            </button>
          ))}
        </div>

        {modo === "existente" ? (
          <BuscarCliente elegido={cliente} alElegir={setCliente} error={errores.cliente} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Campo etiqueta="Nombres y apellidos" value={nuevo.nombres} onChange={(e) => ponerNuevo("nombres", e.target.value)} error={errores.nombres} obligatorio autoComplete="off" />
            </div>
            <Selector
              etiqueta="Tipo de documento"
              opciones={TIPOS_DOC}
              value={nuevo.tipo_doc}
              onChange={(e) => {
                const tipo = e.target.value as "" | TipoDoc;
                setNuevo((x) => ({ ...x, tipo_doc: tipo, dni: tipo ? limpiarDocumento(x.dni, tipo).slice(0, DOCUMENTOS[tipo].largo) : x.dni }));
              }}
              error={errores.tipo_doc}
              vacio="Elige…"
            />
            <Campo
              etiqueta={nuevo.tipo_doc ? `N.º de ${DOCUMENTOS[nuevo.tipo_doc].texto}` : "N.º de documento"}
              inputMode={nuevo.tipo_doc && DOCUMENTOS[nuevo.tipo_doc].letras ? "text" : "numeric"}
              maxLength={nuevo.tipo_doc ? DOCUMENTOS[nuevo.tipo_doc].largo : 12}
              disabled={!nuevo.tipo_doc}
              value={nuevo.dni}
              onChange={(e) => ponerNuevo("dni", limpiarDocumento(e.target.value, nuevo.tipo_doc || null))}
              error={errores.dni}
              ayuda={!nuevo.tipo_doc ? "Primero elige el tipo de documento." : undefined}
            />
            <Campo etiqueta="Celular" inputMode="tel" maxLength={9} value={nuevo.celular} onChange={(e) => ponerNuevo("celular", e.target.value.replace(/\D/g, ""))} error={errores.celular} />
            <Campo
              etiqueta="Celular 2"
              inputMode="tel"
              maxLength={16}
              value={nuevo.celular2}
              onChange={(e) => ponerNuevo("celular2", limpiarCelular2(e.target.value))}
              error={errores.celular2}
              placeholder="Opcional"
            />
            <Campo etiqueta="Dirección" value={nuevo.direccion} onChange={(e) => ponerNuevo("direccion", e.target.value)} />
            <Campo
              etiqueta="Ubicación (Google Maps)"
              value={nuevo.ubicacion}
              onChange={(e) => ponerNuevo("ubicacion", e.target.value)}
              error={errores.ubicacion}
              ayuda="Pega el enlace de Google Maps o las coordenadas."
            />
            <div className="sm:col-span-2">
              <Campo etiqueta="Referencia" value={nuevo.referencia} onChange={(e) => ponerNuevo("referencia", e.target.value)} ayuda="Cómo llegar, a quién preguntar, etc." />
            </div>
            <div className="sm:col-span-2">
              <Campo etiqueta="Recomendado por" maxLength={200} value={nuevo.recomendado_por} onChange={(e) => ponerNuevo("recomendado_por", e.target.value)} />
            </div>
          </div>
        )}
      </Tarjeta>

      <Tarjeta titulo="Préstamo">
        <div className="mb-4 rounded-lg border border-borde bg-suave px-4 py-3 sm:max-w-md">
          <p className="font-semibold text-marca">Préstamos personales</p>
          <p className="text-sm text-tenue">Préstamo de dinero en efectivo, sin vehículo.</p>
        </div>
        <CamposPrestamo v={v} errores={errores} alCambiar={cambiarV} />
      </Tarjeta>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Boton variante="secundario" tamano="grande" onClick={() => router.back()}>
          Cancelar
        </Boton>
        <Boton type="submit" tamano="grande" cargando={guardando}>
          Guardar préstamo
        </Boton>
      </div>
    </form>
  );
}

/** Buscar y elegir un cliente que ya existe. */
function BuscarCliente({ elegido, alElegir, error }: { elegido: Cliente | null; alElegir: (c: Cliente | null) => void; error?: string }) {
  const { datos } = useSesion();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [texto, setTexto] = useState("");
  useEffect(() => {
    datos
      .clientes()
      .then(setClientes)
      .catch(() => undefined);
  }, [datos]);

  const matches = useMemo(() => {
    const q = texto.trim().toLowerCase();
    if (!q) return [];
    return clientes
      .filter((c) => [c.nombres, c.dni, c.celular, c.celular2].some((x) => x?.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [clientes, texto]);

  if (elegido)
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-borde bg-fondo px-4 py-3">
        <span>
          <b>{elegido.nombres}</b>
          {elegido.dni ? ` · ${elegido.dni}` : ""}
          {elegido.celular ? ` · ${elegido.celular}` : ""}
        </span>
        <button type="button" onClick={() => alElegir(null)} className="text-sm font-semibold text-marca">
          Cambiar
        </button>
      </div>
    );

  return (
    <div>
      <Campo etiqueta="Buscar cliente" placeholder="Nombre, documento o celular" value={texto} onChange={(e) => setTexto(e.target.value)} error={error} autoComplete="off" />
      {matches.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {matches.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => alElegir(c)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-borde bg-superficie px-4 py-2 text-left hover:bg-fondo"
              >
                <span className="font-semibold">{c.nombres}</span>
                <span className="text-sm text-tenue">{[c.dni, c.celular].filter(Boolean).join(" · ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {texto.trim() && matches.length === 0 && <p className="mt-2 text-sm text-tenue">No se encontró. Revisa el nombre o usa «Cliente nuevo».</p>}
    </div>
  );
}
