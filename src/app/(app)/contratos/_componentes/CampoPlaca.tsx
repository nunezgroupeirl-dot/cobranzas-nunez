import { Campo } from "@/components/ui";
import { DIAS_TRAMITE } from "@/lib/tramite";

interface PropsPlaca {
  placa: string;
  tramite: boolean;
  error?: string;
  alCambiarPlaca: (v: string) => void;
  alCambiarTramite: (v: boolean) => void;
}

/** Placa, o la casilla "en trámite" cuando la placa aún no sale: una de las dos es obligatoria. */
export function CampoPlaca({ placa, tramite, error, alCambiarPlaca, alCambiarTramite }: PropsPlaca) {
  return (
    <div className="flex flex-col gap-2">
      <Campo
        etiqueta="Placa"
        value={tramite ? "" : placa}
        onChange={(e) => alCambiarPlaca(e.target.value.toUpperCase())}
        error={error}
        disabled={tramite}
        placeholder={tramite ? "Placa en trámite" : undefined}
        ayuda={placa || tramite ? undefined : "Escribe la placa o, si aún no sale, marca «Placa en trámite»."}
        obligatorio
        className="font-display text-lg font-bold tracking-[0.06em] uppercase"
        autoCapitalize="characters"
      />
      <label className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold">
        <input type="checkbox" checked={tramite} onChange={(e) => alCambiarTramite(e.target.checked)} className="size-5 shrink-0 accent-marca" />
        Placa en trámite (aún no sale)
      </label>
      {tramite && (
        <p className="text-sm text-tenue">
          A los {DIAS_TRAMITE} días de la entrega saldrá un aviso para registrar la placa y hacer el contrato.
        </p>
      )}
    </div>
  );
}
