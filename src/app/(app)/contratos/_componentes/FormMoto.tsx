"use client";
import { useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { useEmpresa } from "@/components/layout/empresa";
import { Aviso, Boton, Campo, OpcionesBoton, Selector, mensajeDeError } from "@/components/ui";
import type { Moto } from "@/types/database";

const TIPOS_MOTO = ["Mototaxi", "Lineal", "Scooter", "Trimoto", "Otro"];

interface Props {
  moto?: Moto;
  clienteId?: string | null;
  empresaInicial?: string;
  alGuardar: (m: Moto) => void;
  alCancelar?: () => void;
}

export function FormMoto({ moto, clienteId, empresaInicial, alGuardar, alCancelar }: Props) {
  const { datos, empresas } = useSesion();
  const filtro = useEmpresa();
  const [f, setF] = useState({
    placa: moto?.placa ?? "",
    tipo: moto?.tipo ?? "Mototaxi",
    marca: moto?.marca ?? "",
    color: moto?.color ?? "",
    empresa_id: moto?.empresa_id ?? empresaInicial ?? filtro ?? empresas[0]?.id ?? "",
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const poner = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  const guardar = async () => {
    const e: Record<string, string> = {};
    if (!/^[A-Z0-9]{2,4}-?[A-Z0-9]{2,4}$/i.test(f.placa.trim())) e.placa = "Escribe la placa (ej.: 1234-AB).";
    if (!f.marca.trim()) e.marca = "Escribe la marca.";
    if (!f.color.trim()) e.color = "Escribe el color.";
    if (!f.empresa_id) e.empresa_id = "Elige la empresa.";
    setErrores(e);
    if (Object.keys(e).length) return;
    setGuardando(true);
    setError(null);
    try {
      const m = await datos.guardarMoto({
        id: moto?.id,
        cliente_id: moto?.cliente_id ?? clienteId ?? null,
        empresa_id: f.empresa_id,
        placa: f.placa,
        tipo: f.tipo,
        marca: f.marca.trim(),
        color: f.color.trim(),
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
        <Campo
          etiqueta="Placa"
          value={f.placa}
          onChange={(e) => poner("placa", e.target.value.toUpperCase())}
          error={errores.placa}
          obligatorio
          className="font-display text-lg font-bold tracking-[0.06em] uppercase"
          autoCapitalize="characters"
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
      <div className="flex justify-end gap-2">
        {alCancelar && (
          <Boton variante="secundario" onClick={alCancelar}>
            Cancelar
          </Boton>
        )}
        <Boton onClick={guardar} cargando={guardando}>
          {moto ? "Guardar moto" : "Registrar moto"}
        </Boton>
      </div>
    </div>
  );
}
