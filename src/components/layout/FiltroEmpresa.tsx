"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSesion } from "./Sesion";

export function FiltroEmpresa({ compacto = false }: { compacto?: boolean }) {
  const { empresas } = useSesion();
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();
  const actual = params.get("empresa") ?? "";

  const cambiar = (valor: string) => {
    const p = new URLSearchParams(params.toString());
    if (valor) p.set("empresa", valor);
    else p.delete("empresa");
    const q = p.toString();
    router.replace(q ? `${ruta}?${q}` : ruta, { scroll: false });
  };

  return (
    <label className="flex items-center gap-2">
      {!compacto && <span className="text-sm font-semibold text-tenue">Empresa</span>}
      <select
        value={actual}
        onChange={(e) => cambiar(e.target.value)}
        aria-label="Filtrar por empresa"
        className="min-h-11 rounded-xl border border-borde bg-superficie px-3 font-semibold focus:border-marca focus:outline-none"
      >
        <option value="">Todas</option>
        {empresas.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
