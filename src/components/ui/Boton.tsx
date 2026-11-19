import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { clasesBoton, type Tamano, type Variante } from "./estilos";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamano?: Tamano;
  ancho?: boolean;
  cargando?: boolean;
  children: ReactNode;
}

export function Boton({ variante, tamano, ancho, cargando, children, className = "", disabled, type = "button", ...resto }: Props) {
  return (
    <button
      type={type}
      className={`${clasesBoton(variante, tamano, ancho)} ${cargando ? "cargando" : ""} ${className}`}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      {...resto}
    >
      {cargando && <Puntos />}
      {children}
    </button>
  );
}

/** Mientras guarda: tres puntos que laten con calma (en vez del circulito que gira rápido). */
function Puntos() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      {[0, 160, 320].map((ms) => (
        <span key={ms} className="punto size-1.5 rounded-full bg-current" style={{ animationDelay: `${ms}ms` }} />
      ))}
    </span>
  );
}

interface PropsEnlace {
  href: string;
  variante?: Variante;
  tamano?: Tamano;
  ancho?: boolean;
  className?: string;
  children: ReactNode;
}

export function BotonEnlace({ href, variante, tamano, ancho, className = "", children }: PropsEnlace) {
  return (
    <Link href={href} className={`${clasesBoton(variante, tamano, ancho)} ${className}`}>
      {children}
    </Link>
  );
}
