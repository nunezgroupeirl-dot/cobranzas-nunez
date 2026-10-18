import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

const CLASE_CONTROL =
  "w-full min-h-12 rounded-xl border border-borde bg-superficie px-4 text-base text-tinta placeholder:text-tenue/70 " +
  "focus:border-marca focus:outline-none focus:ring-3 focus:ring-marca/20 disabled:bg-fondo aria-invalid:border-rojo";

interface Envoltura {
  etiqueta: string;
  error?: string | null;
  ayuda?: ReactNode;
  obligatorio?: boolean;
}

function Marco({ id, etiqueta, error, ayuda, obligatorio, children }: Envoltura & { id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-tinta">
        {etiqueta}
        {obligatorio && <span className="text-rojo"> *</span>}
      </label>
      {children}
      {error ? (
        <p className="text-sm font-medium text-rojo" role="alert">
          {error}
        </p>
      ) : ayuda ? (
        <p className="text-sm text-tenue">{ayuda}</p>
      ) : null}
    </div>
  );
}

type PropsCampo = Envoltura & InputHTMLAttributes<HTMLInputElement>;

export function Campo({ etiqueta, error, ayuda, obligatorio, id, className = "", ...resto }: PropsCampo) {
  const auto = useId();
  const cid = id ?? auto;
  return (
    <Marco id={cid} etiqueta={etiqueta} error={error} ayuda={ayuda} obligatorio={obligatorio}>
      <input id={cid} aria-invalid={error ? true : undefined} required={obligatorio} className={`${CLASE_CONTROL} ${className}`} {...resto} />
    </Marco>
  );
}

type PropsArea = Envoltura & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function AreaTexto({ etiqueta, error, ayuda, obligatorio, id, className = "", ...resto }: PropsArea) {
  const auto = useId();
  const cid = id ?? auto;
  return (
    <Marco id={cid} etiqueta={etiqueta} error={error} ayuda={ayuda} obligatorio={obligatorio}>
      <textarea id={cid} aria-invalid={error ? true : undefined} required={obligatorio} className={`${CLASE_CONTROL} py-3 ${className}`} rows={3} {...resto} />
    </Marco>
  );
}

export interface Opcion {
  valor: string;
  texto: string;
}

interface PropsSelector extends Envoltura, Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  opciones: Opcion[];
  vacio?: string;
}

export function Selector({ etiqueta, error, ayuda, obligatorio, id, opciones, vacio, className = "", ...resto }: PropsSelector) {
  const auto = useId();
  const cid = id ?? auto;
  return (
    <Marco id={cid} etiqueta={etiqueta} error={error} ayuda={ayuda} obligatorio={obligatorio}>
      <select id={cid} aria-invalid={error ? true : undefined} required={obligatorio} className={`${CLASE_CONTROL} appearance-auto pr-3 ${className}`} {...resto}>
        {vacio !== undefined && <option value="">{vacio}</option>}
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </Marco>
  );
}

/** Botones grandes para elegir una opción (mejor que un select en tablet) */
export function OpcionesBoton({
  etiqueta,
  opciones,
  valor,
  alCambiar,
  obligatorio,
  error,
}: Envoltura & { opciones: Opcion[]; valor: string; alCambiar: (v: string) => void }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-semibold">
        {etiqueta}
        {obligatorio && <span className="text-rojo"> *</span>}
      </legend>
      <div className="flex flex-wrap gap-2">
        {opciones.map((o) => {
          const activo = o.valor === valor;
          return (
            <button
              key={o.valor}
              type="button"
              aria-pressed={activo}
              onClick={() => alCambiar(o.valor)}
              className={`min-h-12 rounded-xl border px-4 font-semibold transition ${
                activo ? "border-marca bg-marca text-white" : "border-borde bg-superficie hover:border-marca"
              }`}
            >
              {o.texto}
            </button>
          );
        })}
      </div>
      {error && <p className="text-sm font-medium text-rojo">{error}</p>}
    </fieldset>
  );
}
