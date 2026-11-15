import { Campo } from "@/components/ui";

interface PropsPlaca {
  placa: string;
  tramite: boolean;
  error?: string;
  alCambiarPlaca: (v: string) => void;
  alCambiarTramite: (v: boolean) => void;
}

/** Placa, o la casilla "en trámite" cuando la placa aún no sale (así no figura como dato pendiente). */
export function CampoPlaca({ placa, tramite, error, alCambiarPlaca, alCambiarTramite }: PropsPlaca) {
  return (
    <div className="flex flex-col gap-2">
      <Campo
        etiqueta="Placa"
        value={tramite ? "" : placa}
        onChange={(e) => alCambiarPlaca(e.target.value.toUpperCase())}
        error={error}
        disabled={tramite}
        placeholder={tramite ? "En trámite" : undefined}
        ayuda={placa || tramite ? undefined : "Si aún no la sabes, déjala vacía: saldrá en “Datos pendientes”."}
        className="font-display text-lg font-bold tracking-[0.06em] uppercase"
        autoCapitalize="characters"
      />
      <label className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold">
        <input type="checkbox" checked={tramite} onChange={(e) => alCambiarTramite(e.target.checked)} className="size-5 shrink-0 accent-marca" />
        Placa en trámite (aún no sale)
      </label>
    </div>
  );
}
