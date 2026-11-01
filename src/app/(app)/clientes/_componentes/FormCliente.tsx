"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { useEmpresa } from "@/components/layout/empresa";
import { AreaTexto, Aviso, Boton, Campo, NOMBRE_DOCUMENTO, Selector, Tarjeta, mensajeDeError } from "@/components/ui";
import { subirDocumento } from "@/lib/fotos";
import type { Cliente, Documento, TipoDocumento } from "@/types/database";
import { FotosPorTipo } from "./FotosPorTipo";


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
  // una foto nueva por tipo (cliente, DNI, moto…): se suben al guardar
  const [pendientes, setPendientes] = useState<Partial<Record<TipoDocumento, File>>>({});

  useEffect(() => {
    if (cliente) datos.documentos(cliente.id).then(setExistentes);
  }, [cliente, datos]);

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
      // Una foto por tipo (máximo 6): se suben a la vez (cada una se comprime, sube y registra por su cuenta)
      await Promise.all(
        (Object.entries(pendientes) as [TipoDocumento, File][]).map(async ([tipo, archivo]) => {
          const ruta = await subirDocumento(datos, guardado.empresa_id, guardado.id, tipo, archivo);
          await datos.agregarDocumento({ cliente_id: guardado.id, tipo, ruta });
        }),
      );
      setPendientes({});
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

      <Tarjeta titulo={`Fotos y documentos (${existentes.length + Object.keys(pendientes).length} de 6)`}>
        <FotosPorTipo
          existentes={existentes}
          pendientes={pendientes}
          alElegir={(tipo, archivo) => setPendientes((p) => ({ ...p, [tipo]: archivo }))}
          alQuitarPendiente={(tipo) =>
            setPendientes((p) => {
              const resto = { ...p };
              delete resto[tipo];
              return resto;
            })
          }
          alQuitarExistente={quitarExistente}
        />
        <p className="mt-3 text-sm text-tenue">Cada foto se sube por separado y se comprime a unos 120 KB. Para cambiar una, quítala y toma otra.</p>
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
