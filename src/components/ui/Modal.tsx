"use client";
import { useEffect, useRef, type MouseEvent, type ReactNode, type SyntheticEvent } from "react";

interface Props {
  abierto: boolean;
  titulo: string;
  alCerrar: () => void;
  children: ReactNode;
  pie?: ReactNode;
  ancho?: "normal" | "grande";
}

/**
 * Ventana modal con `<dialog>` nativo: el navegador atrapa el foco, cierra con Escape
 * y devuelve el foco al botón que la abrió. En celular sale desde abajo.
 */
export function Modal({ abierto, titulo, alCerrar, children, pie, ancho = "normal" }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (!abierto || !dialogo) return;
    if (!dialogo.open) dialogo.showModal();
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
      if (dialogo.open) dialogo.close();
    };
  }, [abierto]);

  if (!abierto) return null;

  // Escape: lo decide la página (puede estar guardando), no el navegador
  const alCancelar = (e: SyntheticEvent) => {
    e.preventDefault();
    alCerrar();
  };
  // clic en el fondo oscuro (fuera del contenido) = cerrar
  const alTocarFondo = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) alCerrar();
  };

  return (
    // react-doctor-disable-next-line click-events-have-key-events, no-noninteractive-element-interactions
    <dialog
      ref={ref}
      aria-label={titulo}
      onCancel={alCancelar}
      onClick={alTocarFondo}
      className={`mx-0 mt-auto mb-0 max-h-[92dvh] w-full max-w-full overflow-hidden rounded-t-3xl bg-superficie p-0 text-tinta shadow-2xl backdrop:bg-tinta/50 sm:m-auto sm:rounded-3xl ${
        ancho === "grande" ? "sm:max-w-4xl" : "sm:max-w-lg"
      }`}
    >
      <div className="flex max-h-[92dvh] flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-borde px-5 py-4">
          <h2 className="text-lg font-bold">{titulo}</h2>
          <button type="button" onClick={alCerrar} className="grid size-11 place-items-center rounded-full text-2xl text-tenue hover:bg-fondo" aria-label="Cerrar">
            ×
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {pie && <footer className="flex flex-wrap justify-end gap-2 border-t border-borde px-5 py-4">{pie}</footer>}
      </div>
    </dialog>
  );
}
