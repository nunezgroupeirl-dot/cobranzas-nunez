import { fechaFin } from "@/components/reportes/ContratoImpreso";
import type { Datos } from "@/lib/supabase/datos";
import type { Cliente, Empresa, Moto } from "@/types/database";
import { aCampos, type Borrador } from "./borrador";

const nulo = (x: string) => x.trim() || null;

export interface Hechos {
  cliente?: Cliente;
  moto?: Moto;
  contratoId?: string;
}

interface Entrada {
  datos: Datos;
  b: Borrador;
  empresa: Empresa;
  cliente: Cliente | null; // ya registrado
  moto: Moto | null; // ya registrada
  /** lo que ya se guardó en un intento anterior (para no duplicar si algo falló a la mitad) */
  hechos: Hechos;
}

/**
 * Crea (o completa) el cliente y la moto, actualiza la empresa, crea el contrato con su cronograma
 * y guarda los datos del contrato impreso. Devuelve lo hecho; si algo falla, `hechos` queda con lo que sí se guardó.
 */
export async function crearTodo({ datos, b, empresa, cliente, moto, hechos }: Entrada): Promise<string> {
  const empresaNueva = { ruc: nulo(b.ruc), representante: nulo(b.representante), representante_dni: nulo(b.representante_dni), domicilio: nulo(b.domicilio_empresa) };
  if ((Object.keys(empresaNueva) as (keyof typeof empresaNueva)[]).some((k) => empresaNueva[k] !== (empresa[k] ?? null)))
    await datos.guardarEmpresa({ ...empresa, ...empresaNueva });

  const base = hechos.cliente ?? cliente;
  hechos.cliente = await datos.guardarCliente({
    id: base?.id,
    empresa_id: base?.empresa_id ?? empresa.id,
    nombres: b.cliente.trim(),
    dni: b.doc_numero.trim(),
    celular: nulo(b.celular),
    direccion: nulo(b.domicilio_cliente),
    referencia: base?.referencia ?? null,
    ubicacion: base?.ubicacion ?? null,
  });

  const laMoto = hechos.moto ?? moto;
  hechos.moto = await datos.guardarMoto({
    id: laMoto?.id,
    cliente_id: hechos.cliente.id,
    empresa_id: empresa.id,
    placa: b.placa.trim().toUpperCase(),
    tipo: laMoto?.tipo ?? (b.vehiculo === "MOTOCICLETA" ? "Lineal" : "Mototaxi"),
    marca: b.marca.trim(),
    color: b.color.trim(),
    modelo: nulo(b.modelo),
    anio: b.anio ? Number(b.anio) : null,
    clase: nulo(b.clase),
    combustible: nulo(b.combustible),
    serie: nulo(b.serie),
    motor: nulo(b.motor),
    carroceria: nulo(b.carroceria),
  });

  hechos.contratoId ??= await datos.crearContrato({
    cliente_id: hechos.cliente.id,
    moto_id: hechos.moto.id,
    monto_cuota: Number(b.renta),
    nro_cuotas: Number(b.nro_cuotas),
    fecha_inicio: b.inicio,
    precio_total: b.precio ? Number(b.precio) : null,
    inicial: Number(b.inicial),
    frecuencia: b.frec,
  });

  const campos = aCampos(b);
  await datos.guardarDocumentoContrato(hechos.contratoId, { ...campos, fin: fechaFin(campos) });
  return hechos.contratoId;
}
