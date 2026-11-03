"use client";
import { etiquetaCampo, problemaCampo, type CamposContrato } from "@/components/reportes/ContratoImpreso";
import { Campo, OpcionesBoton, Tarjeta } from "@/components/ui";
import type { CampoGuia, Paso } from "./pasos";

interface Props {
  paso: Paso;
  valores: CamposContrato;
  /** sugerencias para "cuenta" (cuentas de la empresa) */
  cuentas: string[];
  /** muestra en rojo lo que falta o está mal (después de tocar "Siguiente") */
  mostrarErrores: boolean;
  alCambiar: (k: keyof CamposContrato, v: string) => void;
}

function Control({ c, valores, mostrarErrores, alCambiar }: { c: CampoGuia } & Pick<Props, "valores" | "alCambiar" | "mostrarErrores">) {
  const valor = String(valores[c.clave] ?? "");
  const problema = mostrarErrores ? problemaCampo(valores, c.clave) : null;
  if (c.tipo === "opciones" && c.opciones)
    return <OpcionesBoton etiqueta={etiquetaCampo(c.clave)} opciones={c.opciones} valor={valor} alCambiar={(x) => alCambiar(c.clave, x)} obligatorio error={problema} />;
  return (
    <Campo
      etiqueta={etiquetaCampo(c.clave)}
      obligatorio
      type={c.tipo === "fecha" ? "date" : c.tipo === "numero" ? "number" : "text"}
      inputMode={c.soloNumeros || c.tipo === "numero" ? "decimal" : undefined}
      step={c.tipo === "numero" ? "0.01" : undefined}
      min={c.tipo === "numero" ? "0" : undefined}
      maxLength={c.soloNumeros}
      value={valor}
      placeholder={c.ejemplo ? `Ej.: ${c.ejemplo}` : undefined}
      list={c.clave === "cuenta" ? "cuentas-empresa" : undefined}
      ayuda={c.guia}
      error={problema}
      onChange={(e) => {
        let x = e.target.value;
        if (c.soloNumeros) x = x.replace(/\D/g, "");
        if (c.mayusculas) x = x.toUpperCase();
        alCambiar(c.clave, x);
      }}
    />
  );
}

/** Un paso de la pasarela: título, para qué sirve y sus campos (todos obligatorios). */
export function PasoContrato({ paso, valores, cuentas, mostrarErrores, alCambiar }: Props) {
  const listos = paso.campos.filter((c) => !problemaCampo(valores, c.clave)).length;
  return (
    <Tarjeta
      titulo={paso.titulo}
      accion={
        <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${listos === paso.campos.length ? "bg-marca-suave text-marca-oscura" : "bg-amarillo-suave text-amarillo"}`}>
          {listos} de {paso.campos.length} listos
        </span>
      }
    >
      <p className="mb-4 text-sm text-tenue">{paso.guia}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {paso.campos.map((c) => (
          <div key={c.clave} className={c.ancho ? "sm:col-span-2" : ""}>
            <Control c={c} valores={valores} mostrarErrores={mostrarErrores} alCambiar={alCambiar} />
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
