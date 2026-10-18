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
    <button type={type} className={`${clasesBoton(variante, tamano, ancho)} ${className}`} disabled={disabled || cargando} {...resto}>
      {cargando && <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}
      {children}
    </button>
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
