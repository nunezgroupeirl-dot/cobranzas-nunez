"use client";
import { abrirPlantillaContrato } from "@/components/reportes/ContratoPlantilla";
import { Boton } from "@/components/ui";

/** Contrato de alquiler venta en blanco, para llenar a mano, firmar, escanear y subir. */
export function BotonPlantillaContrato({ tamano = "chico" }: { tamano?: "chico" | "grande" }) {
  const abrir = () => {
    if (!abrirPlantillaContrato()) alert("El navegador bloqueó la ventana. Permite las ventanas emergentes para este sitio.");
  };
  return (
    <Boton variante="secundario" tamano={tamano} onClick={abrir}>
      Plantilla en blanco
    </Boton>
  );
}
