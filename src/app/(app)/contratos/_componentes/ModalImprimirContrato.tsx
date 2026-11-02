"use client";
import { useState } from "react";
import { abrirContrato, datosFaltantes } from "@/components/reportes/ContratoImpreso";
import { Aviso, Boton, Campo, Modal, OpcionesBoton, Selector, hoyLima } from "@/components/ui";
import { sumarMeses } from "@/lib/letras";
import type { Cliente, Contrato, Cuenta, Empresa, Moto } from "@/types/database";

interface Props {
  contrato: Contrato;
  cliente: Cliente;
  moto: Moto;
  empresa: Empresa;
  cuentas: Cuenta[];
  alCerrar: () => void;
}

const OTRA = "__otra__";
const redondear = (n: number) => Math.round(n * 100) / 100;

/** Datos que solo salen en el papel (renta, cuenta, plazo). Se llenan con lo del contrato y se pueden ajustar. */
export function ModalImprimirContrato({ contrato, cliente, moto, empresa, cuentas, alCerrar }: Props) {
  const propias = cuentas.filter((c) => c.empresa_id === empresa.id);
  const [f, setF] = useState(() => ({
    frecuencia: "SEMANAL" as "DIARIA" | "SEMANAL",
    renta: String(contrato.monto_cuota),
    cuenta: (propias.find((c) => c.medio === "banco") ?? propias[0])?.nombre ?? OTRA,
    otraCuenta: "",
    plazo: String(Math.max(1, Math.round((contrato.nro_cuotas * 7) / 30.44))),
    inicio: contrato.fecha_inicio,
    inicial: contrato.inicial === null ? "" : String(contrato.inicial),
    fechaFirma: hoyLima(),
  }));
  const [error, setError] = useState<string | null>(null);
  const poner = (k: keyof typeof f, valor: string) => setF((x) => ({ ...x, [k]: valor }));

  const cambiarFrecuencia = (fr: "DIARIA" | "SEMANAL") =>
    setF((x) => ({ ...x, frecuencia: fr, renta: String(fr === "DIARIA" ? redondear(contrato.monto_cuota / 7) : contrato.monto_cuota) }));

  const cuenta = f.cuenta === OTRA ? f.otraCuenta : f.cuenta;
  const inicial = f.inicial.trim() === "" ? null : Number(f.inicial);
  const plazo = Number(f.plazo);
  const faltan = datosFaltantes({ empresa, cliente, moto, cuenta, inicial });

  const imprimir = () => {
    const renta = Number(f.renta);
    if (!(renta > 0)) return setError("Escribe el monto de la renta.");
    if (!(plazo >= 1 && plazo <= 120)) return setError("El plazo debe estar entre 1 y 120 meses.");
    if (!f.inicio) return setError("Elige la fecha de inicio.");
    const ok = abrirContrato({
      empresa, cliente, moto, renta, frecuencia: f.frecuencia, cuenta, plazoMeses: plazo,
      inicio: f.inicio, fin: sumarMeses(f.inicio, plazo), inicial, ciudad: "Lima", fechaFirma: f.fechaFirma || hoyLima(),
    });
    if (!ok) return setError("El navegador bloqueó la ventana. Permite las ventanas emergentes para este sitio.");
    alCerrar();
  };

  return (
    <Modal
      abierto
      titulo="Contrato para imprimir"
      alCerrar={alCerrar}
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton onClick={imprimir}>Abrir contrato</Boton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <OpcionesBoton
              etiqueta="La renta se deposita en forma"
              opciones={[{ valor: "SEMANAL", texto: "Semanal" }, { valor: "DIARIA", texto: "Diaria" }]}
              valor={f.frecuencia}
              alCambiar={(x) => cambiarFrecuencia(x as "DIARIA" | "SEMANAL")}
            />
          </div>
          <Campo etiqueta="Renta (S/)" type="number" inputMode="decimal" min="0" step="0.01" value={f.renta} onChange={(e) => poner("renta", e.target.value)} />
          <Campo etiqueta="Inicial (S/)" type="number" inputMode="decimal" min="0" value={f.inicial} onChange={(e) => poner("inicial", e.target.value)} />
          <Selector
            etiqueta="Cuenta de depósito"
            opciones={[...propias.map((c) => ({ valor: c.nombre, texto: c.nombre })), { valor: OTRA, texto: "Escribir otra…" }]}
            value={f.cuenta}
            onChange={(e) => poner("cuenta", e.target.value)}
          />
          {f.cuenta === OTRA ? (
            <Campo etiqueta="Cuenta" placeholder="BCP (1944202917005)" value={f.otraCuenta} onChange={(e) => poner("otraCuenta", e.target.value)} />
          ) : (
            <div className="hidden sm:block" />
          )}
          <Campo etiqueta="Plazo (meses)" type="number" inputMode="numeric" min="1" max="120" value={f.plazo} onChange={(e) => poner("plazo", e.target.value)} />
          <Campo
            etiqueta="Empieza el"
            type="date"
            value={f.inicio}
            onChange={(e) => poner("inicio", e.target.value)}
            ayuda={f.inicio && plazo >= 1 ? `Termina el ${sumarMeses(f.inicio, plazo).split("-").reverse().join("/")}` : undefined}
          />
          <Campo etiqueta="Fecha de firma" type="date" value={f.fechaFirma} onChange={(e) => poner("fechaFirma", e.target.value)} />
        </div>
        {faltan.length > 0 && (
          <Aviso tipo="alerta">
            Faltan datos ({faltan.join("; ")}). Saldrán con una raya para llenarlos a mano, o complétalos antes en Configuración (empresa), en la moto o en el cliente.
          </Aviso>
        )}
        {error && <Aviso tipo="error">{error}</Aviso>}
      </div>
    </Modal>
  );
}
