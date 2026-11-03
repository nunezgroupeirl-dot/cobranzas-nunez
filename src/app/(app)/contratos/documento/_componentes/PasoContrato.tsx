"use client";
import { etiquetaCampo, type CamposContrato } from "@/components/reportes/ContratoImpreso";
import { Campo, OpcionesBoton, Tarjeta } from "@/components/ui";
import type { CampoGuia, Paso } from "./pasos";

interface Props {
  paso: Paso;
  valores: CamposContrato;
  /** sugerencias para "cuenta" (cuentas de la empresa) */
  cuentas: string[];
  alCambiar: (k: keyof CamposContrato, v: string) => void;
}

function Control({ c, valores, alCambiar }: { c: CampoGuia } & Pick<Props, "valores" | "alCambiar">) {
  const valor = String(valores[c.clave] ?? "");
  const vacio = !valor.trim();
  if (c.tipo === "opciones" && c.opciones)
    return <OpcionesBoton etiqueta={etiquetaCampo(c.clave)} opciones={c.opciones} valor={valor} alCambiar={(x) => alCambiar(c.clave, x)} />;
  return (
    <Campo
      etiqueta={etiquetaCampo(c.clave)}
      type={c.tipo === "fecha" ? "date" : c.tipo === "numero" ? "number" : "text"}
      inputMode={c.soloNumeros || c.tipo === "numero" ? "decimal" : undefined}
      step={c.tipo === "numero" ? "0.01" : undefined}
      min={c.tipo === "numero" ? "0" : undefined}
      maxLength={c.soloNumeros}
      value={valor}
      placeholder={c.ejemplo ? `Ej.: ${c.ejemplo}` : undefined}
      list={c.clave === "cuenta" ? "cuentas-empresa" : undefined}
      ayuda={vacio ? <span className="font-semibold text-amarillo">Falta · {c.guia ?? "saldrá con una raya para llenar a mano"}</span> : c.guia}
      onChange={(e) => {
        let x = e.target.value;
        if (c.soloNumeros) x = x.replace(/\D/g, "");
        if (c.mayusculas) x = x.toUpperCase();
        alCambiar(c.clave, x);
      }}
      className={vacio ? "border-amarillo bg-amarillo-suave/40" : ""}
    />
  );
}

/** Un paso del llenado guiado: título, para qué sirve y sus campos. */
export function PasoContrato({ paso, valores, cuentas, alCambiar }: Props) {
  const llenos = paso.campos.filter((c) => String(valores[c.clave] ?? "").trim()).length;
  return (
    <Tarjeta
      titulo={paso.titulo}
      accion={
        <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${llenos === paso.campos.length ? "bg-verde-suave text-verde" : "bg-amarillo-suave text-amarillo"}`}>
          {llenos} de {paso.campos.length}
        </span>
      }
    >
      <p className="mb-4 text-sm text-tenue">{paso.guia}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {paso.campos.map((c) => (
          <div key={c.clave} className={c.ancho ? "sm:col-span-2" : ""}>
            <Control c={c} valores={valores} alCambiar={alCambiar} />
          </div>
        ))}
      </div>
      {paso.campos.some((c) => c.clave === "cuenta") && (
        <datalist id="cuentas-empresa">
          {cuentas.map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
      )}
    </Tarjeta>
  );
}
