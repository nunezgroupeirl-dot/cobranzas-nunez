/**
 * Tipos de la base de datos (supabase/esquema.sql).
 * Tablas, vistas y funciones usan exactamente estos nombres de columnas.
 * Si cambias el esquema, actualiza este archivo en el mismo commit.
 */

export type Rol = "administrador" | "cobrador";
export type Color = "verde" | "amarillo" | "rojo";
export type MedioPago = "yape" | "plin" | "banco" | "agente" | "efectivo";
export type TipoDocumento = "cliente" | "dni" | "moto" | "fachada" | "recibo" | "otro";
export type Bucket = "evidencias" | "documentos";

/* ---------- Tablas ---------- */

export interface Empresa {
  id: string;
  nombre: string;
  ruc: string | null;
}

export interface Cuenta {
  id: string;
  empresa_id: string;
  nombre: string; // "Yape Andrés", "BCP 191-..."
  medio: MedioPago;
  activa: boolean;
}

export interface Perfil {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
}

export interface Cliente {
  id: string;
  empresa_id: string;
  nombres: string;
  dni: string;
  celular: string | null;
  direccion: string | null;
  referencia: string | null;
  creado_en: string;
}

export interface Documento {
  id: string;
  cliente_id: string;
  tipo: TipoDocumento;
  ruta: string; // empresa_id/cliente_id/archivo.jpg en el bucket "documentos"
  creado_en: string;
}

export interface Moto {
  id: string;
  cliente_id: string | null;
  empresa_id: string;
  placa: string;
  tipo: string; // "Lineal", "Scooter", "Trimoto", "Otro"
  marca: string;
  color: string;
}

export interface Contrato {
  id: string;
  cliente_id: string;
  moto_id: string;
  empresa_id: string;
  monto_cuota: number;
  nro_cuotas: number;
  fecha_inicio: string; // fecha de la primera cuota (YYYY-MM-DD)
  precio_total: number | null; // precio de la moto
  inicial: number | null; // cuota inicial entregada
  cuotas_pagadas_inicial: number; // cuotas que ya estaban pagadas al pasar del cuaderno
  observaciones: string | null;
  estado: "activo" | "terminado" | "anulado"; // anulado = cerrado por el administrador
  cerrado_motivo: string | null;
  creado_en: string;
}

export type EstadoCuota = "pagada_a_tiempo" | "pagada_con_atraso" | "vencida" | "pendiente";

export interface Cuota {
  id: string;
  contrato_id: string;
  numero: number;
  fecha_vencimiento: string;
  monto: number;
  monto_pagado: number;
  fecha_pago: string | null; // fecha REAL en que quedó pagada
  estado: EstadoCuota;
}

export interface Pago {
  id: string;
  contrato_id: string;
  monto: number;
  fecha_pago: string;
  medio: MedioPago;
  cuenta_id: string | null;
  nro_operacion: string | null;
  foto_ruta: string;
  foto_hash: string;
  registrado_por: string; // perfil id
  registrado_por_nombre: string;
  creado_en: string;
  anulado: boolean;
  motivo_anulacion: string | null;
}

/* ---------- Vistas ---------- */

/** v_estado_cliente: una fila por contrato activo */
export interface EstadoCliente {
  contrato_id: string;
  cliente_id: string;
  cliente: string;
  dni: string;
  placa: string;
  celular: string | null;
  empresa_id: string;
  empresa: string;
  cuota: number;
  semanas_atraso: number;
  deuda: number;
  color: Color;
  ultimo_pago: string | null;
  proxima_cuota: string | null;
}

/** v_morosos: igual a v_estado_cliente, solo con atraso, de más a menos semanas */
export type Moroso = EstadoCliente;

/** v_resumen_empresa */
export interface ResumenEmpresa {
  empresa_id: string;
  empresa: string;
  cobrado_hoy: number;
  cobrado_semana: number;
  esperado_semana: number;
  clientes_verde: number;
  clientes_amarillo: number;
  clientes_rojo: number;
  deuda: number;
}

/** Una semana (lunes) de una empresa: lo cobrado frente a las cuotas que vencían. */
export interface CobranzaSemana {
  semana: string;
  empresa_id: string;
  cobrado: number;
  esperado: number;
}

/* ---------- Funciones ---------- */

export interface CrearContratoArgs {
  cliente_id: string;
  moto_id: string;
  monto_cuota: number;
  nro_cuotas: number;
  fecha_inicio: string;
  precio_total?: number | null;
  inicial?: number | null;
}

/** Una fila de la plantilla Excel de clientes (importar_cliente) */
export interface FilaImportacion {
  fila: number; // número de fila en el Excel (para los mensajes)
  empresa: string;
  nombres: string;
  dni: string;
  celular: string;
  direccion: string;
  referencia: string;
  tipo: string;
  placa: string;
  marca: string;
  color: string;
  cuota: number | null;
  nro_cuotas: number | null;
  fecha_inicio: string | null; // YYYY-MM-DD
  frecuencia: string;
  cuotas_pagadas: number | null;
  ultimo_pago: string | null; // YYYY-MM-DD
  observaciones: string;
}

export interface RegistrarPagoArgs {
  contrato_id: string;
  monto: number;
  fecha_pago: string;
  medio: MedioPago;
  cuenta_id: string | null;
  nro_operacion: string | null;
  foto_ruta: string;
  foto_hash: string;
}

export interface RegistrarPagoResultado {
  pago_id: string;
  cuotas_cubiertas: number[];
}

export type ErrorPago = "OPERACION_REPETIDA" | "IMAGEN_REPETIDA" | "MONTO_INVALIDO" | "SIN_FOTO";

export interface ConsultaPublica {
  nombre: string;
  placa: string;
  deuda: number;
  semanas_atraso: number;
  cuotas: Pick<Cuota, "numero" | "fecha_vencimiento" | "monto" | "monto_pagado" | "fecha_pago" | "estado">[];
}
