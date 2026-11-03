"use client";
import type { ReactNode } from "react";
import { Campo, OpcionesBoton, Tarjeta } from "@/components/ui";
import type { CampoGuia, Paso } from "./pasos";

interface Props<K extends string> {
  paso: Paso<K>;
  valores: Record<K, string>;
  etiqueta: (k: K) => string;
  /** problema del dato en palabras, o null si está bien */
  problema: (k: K) => string | null;
  /** sugerencias para "cuenta" (cuentas de la empresa) */
  cuentas: string[];
  /** muestra en rojo lo que falta o está mal (después de tocar "Siguiente") */
  mostrarErrores: boolean;
  alCambiar: (k: K, v: string) => void;
  /** contenido antes de los campos (elegir empresa, buscar cliente, elegir moto) */
  arriba?: ReactNode;
  /** contenido después de los campos */
  abajo?: ReactNode;
}

/** Atributos del input según el tipo de dato (fecha, número, texto). */
function atributos<K extends string>(c: CampoGuia<K>) {
  const numero = c.tipo === "numero";
  return {
    type: c.tipo === "fecha" ? "date" : numero ? "number" : "text",
    inputMode: c.soloNumeros || numero ? ("decimal" as const) : undefined,
    step: numero ? "0.01" : undefined,
    min: numero ? "0" : undefined,
    maxLength: c.soloNumeros,
    placeholder: c.ejemplo ? `Ej.: ${c.ejemplo}` : undefined,
    list: c.clave === "cuenta" ? "cuentas-empresa" : undefined,
    ayuda: c.opcional ? (c.guia ? `Opcional. ${c.guia}` : "Opcional") : c.guia,
  };
}

/** Lo escrito, con solo números o en mayúsculas si el campo lo pide. */
const limpiar = <K extends string>(c: CampoGuia<K>, x: string) => {
  const y = c.soloNumeros ? x.replace(/\D/g, "") : x;
  return c.mayusculas ? y.toUpperCase() : y;
};

function Control<K extends string>({ c, valores, etiqueta, problema, mostrarErrores, alCambiar }: { c: CampoGuia<K> } & Omit<Props<K>, "paso" | "cuentas" | "arriba" | "abajo">) {
  const valor = String(valores[c.clave] ?? "");
  const error = mostrarErrores ? problema(c.clave) : null;
  if (c.tipo === "opciones" && c.opciones)
    return <OpcionesBoton etiqueta={etiqueta(c.clave)} opciones={c.opciones} valor={valor} alCambiar={(x) => alCambiar(c.clave, x)} obligatorio={!c.opcional} error={error} />;
  return <Campo etiqueta={etiqueta(c.clave)} obligatorio={!c.opcional} value={valor} error={error} onChange={(e) => alCambiar(c.clave, limpiar(c, e.target.value))} {...atributos(c)} />;
}

/** Un paso de la pasarela: título, para qué sirve y sus campos. */
export function PasoContrato<K extends string>({ paso, cuentas, arriba, abajo, ...resto }: Props<K>) {
  const listos = paso.campos.filter((c) => !resto.problema(c.clave)).length;
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
      {arriba}
      <div className="grid gap-4 sm:grid-cols-2">
        {paso.campos.map((c) => (
          <div key={c.clave} className={c.ancho ? "sm:col-span-2" : ""}>
            <Control c={c} {...resto} />
          </div>
        ))}
      </div>
      {abajo}
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
