"use client";
import { useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { useEmpresa } from "@/components/layout/empresa";
import { Aviso, Boton, Campo, OpcionesBoton, Selector, mensajeDeError } from "@/components/ui";
import { CamposFichaTecnica } from "./FichaTecnica";
import { CAMPOS_FICHA, type FichaTecnica } from "./fichaTecnica";
import type { Moto } from "@/types/database";
import { TIPOS_MOTO } from "@/lib/placa";
import { CampoPlaca } from "./CampoPlaca";


interface Props {
  moto?: Moto;
  clienteId?: string | null;
  empresaInicial?: string;
  alGuardar: (m: Moto) => void;
  alCancelar?: () => void;
  /** Solo el dueño: borra la moto si no tiene contratos. */
  alEliminar?: () => void;
  /** Solo el dueño: el vehículo ya no está en la empresa (se guarda en Archivados). */
  alArchivar?: () => void;
  /** Muestra la ficha técnica abierta (desde "Datos pendientes"). */
  abrirFicha?: boolean;
}

export function FormMoto({ moto, clienteId, empresaInicial, alGuardar, alCancelar, alEliminar, alArchivar, abrirFicha }: Props) {
  const { datos, empresas } = useSesion();
  const filtro = useEmpresa();
  const [f, setF] = useState({
    placa: moto?.placa ?? "",
    tramite: !moto?.placa && !!moto?.placa_tramite,
    tipo: moto?.tipo ?? "Mototaxi",
    marca: moto?.marca ?? "",
    color: moto?.color ?? "",
    empresa_id: moto?.empresa_id ?? empresaInicial ?? filtro ?? empresas[0]?.id ?? "",
  });
  const [ficha, setFicha] = useState<FichaTecnica>(() =>
    Object.fromEntries(CAMPOS_FICHA.map((k) => [k, moto?.[k] == null ? "" : String(moto[k])])) as FichaTecnica,
  );
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const poner = (k: Exclude<keyof typeof f, "tramite">, v: string) => setF((x) => ({ ...x, [k]: v }));

  const guardar = async () => {
    const e: Record<string, string> = {};
    if (!f.tramite && !f.placa.trim()) e.placa = "Escribe la placa o marca «Placa en trámite».";
    else if (!f.tramite && !/^[A-Z0-9]{2,4}-?[A-Z0-9]{2,4}$/i.test(f.placa.trim())) e.placa = "Escribe la placa (ej.: 1234-AB).";
    if (!f.marca.trim()) e.marca = "Escribe la marca.";
    if (!f.color.trim()) e.color = "Escribe el color.";
    if (!f.empresa_id) e.empresa_id = "Elige la empresa.";
    const anio = ficha.anio ? Number(ficha.anio) : null;
    if (anio !== null && (anio < 1990 || anio > 2100)) e.anio = "Año de modelo no válido.";
    setErrores(e);
    if (Object.keys(e).length) return;
    setGuardando(true);
    setError(null);
    try {
      const m = await datos.guardarMoto({
        id: moto?.id,
        cliente_id: moto?.cliente_id ?? clienteId ?? null,
        empresa_id: f.empresa_id,
        placa: f.tramite ? null : f.placa,
        placa_tramite: f.tramite,
        tipo: f.tipo,
        marca: f.marca.trim(),
        color: f.color.trim(),
        modelo: ficha.modelo.trim() || null,
        anio,
        clase: ficha.clase.trim() || null,
        combustible: ficha.combustible.trim() || null,
        serie: ficha.serie.trim() || null,
        motor: ficha.motor.trim() || null,
        carroceria: ficha.carroceria.trim() || null,
      });
      alGuardar(m);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoPlaca
          placa={f.placa}
          tramite={f.tramite}
          error={errores.placa}
          alCambiarPlaca={(v) => poner("placa", v)}
          alCambiarTramite={(v) => setF((x) => ({ ...x, tramite: v }))}
        />
        <Selector
          etiqueta="Empresa"
          opciones={empresas.map((x) => ({ valor: x.id, texto: x.nombre }))}
          value={f.empresa_id}
          onChange={(e) => poner("empresa_id", e.target.value)}
          error={errores.empresa_id}
          obligatorio
          vacio="Elige…"
        />
        <div className="sm:col-span-2">
          <OpcionesBoton etiqueta="Tipo" opciones={TIPOS_MOTO.map((t) => ({ valor: t, texto: t }))} valor={f.tipo} alCambiar={(v) => poner("tipo", v)} obligatorio />
        </div>
        <Campo etiqueta="Marca" value={f.marca} onChange={(e) => poner("marca", e.target.value)} error={errores.marca} obligatorio list="marcas-moto" />
        <Campo etiqueta="Color" value={f.color} onChange={(e) => poner("color", e.target.value)} error={errores.color} obligatorio />
        <datalist id="marcas-moto">
          {["Honda", "Bajaj", "Yamaha", "TVS", "Suzuki", "Ronco", "Wanxin", "Lifan"].map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>
      <CamposFichaTecnica abierta={abrirFicha} valores={ficha} alCambiar={(k, v) => setFicha((x) => ({ ...x, [k]: v }))} />
      {errores.anio && <Aviso tipo="error">{errores.anio}</Aviso>}
      <div className="flex flex-wrap justify-end gap-2">
        <AccionesDueno alEliminar={alEliminar} alArchivar={alArchivar} />
        {alCancelar && (
          <Boton variante="secundario" onClick={alCancelar}>
            Cancelar
          </Boton>
        )}
        <Boton onClick={guardar} cargando={guardando}>
          {moto ? "Guardar vehículo" : "Registrar vehículo"}
        </Boton>
      </div>
    </div>
  );
}

/** Eliminar (solo sin contratos) o archivar (ya no está en la empresa): solo el dueño. */
function AccionesDueno({ alEliminar, alArchivar }: { alEliminar?: () => void; alArchivar?: () => void }) {
  return (
    <>
      {alEliminar && (
        <Boton variante="borrar" className="mr-auto" onClick={alEliminar}>
          Eliminar vehículo
        </Boton>
      )}
      {alArchivar && (
        <Boton variante="secundario" onClick={alArchivar}>
          Archivar
        </Boton>
      )}
    </>
  );
}
