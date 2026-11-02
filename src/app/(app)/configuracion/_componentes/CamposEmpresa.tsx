"use client";
import { Aviso, Campo } from "@/components/ui";
import type { Empresa } from "@/types/database";

export type FormEmpresa = Omit<Empresa, "id"> & { id?: string };

/** Formulario de la empresa: razón social, RUC y los datos del representante que salen en el contrato. */
export function CamposEmpresa({ empresa, alCambiar, error }: { empresa: FormEmpresa; alCambiar: (e: FormEmpresa) => void; error: string | null }) {
  return (
    <div className="flex flex-col gap-4">
      <Campo etiqueta="Razón social" value={empresa.nombre} onChange={(e) => alCambiar({ ...empresa, nombre: e.target.value })} obligatorio />
      <Campo
        etiqueta="RUC"
        inputMode="numeric"
        maxLength={11}
        value={empresa.ruc ?? ""}
        onChange={(e) => alCambiar({ ...empresa, ruc: e.target.value.replace(/\D/g, "") })}
        ayuda="11 números. Opcional."
      />
      <p className="-mb-2 text-sm font-semibold text-tenue">Para el contrato impreso</p>
      <Campo
        etiqueta="Representante (gerente)"
        value={empresa.representante ?? ""}
        onChange={(e) => alCambiar({ ...empresa, representante: e.target.value })}
        placeholder="Andrés Alexander Núñez Torres"
      />
      <Campo
        etiqueta="DNI del representante"
        inputMode="numeric"
        maxLength={8}
        value={empresa.representante_dni ?? ""}
        onChange={(e) => alCambiar({ ...empresa, representante_dni: e.target.value.replace(/\D/g, "") })}
      />
      <Campo
        etiqueta="Domicilio de la empresa"
        value={empresa.domicilio ?? ""}
        onChange={(e) => alCambiar({ ...empresa, domicilio: e.target.value })}
        placeholder="Mz 6 Lt 4 Santiago Antúnez de Mayolo, Pamplona Alta, San Juan de Miraflores - Lima"
      />
      {error && <Aviso tipo="error">{error}</Aviso>}
    </div>
  );
}
