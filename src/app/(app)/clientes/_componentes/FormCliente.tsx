"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { useEmpresa } from "@/components/layout/empresa";
import { AreaTexto, Aviso, Boton, Campo, NOMBRE_DOCUMENTO, Selector, Tarjeta, VistaPrevia, mensajeDeError } from "@/components/ui";
import { subirDocumento } from "@/lib/fotos";
import type { Cliente, Documento, TipoDocumento } from "@/types/database";
import { Foto } from "./Foto";

const MAX_FOTOS = 6;
const TIPOS = Object.keys(NOMBRE_DOCUMENTO) as TipoDocumento[];

interface Pendiente {
  clave: string;
  tipo: TipoDocumento;
  archivo: File;
}

export function FormCliente({ cliente }: { cliente?: Cliente }) {
  const { datos, empresas } = useSesion();
  const empresaFiltro = useEmpresa();
  const router = useRouter();

  const [f, setF] = useState({
    nombres: cliente?.nombres ?? "",
    dni: cliente?.dni ?? "",
    celular: cliente?.celular ?? "",
    direccion: cliente?.direccion ?? "",
    referencia: cliente?.referencia ?? "",
    empresa_id: cliente?.empresa_id ?? empresaFiltro ?? empresas[0]?.id ?? "",
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<"" | "solo" | "contrato">("");
  const [existentes, setExistentes] = useState<Documento[]>([]);
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [tipoNuevo, setTipoNuevo] = useState<TipoDocumento>("cliente");

  useEffect(() => {
    if (cliente) datos.documentos(cliente.id).then(setExistentes);
  }, [cliente, datos]);

  const libres = MAX_FOTOS - existentes.length - pendientes.length;
  const poner = (campo: keyof typeof f, valor: string) => setF((x) => ({ ...x, [campo]: valor }));

  const validar = () => {
    const e: Record<string, string> = {};
    if (!f.nombres.trim()) e.nombres = "Escribe el nombre completo.";
    if (!/^\d{8}$/.test(f.dni)) e.dni = "El DNI debe tener 8 números.";
    if (f.celular && !/^9\d{8}$/.test(f.celular)) e.celular = "El celular debe tener 9 números y empezar con 9.";
    if (!f.empresa_id) e.empresa_id = "Elige la empresa.";
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const agregarFotos = (lista: FileList | null) => {
    if (!lista) return;
    const nuevas = Array.from(lista)
      .slice(0, libres)
      .map((archivo) => ({ clave: `${archivo.name}-${archivo.lastModified}-${Math.random()}`, tipo: tipoNuevo, archivo }));
    setPendientes((p) => [...p, ...nuevas]);
  };

  const quitarExistente = async (d: Documento) => {
    if (!confirm(`¿Quitar la foto "${NOMBRE_DOCUMENTO[d.tipo]}"?`)) return;
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
        id: cliente?.id,
        empresa_id: f.empresa_id,
        nombres: f.nombres.trim(),
        dni: f.dni,
        celular: f.celular || null,
        direccion: f.direccion.trim() || null,
        referencia: f.referencia.trim() || null,
      });
      // Máximo 6 fotos: se suben a la vez (cada una se comprime, sube y registra por su cuenta)
      await Promise.all(
        pendientes.map(async (p) => {
          const ruta = await subirDocumento(datos, guardado.empresa_id, guardado.id, p.tipo, p.archivo);
          await datos.agregarDocumento({ cliente_id: guardado.id, tipo: p.tipo, ruta });
        }),
      );
      setPendientes([]);
      router.push(despues === "contrato" ? `/contratos/nuevo?cliente=${guardado.id}` : `/clientes/ficha?id=${guardado.id}`);
    } catch (err) {
      setError(mensajeDeError(err));
      setGuardando("");
    }
  };

  const opcionesEmpresa = useMemo(() => empresas.map((e) => ({ valor: e.id, texto: e.nombre })), [empresas]);

  return (
    <form onSubmit={(e) => guardar(e, cliente ? "solo" : "contrato")} className="flex flex-col gap-4" noValidate>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <Tarjeta titulo="Datos del cliente">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Campo etiqueta="Nombres y apellidos" value={f.nombres} onChange={(e) => poner("nombres", e.target.value)} error={errores.nombres} obligatorio autoComplete="off" />
          </div>
          <Campo
            etiqueta="DNI"
            inputMode="numeric"
            maxLength={8}
            value={f.dni}
            onChange={(e) => poner("dni", e.target.value.replace(/\D/g, ""))}
            error={errores.dni}
            obligatorio
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
            <AreaTexto etiqueta="Referencia" value={f.referencia} onChange={(e) => poner("referencia", e.target.value)} ayuda="Cómo llegar, a quién preguntar, etc." />
          </div>
        </div>
      </Tarjeta>

      <Tarjeta titulo={`Fotos y documentos (${existentes.length + pendientes.length} de ${MAX_FOTOS})`}>
        <div className="flex flex-wrap gap-3">
          {existentes.map((d) => (
            <figure key={d.id} className="flex w-28 flex-col gap-1">
              <Foto bucket="documentos" ruta={d.ruta} titulo={NOMBRE_DOCUMENTO[d.tipo]} className="size-28" />
              <figcaption className="text-xs font-semibold">{NOMBRE_DOCUMENTO[d.tipo]}</figcaption>
              <button type="button" onClick={() => quitarExistente(d)} className="text-left text-xs font-semibold text-rojo">
                Quitar
              </button>
            </figure>
          ))}
          {pendientes.map((p) => (
            <figure key={p.clave} className="flex w-28 flex-col gap-1">
              <VistaPrevia archivo={p.archivo} className="size-28 rounded-xl border-2 border-marca object-cover" />
              <select
                value={p.tipo}
                onChange={(e) => setPendientes((x) => x.map((y) => (y.clave === p.clave ? { ...y, tipo: e.target.value as TipoDocumento } : y)))}
                className="rounded-lg border border-borde bg-superficie px-1 py-1 text-xs"
                aria-label="Tipo de foto"
              >
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {NOMBRE_DOCUMENTO[t]}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => setPendientes((x) => x.filter((y) => y.clave !== p.clave))} className="text-left text-xs font-semibold text-rojo">
                Quitar
              </button>
            </figure>
          ))}
        </div>
        {libres > 0 ? (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <Selector
              etiqueta="Tipo de la próxima foto"
              opciones={TIPOS.map((t) => ({ valor: t, texto: NOMBRE_DOCUMENTO[t] }))}
              value={tipoNuevo}
              onChange={(e) => setTipoNuevo(e.target.value as TipoDocumento)}
            />
            <label className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-marca px-5 font-semibold text-marca hover:bg-marca-suave">
              + Tomar o elegir foto
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => { agregarFotos(e.target.files); e.target.value = ""; }} />
            </label>
          </div>
        ) : (
          <p className="mt-3 text-sm text-tenue">Ya tiene las {MAX_FOTOS} fotos permitidas.</p>
        )}
        <p className="mt-2 text-sm text-tenue">Cada foto se comprime a unos 200 KB antes de subirla.</p>
      </Tarjeta>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Boton variante="secundario" tamano="grande" onClick={() => router.back()}>
          Cancelar
        </Boton>
        {cliente ? (
          <Boton type="submit" tamano="grande" cargando={guardando === "solo"}>
            Guardar cambios
          </Boton>
        ) : (
          <>
            <Boton variante="secundario" tamano="grande" cargando={guardando === "solo"} onClick={(e) => guardar(e, "solo")}>
              Solo guardar
            </Boton>
            <Boton type="submit" tamano="grande" cargando={guardando === "contrato"}>
              Guardar y crear contrato →
            </Boton>
          </>
        )}
      </div>
    </form>
  );
}
