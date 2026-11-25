-- =============================================================================
--  COBRANZAS NUÑEZ · Esquema completo de la base de datos (Supabase / PostgreSQL)
-- -----------------------------------------------------------------------------
--  Cómo usarlo:
--    Supabase → SQL Editor → New query → pegar TODO este archivo → Run.
--    Se puede volver a ejecutar: no borra datos (usa IF NOT EXISTS / OR REPLACE).
--
--  Contenido:
--     1. Tipos
--     2. Tablas e índices
--     3. Funciones de apoyo (fecha de Lima, roles)
--     4. Reglas del negocio (cronograma, pagos, anulación, cierre, importación)
--     5. Vistas (cuotas, estado del cliente, morosos, resumen por empresa)
--     6. Consulta pública por DNI
--     7. Usuarios y auditoría (triggers)
--     8. Seguridad por fila (RLS)
--     9. Almacenamiento de fotos (buckets privados)
--    10. Permisos
--    11. Datos iniciales
--    12. Primer administrador (instrucciones)
--
--  Reglas acordadas con Andrés:
--    · Semáforo: verde al día · amarillo 1 a 3 semanas de atraso · rojo 4 o más.
--    · Cada pago va a la cuota pendiente más antigua y guarda la fecha real de pago.
--    · Todo pago lleva foto. No se repite n.º de operación ni imagen.
--    · Sin intereses ni mora: la cuota es fija.
--    · El día es el de Lima: cambia a medianoche.
-- =============================================================================


-- =============================================================================
-- 1. TIPOS
-- =============================================================================
do $$ begin create type public.rol_usuario as enum ('administrador', 'cobrador');
exception when duplicate_object then null; end $$;

do $$ begin create type public.medio_pago as enum ('yape', 'plin', 'banco', 'agente', 'efectivo');
exception when duplicate_object then null; end $$;

do $$ begin create type public.tipo_documento as enum ('cliente', 'dni', 'moto', 'fachada', 'recibo', 'otro', 'contrato');
exception when duplicate_object then null; end $$;
alter type public.tipo_documento add value if not exists 'contrato';  -- páginas del contrato firmado
alter type public.tipo_documento add value if not exists 'dni_reverso';  -- DNI o Carné de Extranjería: 'dni' es el frente
-- Vehículo por sus 4 lados ('moto' es el frente) y el cliente con su contrato
alter type public.tipo_documento add value if not exists 'moto_atras';
alter type public.tipo_documento add value if not exists 'moto_izquierda';
alter type public.tipo_documento add value if not exists 'moto_derecha';
alter type public.tipo_documento add value if not exists 'cliente_contrato';
-- Tarjeta de propiedad del vehículo por las 2 caras (a veces la traen en foto)
alter type public.tipo_documento add value if not exists 'tarjeta_frente';
alter type public.tipo_documento add value if not exists 'tarjeta_reverso';

-- activo: se está pagando · terminado: pagó todo · anulado: cerrado por el administrador (moto recuperada, etc.)
do $$ begin create type public.estado_contrato as enum ('activo', 'terminado', 'anulado');
exception when duplicate_object then null; end $$;


-- =============================================================================
-- 2. TABLAS E ÍNDICES
-- =============================================================================

-- Las 4 razones sociales de Andrés
create table if not exists public.empresas (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique check (length(trim(nombre)) > 0),
  ruc        text check (ruc is null or ruc ~ '^\d{11}$'),
  creado_en  timestamptz not null default now()
);
-- Datos que salen en el contrato impreso
alter table public.empresas add column if not exists representante text;
alter table public.empresas add column if not exists representante_dni text;
alter table public.empresas add column if not exists domicilio text;

-- Cuentas donde llega el dinero (Yape, Plin, bancos)
create table if not exists public.cuentas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas (id) on delete restrict,
  nombre      text not null check (length(trim(nombre)) > 0),   -- "Yape Andrés ***356", "BCP 191-..."
  medio       public.medio_pago not null check (medio <> 'efectivo'),
  activa      boolean not null default true,
  creado_en   timestamptz not null default now()
);
create index if not exists cuentas_empresa_idx on public.cuentas (empresa_id);

-- Cuentas de cobro por partes: entidad (BCP, Interbank, Yape…), titular (a nombre de quién) y número.
-- Cualquier cuenta puede ser personal (sin empresa): sirve para cobrar a clientes de todas las empresas.
alter table public.cuentas add column if not exists entidad text;
alter table public.cuentas add column if not exists titular text;
alter table public.cuentas add column if not exists numero  text;
alter table public.cuentas alter column empresa_id drop not null;
alter table public.cuentas drop constraint if exists cuentas_empresa_si_es_banco;

-- "nombre" (lo que se ve al registrar pagos y en los reportes) se arma solo: "BCP 1947… · Titular"
create or replace function public.nombre_cuenta()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.entidad := nullif(trim(new.entidad), '');
  new.titular := nullif(trim(new.titular), '');
  new.numero  := nullif(regexp_replace(coalesce(new.numero, ''), '\s+', '', 'g'), '');
  if new.entidad is not null and new.numero is not null then
    new.nombre := new.entidad || ' ' || new.numero || coalesce(' · ' || new.titular, '');
  end if;
  return new;
end;
$$;
drop trigger if exists nombre_cuenta on public.cuentas;
create trigger nombre_cuenta before insert or update on public.cuentas
  for each row execute function public.nombre_cuenta();

-- Usuarios del sistema (uno por cada usuario de Supabase Auth)
create table if not exists public.perfiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nombre     text not null,
  email      text not null,
  rol        public.rol_usuario not null default 'cobrador',
  activo     boolean not null default false,
  creado_en  timestamptz not null default now()
);

-- El dueño (Andrés): el único que ve el Panel del dueño y los ingresos. Otro administrador ve todo lo demás.
-- Solo se cambia desde la base de datos.
alter table public.perfiles add column if not exists es_dueno boolean not null default false;

-- Puesto del cobrador: "oficina" (caja, cobra en la oficina) o "ruta" (cobrador de ruta, puerta a puerta).
-- Mismos permisos; solo cambia la pantalla con la que empieza. Lo pone el dueño (función "usuarios").
alter table public.perfiles add column if not exists puesto text;
alter table public.perfiles drop constraint if exists perfiles_puesto_check;
alter table public.perfiles add constraint perfiles_puesto_check check (puesto is null or puesto in ('oficina', 'ruta'));

-- (La regla "solo el dueño es administrador" se agrega más abajo, cuando ya existe correo_dueno().)

create table if not exists public.clientes (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas (id) on delete restrict,
  nombres     text not null check (length(trim(nombres)) > 0),
  dni         text unique,  -- DNI (8 números) o Carné de Extranjería (9 a 12); vacío = pendiente (cuadernos)
  celular     text check (celular is null or celular ~ '^9\d{8}$'),
  celular2    text check (celular2 is null or celular2 ~ '^(9\d{8}|\+[1-9]\d{7,14})$'), -- otro número: de Perú o de otro país con + y su código
  direccion   text,
  referencia  text,
  creado_en   timestamptz not null default now()
);
create index if not exists clientes_empresa_idx on public.clientes (empresa_id);
-- Ubicación para encontrar al cliente: enlace de Google Maps o coordenadas "lat,lng"
alter table public.clientes add column if not exists ubicacion text;
alter table public.clientes drop constraint if exists clientes_ubicacion_check;
alter table public.clientes add constraint clientes_ubicacion_check check (ubicacion is null or length(ubicacion) <= 500);
-- Quién recomendó al cliente o el asesor de tienda que lo mandó a la empresa (texto libre, opcional)
alter table public.clientes add column if not exists recomendado_por text;
alter table public.clientes add column if not exists celular2 text;
alter table public.clientes drop constraint if exists clientes_celular2_check;
alter table public.clientes add constraint clientes_celular2_check check (celular2 is null or celular2 ~ '^(9\d{8}|\+[1-9]\d{7,14})$');
alter table public.clientes drop constraint if exists clientes_recomendado_por_check;
alter table public.clientes add constraint clientes_recomendado_por_check check (recomendado_por is null or length(recomendado_por) <= 200);
alter table public.clientes alter column dni drop not null;
alter table public.clientes drop constraint if exists clientes_dni_check;
alter table public.clientes add constraint clientes_dni_check check (dni is null or dni ~ '^[A-Z0-9]{5,12}$');  -- el pasaporte puede llevar letras
-- Tipo de documento elegido al registrar: DNI (8 números), Carné de Extranjería (CE, 8 a 12),
-- Cédula (5 a 12 números) o Pasaporte (6 a 12 letras o números)
alter table public.clientes add column if not exists tipo_doc text;
alter table public.clientes drop constraint if exists clientes_tipo_doc_check;
alter table public.clientes add constraint clientes_tipo_doc_check check (
  tipo_doc is null
  or (tipo_doc = 'DNI' and (dni is null or dni ~ '^\d{8}$'))
  or (tipo_doc = 'CE' and (dni is null or dni ~ '^\d{8,12}$'))
  or (tipo_doc = 'CEDULA' and (dni is null or dni ~ '^\d{5,12}$'))
  or (tipo_doc = 'PASAPORTE' and (dni is null or dni ~ '^[A-Z0-9]{6,12}$'))
);
-- Si llega un número sin tipo (importador, contratos antiguos), se deduce: 8 números = DNI, más = CE
create or replace function public.tipo_doc_por_defecto()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.dni is not null and new.tipo_doc is null then
    new.tipo_doc := case when length(new.dni) = 8 then 'DNI' else 'CE' end;
  end if;
  return new;
end;
$$;
drop trigger if exists tipo_doc_por_defecto on public.clientes;
create trigger tipo_doc_por_defecto before insert or update of dni, tipo_doc on public.clientes
  for each row execute function public.tipo_doc_por_defecto();
update public.clientes set tipo_doc = case when length(dni) = 8 then 'DNI' else 'CE' end where dni is not null and tipo_doc is null;

-- Al cambiar la empresa del cliente, se mueven con él solo los vehículos que estaban en su empresa anterior
-- (los de otra empresa se quedan donde están). El bloqueo por pagos lo hace empresa_moto_en_cascada.
create or replace function public.empresa_cliente_en_cascada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.empresa_id is distinct from old.empresa_id then
    update public.motos set empresa_id = new.empresa_id where cliente_id = new.id and empresa_id = old.empresa_id;
  end if;
  return new;
end;
$$;
revoke all on function public.empresa_cliente_en_cascada() from public, anon, authenticated;
drop trigger if exists empresa_cliente_en_cascada on public.clientes;
create trigger empresa_cliente_en_cascada after update of empresa_id on public.clientes
  for each row execute function public.empresa_cliente_en_cascada();

-- Fotos y documentos del cliente (las imágenes viven en el bucket "documentos")
create table if not exists public.documentos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.clientes (id) on delete cascade,
  tipo        public.tipo_documento not null,
  ruta        text not null unique,
  subido_por  uuid default auth.uid() references public.perfiles (id) on delete set null,
  creado_en   timestamptz not null default now()
);
create index if not exists documentos_cliente_idx on public.documentos (cliente_id);
-- Archivados: ya no están en la empresa, pero se guardan para el histórico
alter table public.clientes add column if not exists archivado boolean not null default false;
alter table public.clientes add column if not exists archivado_en timestamptz;
alter table public.clientes add column if not exists archivado_motivo text;

create table if not exists public.motos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid references public.clientes (id) on delete set null,
  empresa_id  uuid not null references public.empresas (id) on delete restrict,
  placa       text unique,  -- vacía = pendiente (moto pasada del cuaderno sin placa)
  tipo        text not null default 'Otro',
  marca       text not null default '',
  color       text not null default '',
  creado_en   timestamptz not null default now()
);
create index if not exists motos_cliente_idx on public.motos (cliente_id);
alter table public.motos alter column placa drop not null;
alter table public.motos drop constraint if exists motos_placa_check;
alter table public.motos add constraint motos_placa_check check (placa is null or (length(placa) > 0 and placa = upper(trim(placa))));
-- Ficha técnica (sale en el contrato impreso)
alter table public.motos add column if not exists modelo text;
alter table public.motos add column if not exists anio integer;
alter table public.motos add column if not exists clase text;
alter table public.motos add column if not exists combustible text;
alter table public.motos add column if not exists serie text;
alter table public.motos add column if not exists motor text;
alter table public.motos add column if not exists carroceria text;
alter table public.motos drop constraint if exists motos_anio_check;
alter table public.motos add constraint motos_anio_check check (anio is null or anio between 1990 and 2100);
-- Placa en trámite: la moto ya se entregó pero la placa aún no sale (no cuenta como dato pendiente)
alter table public.motos add column if not exists placa_tramite boolean not null default false;

-- Desde cuándo la placa está en trámite (no se borra al registrar la placa): a los 30 días sale el aviso
-- de hacer el contrato, y sigue hasta que se suba el contrato firmado.
alter table public.motos add column if not exists tramite_desde date;
create or replace function public.motos_tramite_desde()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.placa_tramite and new.tramite_desde is null then
    new.tramite_desde := public.hoy_lima();
  end if;
  return new;
end;
$$;
drop trigger if exists motos_tramite_desde on public.motos;
create trigger motos_tramite_desde before insert or update on public.motos
  for each row execute function public.motos_tramite_desde();
alter table public.motos add column if not exists archivado boolean not null default false;
alter table public.motos add column if not exists archivado_en timestamptz;
alter table public.motos add column if not exists archivado_motivo text;

create table if not exists public.contratos (
  id                      uuid primary key default gen_random_uuid(),
  cliente_id              uuid not null references public.clientes (id) on delete restrict,
  moto_id                 uuid not null references public.motos (id) on delete restrict,
  empresa_id              uuid not null references public.empresas (id) on delete restrict,
  monto_cuota             numeric(10, 2) not null check (monto_cuota > 0),
  nro_cuotas              integer not null check (nro_cuotas between 1 and 1000),
  fecha_inicio            date not null,                       -- vencimiento de la 1.ª cuota
  precio_total            numeric(12, 2) check (precio_total is null or precio_total >= 0),
  inicial                 numeric(12, 2) check (inicial is null or inicial >= 0),
  -- Carga inicial desde los cuadernos: cuotas que ya estaban pagadas antes del sistema
  cuotas_pagadas_inicial  integer not null default 0 check (cuotas_pagadas_inicial >= 0),
  ultimo_pago_inicial     date,
  observaciones           text,
  estado                  public.estado_contrato not null default 'activo',
  cerrado_motivo          text,
  cerrado_en              timestamptz,
  creado_por              uuid default auth.uid() references public.perfiles (id) on delete set null,
  creado_en               timestamptz not null default now(),
  check (cuotas_pagadas_inicial <= nro_cuotas)
);
create index if not exists contratos_cliente_idx on public.contratos (cliente_id);
create index if not exists contratos_empresa_idx on public.contratos (empresa_id);
create index if not exists contratos_estado_idx on public.contratos (estado);
-- Cada cuánto paga: semanal (lo normal), quincenal o mensual. El cronograma sale según esto.
alter table public.contratos add column if not exists frecuencia text not null default 'semanal';
alter table public.contratos drop constraint if exists contratos_frecuencia_check;
alter table public.contratos add constraint contratos_frecuencia_check check (frecuencia in ('diario', 'semanal', 'quincenal', 'mensual'));
-- cobro diario: un año son ~365 cuotas
alter table public.contratos drop constraint if exists contratos_nro_cuotas_check;
alter table public.contratos add constraint contratos_nro_cuotas_check check (nro_cuotas between 1 and 1000);
-- Páginas del contrato firmado y escaneado (documentos de tipo "contrato")
alter table public.documentos add column if not exists contrato_id uuid references public.contratos (id) on delete cascade;
create index if not exists documentos_contrato_idx on public.documentos (contrato_id);

-- Contrato con varios vehículos (venta de 2, 3… con un solo cronograma): el principal es contratos.moto_id;
-- los demás llevan aquí el contrato al que pertenecen.
alter table public.motos add column if not exists contrato_id uuid references public.contratos (id) on delete set null;
create index if not exists motos_contrato_idx on public.motos (contrato_id);

-- Préstamo de dinero (Nuñez Group también presta efectivo): un contrato sin vehículo, cobrado por días y cuotas
-- igual que una venta. 'vehiculo' = contrato de una venta (con moto); 'prestamo' = préstamo de dinero (sin moto).
alter table public.contratos alter column moto_id drop not null;
alter table public.contratos add column if not exists tipo text not null default 'vehiculo';
alter table public.contratos drop constraint if exists contratos_tipo_check;
alter table public.contratos add constraint contratos_tipo_check check (tipo in ('vehiculo', 'prestamo'));
-- una venta siempre tiene vehículo; un préstamo nunca
alter table public.contratos drop constraint if exists contratos_tipo_moto_check;
alter table public.contratos add constraint contratos_tipo_moto_check check (
  (tipo = 'vehiculo' and moto_id is not null) or (tipo = 'prestamo' and moto_id is null)
);

-- Fotos del vehículo: cada una ligada a su vehículo (un cliente puede tener varios).
alter table public.documentos add column if not exists moto_id uuid references public.motos (id) on delete cascade;
create index if not exists documentos_moto_idx on public.documentos (moto_id);
-- Las fotos de vehículo de antes (sin vehículo) pasan al primer vehículo registrado del cliente.
update public.documentos d
set moto_id = (select m.id from public.motos m where m.cliente_id = d.cliente_id order by m.creado_en limit 1)
where d.moto_id is null
  and d.tipo in ('moto', 'moto_atras', 'moto_izquierda', 'moto_derecha', 'tarjeta_frente', 'tarjeta_reverso');

-- Cada vehículo tiene su empresa: su contrato va siempre a la misma empresa que el vehículo.
-- Si el vehículo ya tiene pagos válidos, solo un administrador puede corregirla (todo queda en la auditoría).
create or replace function public.empresa_moto_en_cascada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.empresa_id is distinct from old.empresa_id then
    -- con pagos registrados, solo un administrador puede corregir la empresa (queda en la auditoría)
    if not public.es_admin() and exists (
      select 1 from public.pagos p join public.contratos c on c.id = p.contrato_id
      where c.moto_id = new.id and not p.anulado
    ) then
      raise exception 'El vehículo %ya tiene pagos registrados en su empresa: solo un administrador puede cambiarlo de empresa.',
        coalesce(new.placa || ' ', '') using errcode = 'P0001';
    end if;
    update public.contratos set empresa_id = new.empresa_id where moto_id = new.id and empresa_id is distinct from new.empresa_id;
  end if;
  return new;
end;
$$;
revoke all on function public.empresa_moto_en_cascada() from public, anon, authenticated;
drop trigger if exists empresa_moto_en_cascada on public.motos;
create trigger empresa_moto_en_cascada after update of empresa_id on public.motos
  for each row execute function public.empresa_moto_en_cascada();

-- Una moto solo puede tener un contrato activo
-- Una moto puede tener 2 préstamos activos del MISMO cliente (préstamo 2 sobre la misma moto);
-- que no sea de otro cliente lo controla crear_contrato.
drop index if exists public.contratos_moto_activa_uq;
create index if not exists contratos_moto_idx on public.contratos (moto_id);

-- Cronograma. monto_pagado y fecha_pago los calcula recalcular_contrato(): nunca se editan a mano.
-- El estado (vencida / pendiente / pagada) se calcula en la vista "cuotas".
create table if not exists public.cuotas_base (
  id                 uuid primary key default gen_random_uuid(),
  contrato_id        uuid not null references public.contratos (id) on delete cascade,
  numero             integer not null check (numero > 0),
  fecha_vencimiento  date not null,
  monto              numeric(10, 2) not null check (monto > 0),
  monto_pagado       numeric(10, 2) not null default 0 check (monto_pagado >= 0),
  fecha_pago         date,                                     -- fecha REAL en que quedó completa
  unique (contrato_id, numero)
);
create index if not exists cuotas_vencimiento_idx on public.cuotas_base (fecha_vencimiento);

create table if not exists public.pagos (
  id                uuid primary key default gen_random_uuid(),
  contrato_id       uuid not null references public.contratos (id) on delete restrict,
  monto             numeric(10, 2) not null check (monto > 0),
  fecha_pago        date not null,
  medio             public.medio_pago not null,
  cuenta_id         uuid references public.cuentas (id) on delete restrict,
  nro_operacion     text,
  foto_ruta         text not null,                             -- bucket "evidencias"
  foto_hash         text not null,                             -- SHA-256 de la foto original
  registrado_por    uuid not null references public.perfiles (id) on delete restrict,
  creado_en         timestamptz not null default now(),
  anulado           boolean not null default false,
  motivo_anulacion  text,
  anulado_por       uuid references public.perfiles (id) on delete set null,
  anulado_en        timestamptz
);
create index if not exists pagos_contrato_idx on public.pagos (contrato_id);
create index if not exists pagos_fecha_idx on public.pagos (fecha_pago);
-- Bloqueo de vouchers repetidos (los pagos anulados liberan el número y la imagen)
create unique index if not exists pagos_nro_operacion_uq on public.pagos (nro_operacion) where not anulado and nro_operacion is not null;
create unique index if not exists pagos_foto_hash_uq on public.pagos (foto_hash) where not anulado;
-- Comprobante de cuotas que el cuaderno ya daba por pagadas: el pago se aplica justo a esas cuotas
alter table public.pagos add column if not exists cuotas_anteriores integer[];

-- Qué parte de cada pago se aplicó a cada cuota (se reconstruye en cada recálculo)
create table if not exists public.pago_cuota (
  pago_id         uuid not null references public.pagos (id) on delete cascade,
  cuota_id        uuid not null references public.cuotas_base (id) on delete cascade,
  monto_aplicado  numeric(10, 2) not null check (monto_aplicado > 0),
  primary key (pago_id, cuota_id)
);
create index if not exists pago_cuota_cuota_idx on public.pago_cuota (cuota_id);

-- Índices de las demás llaves foráneas (recomendación del asesor de Supabase)
create index if not exists pagos_cuenta_idx          on public.pagos (cuenta_id);
create index if not exists pagos_registrado_por_idx  on public.pagos (registrado_por);
create index if not exists pagos_anulado_por_idx     on public.pagos (anulado_por);
create index if not exists motos_empresa_idx         on public.motos (empresa_id);
create index if not exists contratos_creado_por_idx  on public.contratos (creado_por);
create index if not exists documentos_subido_por_idx on public.documentos (subido_por);

-- Quién hizo qué y cuándo
create table if not exists public.auditoria (
  id           bigint generated always as identity primary key,
  usuario_id   uuid,
  accion       text not null,
  tabla        text not null,
  registro_id  text,
  detalle      jsonb,
  creado_en    timestamptz not null default now()
);
create index if not exists auditoria_fecha_idx on public.auditoria (creado_en desc);

-- Reporte mensual: el dueño ve un aviso fijo hasta descargar el reporte del mes anterior
create table if not exists public.reportes_mensuales (
  mes             date primary key check (extract(day from mes) = 1),
  descargado_en   timestamptz not null default now(),
  descargado_por  uuid default auth.uid() references public.perfiles (id) on delete set null
);
create index if not exists reportes_mensuales_por_idx on public.reportes_mensuales (descargado_por);
revoke all on table public.reportes_mensuales from anon;
grant select, insert on table public.reportes_mensuales to authenticated;

-- Datos del contrato impreso llenados en la página (para volver a imprimirlo igual)
alter table public.contratos add column if not exists documento jsonb;


-- =============================================================================
-- 3. FUNCIONES DE APOYO
-- =============================================================================

-- Fecha operativa en Lima: el día cambia a medianoche
create or replace function public.hoy_lima()
returns date
language sql
stable
set search_path = ''
as $$
  -- el día de Lima: lo registrado después de medianoche cuenta para el día siguiente
  select (now() at time zone 'America/Lima')::date;
$$;

-- ¿El usuario conectado es un trabajador activo?
create or replace function public.es_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and activo);
$$;

-- ÚNICO DUEÑO DEL SISTEMA. Solo este correo puede ser administrador: anular pagos,
-- cerrar contratos, crear usuarios, importar, configurar y ver el panel.
-- (Para instalar el sistema a otro cliente, cambia solo este correo.)
create or replace function public.correo_dueno()
returns text
language sql
immutable
set search_path = ''
as $$
  select 'nunezgroupeirl@gmail.com'::text;
$$;

-- ¿El usuario conectado es administrador activo? (el dueño y quienes él nombre administradores)
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = auth.uid() and p.activo and p.rol = 'administrador'
  );
$$;

-- ¿El usuario conectado es EL dueño (el correo del dueño)? Solo él nombra o quita administradores.
-- El correo se toma de auth.users: nadie puede cambiárselo desde la app.
create or replace function public.es_dueno()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfiles p
    join auth.users u on u.id = p.id
    where p.id = auth.uid() and p.activo and p.rol = 'administrador' and lower(u.email) = public.correo_dueno()
  );
$$;

-- Antes solo el dueño podía ser administrador; ahora él puede nombrar a otros (p. ej. su primo Elvis).
alter table public.perfiles drop constraint if exists solo_el_dueno_es_administrador;


-- =============================================================================
-- 4. REGLAS DEL NEGOCIO
-- =============================================================================

-- Reaplica todos los pagos vigentes de un contrato sobre sus cuotas, del más antiguo
-- al más nuevo, siempre a la cuota pendiente más antigua. Uso interno.
create or replace function public.recalcular_contrato(p_contrato_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inicial  integer;
  v_estado   public.estado_contrato;
  v_resto    numeric;
  v_aplica   numeric;
  v_total    integer;
  v_pagadas  integer;
  v_objetivo integer[];
  r_pago     record;
  r_cuota    record;
  v_descuento numeric;
  v_fecha_desc date;
begin
  select c.cuotas_pagadas_inicial, c.estado, coalesce(c.descuento, 0), p.fecha_pago
  into v_inicial, v_estado, v_descuento, v_fecha_desc
  from public.contratos c
  left join public.pagos p on p.id = c.descuento_pago_id and not p.anulado
  where c.id = p_contrato_id for update of c;
  if not found then
    raise exception 'El contrato no existe.';
  end if;

  delete from public.pago_cuota pc
  using public.cuotas_base cb
  where pc.cuota_id = cb.id and cb.contrato_id = p_contrato_id;

  -- cuotas del cuaderno que ya tienen su comprobante subido: las cubre ese pago y no la carga inicial
  select coalesce(array_agg(n), '{}') into v_objetivo
  from public.pagos p, unnest(p.cuotas_anteriores) as n
  where p.contrato_id = p_contrato_id and not p.anulado;

  update public.cuotas_base
  set monto_pagado = case when numero <= v_inicial and not (numero = any (v_objetivo)) then monto else 0 end,
      fecha_pago = null
  where contrato_id = p_contrato_id;

  -- primero los comprobantes de cuotas del cuaderno (van a sus cuotas), luego los pagos normales en orden
  for r_pago in
    select id, monto, fecha_pago, cuotas_anteriores from public.pagos
    where contrato_id = p_contrato_id and not anulado
    order by (cuotas_anteriores is null), fecha_pago, creado_en, id
  loop
    v_resto := r_pago.monto;
    for r_cuota in
      select id, monto, monto_pagado from public.cuotas_base
      where contrato_id = p_contrato_id and monto_pagado < monto
        and (r_pago.cuotas_anteriores is null or numero = any (r_pago.cuotas_anteriores))
      order by numero
    loop
      exit when v_resto <= 0;
      v_aplica := least(r_cuota.monto - r_cuota.monto_pagado, v_resto);
      update public.cuotas_base
      set monto_pagado = monto_pagado + v_aplica,
          fecha_pago = case when monto_pagado + v_aplica >= monto then r_pago.fecha_pago else fecha_pago end
      where id = r_cuota.id;
      insert into public.pago_cuota (pago_id, cuota_id, monto_aplicado) values (r_pago.id, r_cuota.id, v_aplica);
      v_resto := v_resto - v_aplica;
    end loop;
  end loop;

  -- cancelación anticipada: el interés de los meses que no se usaron se descuenta de las últimas cuotas
  -- (no es dinero cobrado: no crea pago ni entra en los reportes de cobranza)
  if v_descuento > 0 and v_fecha_desc is not null then
    for r_cuota in
      select id, monto, monto_pagado from public.cuotas_base
      where contrato_id = p_contrato_id and monto_pagado < monto
      order by numero desc
    loop
      exit when v_descuento <= 0;
      v_aplica := least(r_cuota.monto - r_cuota.monto_pagado, v_descuento);
      update public.cuotas_base
      set monto_pagado = monto_pagado + v_aplica,
          fecha_pago = case when monto_pagado + v_aplica >= monto then v_fecha_desc else fecha_pago end
      where id = r_cuota.id;
      v_descuento := v_descuento - v_aplica;
    end loop;
  end if;

  -- Un contrato pagado por completo pasa a "terminado" (y vuelve a "activo" si se anula un pago)
  if v_estado in ('activo', 'terminado') then
    select count(*), count(*) filter (where monto_pagado >= monto)
    into v_total, v_pagadas
    from public.cuotas_base where contrato_id = p_contrato_id;

    update public.contratos
    set estado = case when v_total > 0 and v_pagadas = v_total then 'terminado'::public.estado_contrato
                      else 'activo'::public.estado_contrato end
    where id = p_contrato_id
      and estado <> case when v_total > 0 and v_pagadas = v_total then 'terminado'::public.estado_contrato
                         else 'activo'::public.estado_contrato end;
  end if;
end;
$$;

-- Genera las cuotas semanales de un contrato (cada 7 días desde la 1.ª). Uso interno.
create or replace function public.generar_cuotas(p_contrato_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  -- diario: cada día · semanal: cada 7 días · mensual: el mismo día de cada mes · quincenal: 2 por mes (el día de inicio y 15 días después)
  insert into public.cuotas_base (contrato_id, numero, fecha_vencimiento, monto)
  select c.id, n,
    case c.frecuencia
      when 'diario' then c.fecha_inicio + (n - 1)
      when 'mensual' then (c.fecha_inicio + make_interval(months => n - 1))::date
      when 'quincenal' then (c.fecha_inicio + make_interval(months => (n - 1) / 2))::date + case when n % 2 = 0 then 15 else 0 end
      else c.fecha_inicio + (n - 1) * 7
    end,
    c.monto_cuota
  from public.contratos c, generate_series(1, c.nro_cuotas) as n
  where c.id = p_contrato_id;
$$;

-- Crea el contrato y genera todas sus cuotas (semanales, quincenales o mensuales)
drop function if exists public.crear_contrato(uuid, uuid, numeric, integer, date, numeric, numeric, integer, date, text);
create or replace function public.crear_contrato(
  p_cliente_id      uuid,
  p_moto_id         uuid,
  p_monto_cuota     numeric,
  p_nro_cuotas      integer,
  p_fecha_inicio    date,
  p_precio_total    numeric default null,
  p_inicial         numeric default null,
  p_cuotas_pagadas  integer default 0,
  p_ultimo_pago     date default null,
  p_observaciones   text default null,
  p_frecuencia      text default 'semanal'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moto  public.motos;
  v_id    uuid;
begin
  if not public.es_admin() then  -- solo el dueño crea contratos
    raise exception 'SIN_PERMISO' using errcode = '42501';
  end if;
  if not exists (select 1 from public.clientes where id = p_cliente_id) then
    raise exception 'El cliente no existe.';
  end if;

  select * into v_moto from public.motos where id = p_moto_id for update;
  if not found then
    raise exception 'Elige una moto.';
  end if;
  if v_moto.cliente_id is not null and v_moto.cliente_id <> p_cliente_id then
    raise exception 'Esa moto está asignada a otro cliente.';
  end if;
  -- Un segundo préstamo sobre la misma moto solo puede ser del mismo cliente
  if exists (select 1 from public.contratos where moto_id = p_moto_id and estado = 'activo' and cliente_id <> p_cliente_id) then
    raise exception 'Esa moto ya tiene un contrato activo de otro cliente.';
  end if;
  if p_monto_cuota is null or p_monto_cuota <= 0 then
    raise exception 'La cuota debe ser mayor a 0.';
  end if;
  if coalesce(p_frecuencia, 'semanal') not in ('diario', 'semanal', 'quincenal', 'mensual') then
    raise exception 'Frecuencia no válida.';
  end if;
  if p_nro_cuotas is null or p_nro_cuotas < 1 or p_nro_cuotas > 1000 then
    raise exception 'El número de cuotas debe estar entre 1 y 1000.';
  end if;
  if p_fecha_inicio is null then
    raise exception 'Elige la fecha de la primera cuota.';
  end if;
  if coalesce(p_cuotas_pagadas, 0) < 0 or coalesce(p_cuotas_pagadas, 0) > p_nro_cuotas then
    raise exception 'Las cuotas ya pagadas no pueden ser más que el número de cuotas.';
  end if;

  insert into public.contratos (
    cliente_id, moto_id, empresa_id, monto_cuota, nro_cuotas, fecha_inicio,
    precio_total, inicial, cuotas_pagadas_inicial, ultimo_pago_inicial, observaciones, frecuencia
  ) values (
    p_cliente_id, p_moto_id, v_moto.empresa_id, round(p_monto_cuota, 2), p_nro_cuotas, p_fecha_inicio,
    p_precio_total, p_inicial, coalesce(p_cuotas_pagadas, 0), p_ultimo_pago, nullif(trim(p_observaciones), ''),
    coalesce(p_frecuencia, 'semanal')
  )
  returning id into v_id;

  perform public.generar_cuotas(v_id);

  update public.motos set cliente_id = p_cliente_id where id = p_moto_id and cliente_id is null;

  perform public.recalcular_contrato(v_id);
  return v_id;
end;
$$;

-- Registra un pago con su evidencia y lo aplica a las cuotas
create or replace function public.registrar_pago(
  p_contrato_id    uuid,
  p_monto          numeric,
  p_fecha_pago     date,
  p_medio          public.medio_pago,
  p_cuenta_id      uuid,
  p_nro_operacion  text,
  p_foto_ruta      text,
  p_foto_hash      text
)
returns table (pago_id uuid, cuotas_cubiertas integer[])
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contrato   public.contratos;
  v_saldo      numeric;
  v_nro        text := nullif(trim(p_nro_operacion), '');
  v_cuenta     uuid := p_cuenta_id;
  v_antes      integer[];
  v_id         uuid;
  v_restriccion text;
begin
  if not public.es_staff() then
    raise exception 'SIN_PERMISO' using errcode = '42501';
  end if;

  select * into v_contrato from public.contratos where id = p_contrato_id for update;
  if not found or v_contrato.estado <> 'activo' then
    raise exception 'Este contrato no está activo.';
  end if;

  if coalesce(trim(p_foto_ruta), '') = '' or coalesce(trim(p_foto_hash), '') = '' then
    raise exception 'SIN_FOTO';
  end if;

  select coalesce(sum(monto - monto_pagado), 0) into v_saldo
  from public.cuotas_base where contrato_id = p_contrato_id;
  if p_monto is null or p_monto <= 0 or round(p_monto, 2) <> p_monto or p_monto > v_saldo then
    raise exception 'MONTO_INVALIDO';
  end if;

  if p_fecha_pago is null or p_fecha_pago > public.hoy_lima() then
    raise exception 'La fecha de pago no puede ser futura.';
  end if;
  -- los trabajadores registran lo del día (o de la última semana); pagos más antiguos, solo un administrador
  if not public.es_admin() and p_fecha_pago < public.hoy_lima() - 7 then
    raise exception 'Solo un administrador puede registrar pagos de hace más de 7 días.';
  end if;

  if p_medio = 'efectivo' then
    v_nro := null;
    v_cuenta := null;
  else
    if v_nro is null then
      raise exception 'Escribe el número de operación.';
    end if;
    if v_cuenta is null or not exists (select 1 from public.cuentas where id = v_cuenta and activa) then
      raise exception 'Elige la cuenta donde llegó el dinero.';
    end if;
    if exists (select 1 from public.pagos where nro_operacion = v_nro and not anulado) then
      raise exception 'OPERACION_REPETIDA';
    end if;
  end if;

  if exists (select 1 from public.pagos where foto_hash = p_foto_hash and not anulado) then
    raise exception 'IMAGEN_REPETIDA';
  end if;

  select coalesce(array_agg(numero), '{}') into v_antes
  from public.cuotas_base where contrato_id = p_contrato_id and monto_pagado >= monto;

  begin
    insert into public.pagos (contrato_id, monto, fecha_pago, medio, cuenta_id, nro_operacion, foto_ruta, foto_hash, registrado_por)
    values (p_contrato_id, p_monto, p_fecha_pago, p_medio, v_cuenta, v_nro, p_foto_ruta, p_foto_hash, auth.uid())
    returning id into v_id;
  exception when unique_violation then
    get stacked diagnostics v_restriccion = constraint_name;
    if v_restriccion = 'pagos_nro_operacion_uq' then raise exception 'OPERACION_REPETIDA'; end if;
    raise exception 'IMAGEN_REPETIDA';
  end;

  perform public.recalcular_contrato(p_contrato_id);

  return query
    select v_id,
           coalesce(array_agg(cb.numero order by cb.numero), '{}')::integer[]
    from public.cuotas_base cb
    where cb.contrato_id = p_contrato_id and cb.monto_pagado >= cb.monto and not (cb.numero = any (v_antes));
end;
$$;

-- Sube el comprobante de cuotas que el cuaderno ya daba por pagadas (solo el dueño).
-- Crea un pago con su voucher por el total de esas cuotas: así se ven en el historial y en el cronograma
-- con su fecha real. La deuda no cambia. Si se anula, las cuotas vuelven a "pagadas del cuaderno".
create or replace function public.registrar_pago_anterior(
  p_contrato_id    uuid,
  p_cuotas         integer[],
  p_fecha_pago     date,
  p_medio          public.medio_pago,
  p_cuenta_id      uuid,
  p_nro_operacion  text,
  p_foto_ruta      text,
  p_foto_hash      text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contrato    public.contratos;
  v_cuotas      integer[];
  v_monto       numeric;
  v_nro         text := nullif(trim(p_nro_operacion), '');
  v_cuenta      uuid := p_cuenta_id;
  v_id          uuid;
  v_restriccion text;
begin
  if not public.es_admin() then
    raise exception 'SIN_PERMISO' using errcode = '42501';
  end if;

  select * into v_contrato from public.contratos where id = p_contrato_id for update;
  if not found or v_contrato.estado = 'anulado' then
    raise exception 'Este contrato no existe o está cerrado.';
  end if;

  select coalesce(array_agg(distinct n order by n), '{}') into v_cuotas from unnest(p_cuotas) as n;
  if cardinality(v_cuotas) = 0 then
    raise exception 'Elige al menos una cuota.';
  end if;
  if exists (select 1 from unnest(v_cuotas) n where n < 1 or n > v_contrato.cuotas_pagadas_inicial) then
    raise exception 'Solo se sube comprobante de cuotas que el cuaderno ya daba por pagadas.';
  end if;
  if exists (select 1 from public.pagos p, unnest(p.cuotas_anteriores) n
             where p.contrato_id = p_contrato_id and not p.anulado and n = any (v_cuotas)) then
    raise exception 'Alguna de esas cuotas ya tiene su comprobante.';
  end if;

  if coalesce(trim(p_foto_ruta), '') = '' or coalesce(trim(p_foto_hash), '') = '' then
    raise exception 'SIN_FOTO';
  end if;
  if p_fecha_pago is null or p_fecha_pago > public.hoy_lima() then
    raise exception 'La fecha de pago no puede ser futura.';
  end if;

  if p_medio = 'efectivo' then
    v_nro := null;
    v_cuenta := null;
  else
    if v_nro is null then
      raise exception 'Escribe el número de operación.';
    end if;
    if v_cuenta is null or not exists (select 1 from public.cuentas where id = v_cuenta and activa) then
      raise exception 'Elige la cuenta donde llegó el dinero.';
    end if;
    if exists (select 1 from public.pagos where nro_operacion = v_nro and not anulado) then
      raise exception 'OPERACION_REPETIDA';
    end if;
  end if;
  if exists (select 1 from public.pagos where foto_hash = p_foto_hash and not anulado) then
    raise exception 'IMAGEN_REPETIDA';
  end if;

  select sum(monto) into v_monto from public.cuotas_base where contrato_id = p_contrato_id and numero = any (v_cuotas);

  begin
    insert into public.pagos (contrato_id, monto, fecha_pago, medio, cuenta_id, nro_operacion, foto_ruta, foto_hash, registrado_por, cuotas_anteriores)
    values (p_contrato_id, v_monto, p_fecha_pago, p_medio, v_cuenta, v_nro, p_foto_ruta, p_foto_hash, auth.uid(), v_cuotas)
    returning id into v_id;
  exception when unique_violation then
    get stacked diagnostics v_restriccion = constraint_name;
    if v_restriccion = 'pagos_nro_operacion_uq' then raise exception 'OPERACION_REPETIDA'; end if;
    raise exception 'IMAGEN_REPETIDA';
  end;

  perform public.recalcular_contrato(p_contrato_id);
  return v_id;
end;
$$;

-- Anula un pago (solo administrador). La cuota vuelve a quedar pendiente o vencida.
create or replace function public.anular_pago(p_pago_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pago public.pagos;
begin
  if not public.es_admin() then
    raise exception 'SIN_PERMISO' using errcode = '42501';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Escribe el motivo de la anulación.';
  end if;

  select * into v_pago from public.pagos where id = p_pago_id for update;
  if not found then
    raise exception 'El pago no existe.';
  end if;
  if v_pago.anulado then
    raise exception 'Este pago ya estaba anulado.';
  end if;

  update public.pagos
  set anulado = true, motivo_anulacion = trim(p_motivo), anulado_por = auth.uid(), anulado_en = now()
  where id = p_pago_id;

  -- si era el pago de una cancelación anticipada, el descuento de intereses también se quita
  update public.contratos set descuento = 0, descuento_pago_id = null where descuento_pago_id = p_pago_id;

  perform public.recalcular_contrato(v_pago.contrato_id);
end;
$$;

-- Corrige la fecha de un pago que se registró en otra fecha por error (solo el dueño).
-- Reaplica los pagos para que el estado de las cuotas (a tiempo / con atraso) se recalcule.
create or replace function public.editar_fecha_pago(p_pago_id uuid, p_fecha date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pago public.pagos;
begin
  if not public.es_dueno() then
    raise exception 'SIN_PERMISO' using errcode = '42501';
  end if;
  if p_fecha is null or p_fecha > public.hoy_lima() then
    raise exception 'La fecha no puede ser futura.';
  end if;
  select * into v_pago from public.pagos where id = p_pago_id for update;
  if not found then
    raise exception 'El pago no existe.';
  end if;
  if v_pago.anulado then
    raise exception 'Este pago está anulado: no se puede editar.';
  end if;
  if v_pago.fecha_pago = p_fecha then
    return;
  end if;
  update public.pagos set fecha_pago = p_fecha where id = p_pago_id;
  perform public.recalcular_contrato(v_pago.contrato_id);
end;
$$;

-- Cierra un contrato (moto recuperada, acuerdo, etc.). Solo administrador.
create or replace function public.cerrar_contrato(p_contrato_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contrato public.contratos;
begin
  if not public.es_admin() then
    raise exception 'SIN_PERMISO' using errcode = '42501';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Escribe el motivo del cierre.';
  end if;
  select * into v_contrato from public.contratos where id = p_contrato_id for update;
  if not found then
    raise exception 'El contrato no existe.';
  end if;
  if v_contrato.estado <> 'activo' then
    raise exception 'Solo se puede cerrar un contrato activo.';
  end if;

  update public.contratos
  set estado = 'anulado', cerrado_motivo = trim(p_motivo), cerrado_en = now()
  where id = p_contrato_id;

  -- La moto queda libre para un nuevo contrato, salvo que tenga otro préstamo activo
  update public.motos set cliente_id = null
  where id = v_contrato.moto_id
    and not exists (select 1 from public.contratos where moto_id = v_contrato.moto_id and estado = 'activo' and id <> v_contrato.id);
end;
$$;

-- Cambia rol o activa/desactiva un usuario (solo administrador)
create or replace function public.actualizar_usuario(p_id uuid, p_rol public.rol_usuario default null, p_activo boolean default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'SIN_PERMISO' using errcode = '42501';
  end if;
  if exists (select 1 from auth.users where id = p_id and lower(email) = public.correo_dueno()) then
    raise exception 'La cuenta del dueño no se puede desactivar ni cambiar de rol.';
  end if;
  -- nombrar, quitar, desactivar o reactivar a un administrador: solo el dueño
  if (p_rol = 'administrador' or exists (select 1 from public.perfiles where id = p_id and rol = 'administrador'))
     and not public.es_dueno() then
    raise exception 'Solo el dueño puede nombrar o quitar administradores.';
  end if;
  update public.perfiles
  set rol = coalesce(p_rol, rol), activo = coalesce(p_activo, activo),
      puesto = case when coalesce(p_rol, rol) = 'administrador' then null else puesto end
  where id = p_id;
  if not found then
    raise exception 'El usuario no existe.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Editar y eliminar (solo el dueño). Todo queda registrado en la auditoría.
-- ---------------------------------------------------------------------------

-- Editar un contrato: rehace el cronograma con los datos nuevos y vuelve a aplicar
-- los pagos ya registrados (a la cuota más antigua, como siempre).
drop function if exists public.editar_contrato(uuid, numeric, integer, date, numeric, numeric, integer, text);
create or replace function public.editar_contrato(
  p_contrato_id     uuid,
  p_monto_cuota     numeric,
  p_nro_cuotas      integer,
  p_fecha_inicio    date,
  p_precio_total    numeric default null,
  p_inicial         numeric default null,
  p_cuotas_pagadas  integer default null,
  p_observaciones   text default null,
  p_frecuencia      text default null   -- null = la misma de antes
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.contratos;
begin
  if not public.es_admin() then
    raise exception 'SIN_PERMISO' using errcode = '42501';
  end if;
  select * into v_c from public.contratos where id = p_contrato_id for update;
  if not found then
    raise exception 'El contrato no existe.';
  end if;
  if v_c.estado = 'anulado' then
    raise exception 'El contrato está cerrado: no se puede editar.';
  end if;
  if p_monto_cuota is null or p_monto_cuota <= 0 then
    raise exception 'La cuota debe ser mayor a 0.';
  end if;
  if coalesce(p_frecuencia, 'semanal') not in ('diario', 'semanal', 'quincenal', 'mensual') then
    raise exception 'Frecuencia no válida.';
  end if;
  if p_nro_cuotas is null or p_nro_cuotas < 1 or p_nro_cuotas > 1000 then
    raise exception 'El número de cuotas debe estar entre 1 y 1000.';
  end if;
  if p_fecha_inicio is null then
    raise exception 'Elige la fecha de la primera cuota.';
  end if;
  if coalesce(p_cuotas_pagadas, v_c.cuotas_pagadas_inicial) < 0 or coalesce(p_cuotas_pagadas, v_c.cuotas_pagadas_inicial) > p_nro_cuotas then
    raise exception 'Las cuotas ya pagadas no pueden ser más que el número de cuotas.';
  end if;

  update public.contratos
  set monto_cuota = round(p_monto_cuota, 2),
      nro_cuotas = p_nro_cuotas,
      fecha_inicio = p_fecha_inicio,
      precio_total = p_precio_total,
      inicial = p_inicial,
      cuotas_pagadas_inicial = coalesce(p_cuotas_pagadas, cuotas_pagadas_inicial),
      observaciones = nullif(trim(p_observaciones), ''),
      frecuencia = coalesce(p_frecuencia, frecuencia)
  where id = p_contrato_id;

  delete from public.cuotas_base where contrato_id = p_contrato_id;  -- pago_cuota se borra en cascada
  perform public.generar_cuotas(p_contrato_id);
  perform public.recalcular_contrato(p_contrato_id);                 -- reaplica los pagos
end;
$$;

-- Convertir un contrato de vehículo a préstamo (cuando se registró por error como vehículo).
-- Archiva la(s) moto(s) ligadas y deja el contrato como préstamo, sin vehículo. Conserva cuotas y pagos.
create or replace function public.convertir_a_prestamo(p_contrato_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.contratos;
begin
  if not public.es_admin() then
    raise exception 'SIN_PERMISO' using errcode = '42501';
  end if;
  select * into v_c from public.contratos where id = p_contrato_id for update;
  if not found then
    raise exception 'El contrato no existe.';
  end if;
  if v_c.estado = 'anulado' then
    raise exception 'El contrato está cerrado: no se puede editar.';
  end if;
  if v_c.tipo = 'prestamo' then
    return;  -- ya es un préstamo
  end if;
  -- archivar la moto principal y las adicionales de este contrato
  update public.motos
  set archivado = true,
      archivado_en = now(),
      archivado_motivo = coalesce(archivado_motivo, 'Contrato convertido a préstamo'),
      contrato_id = null
  where id = v_c.moto_id or contrato_id = p_contrato_id;
  -- el contrato pasa a préstamo (tipo y moto_id juntos, por la restricción contratos_tipo_moto_check)
  update public.contratos
  set tipo = 'prestamo', moto_id = null
  where id = p_contrato_id;
end;
$$;

-- Eliminar un contrato con sus cuotas y pagos. Devuelve las fotos de pago a borrar del almacenamiento.
create or replace function public.eliminar_contrato(p_contrato_id uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fotos text[];
begin
  if not public.es_admin() then
    raise exception 'SIN_PERMISO' using errcode = '42501';
  end if;
  perform 1 from public.contratos where id = p_contrato_id for update;
  if not found then
    raise exception 'El contrato no existe.';
  end if;
  select coalesce(array_agg(foto_ruta), '{}') into v_fotos from public.pagos where contrato_id = p_contrato_id;
  delete from public.pagos where contrato_id = p_contrato_id;
  delete from public.contratos where id = p_contrato_id;              -- cuotas en cascada
  return v_fotos;
end;
$$;

-- Guarda los datos del contrato impreso llenados en la página (solo el dueño)
create or replace function public.guardar_documento_contrato(p_contrato_id uuid, p_documento jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'SIN_PERMISO' using errcode = '42501';
  end if;
  if p_documento is null or jsonb_typeof(p_documento) <> 'object' or length(p_documento::text) > 20000 then
    raise exception 'Datos del contrato no válidos.';
  end if;
  update public.contratos set documento = p_documento where id = p_contrato_id;
  if not found then
    raise exception 'El contrato no existe.';
  end if;
end;
$$;

-- Archivar: el cliente o el vehículo ya no está en la empresa. Sigue guardado (histórico, auditoría),
-- pero deja de salir en las listas. Solo sin contrato activo. Se puede restaurar.
create or replace function public.archivar(p_tipo text, p_id uuid, p_archivar boolean, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'SIN_PERMISO' using errcode = '42501';
  end if;
  if p_tipo not in ('cliente', 'moto') then
    raise exception 'Tipo no válido.';
  end if;
  if (p_tipo = 'cliente' and not exists (select 1 from public.clientes where id = p_id))
     or (p_tipo = 'moto' and not exists (select 1 from public.motos where id = p_id)) then
    raise exception 'No existe.';
  end if;
  if p_archivar and exists (
    select 1 from public.contratos
    where estado = 'activo' and ((p_tipo = 'cliente' and cliente_id = p_id) or (p_tipo = 'moto' and moto_id = p_id))
  ) then
    raise exception 'Tiene un contrato activo: primero ciérralo (o que termine de pagar) para poder archivarlo.';
  end if;
  if p_tipo = 'cliente' then
    update public.clientes
    set archivado = p_archivar, archivado_en = case when p_archivar then now() end,
        archivado_motivo = case when p_archivar then nullif(trim(p_motivo), '') end
    where id = p_id;
    -- sus vehículos libres se archivan con él
    if p_archivar then
      update public.motos m set archivado = true, archivado_en = now(), archivado_motivo = 'Archivado con su cliente'
      where m.cliente_id = p_id and not m.archivado
        and not exists (select 1 from public.contratos c where c.moto_id = m.id and c.estado = 'activo');
    end if;
  else
    update public.motos
    set archivado = p_archivar, archivado_en = case when p_archivar then now() end,
        archivado_motivo = case when p_archivar then nullif(trim(p_motivo), '') end
    where id = p_id;
  end if;
end;
$$;

-- Eliminar un cliente con TODO lo suyo: contratos, cuotas, pagos, fotos y sus motos libres.
-- Devuelve las fotos a borrar del almacenamiento: {"evidencias": [...], "documentos": [...]}.
create or replace function public.eliminar_cliente(p_cliente_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evidencias text[];
  v_documentos text[];
begin
  if not public.es_admin() then
    raise exception 'SIN_PERMISO' using errcode = '42501';
  end if;
  perform 1 from public.clientes where id = p_cliente_id for update;
  if not found then
    raise exception 'El cliente no existe.';
  end if;
  select coalesce(array_agg(p.foto_ruta), '{}') into v_evidencias
  from public.pagos p join public.contratos c on c.id = p.contrato_id where c.cliente_id = p_cliente_id;
  select coalesce(array_agg(ruta), '{}') into v_documentos from public.documentos where cliente_id = p_cliente_id;

  delete from public.pagos p using public.contratos c where c.id = p.contrato_id and c.cliente_id = p_cliente_id;
  delete from public.contratos where cliente_id = p_cliente_id;
  -- sus motos que ya no tienen ningún contrato (de nadie)
  delete from public.motos m
  where m.cliente_id = p_cliente_id and not exists (select 1 from public.contratos c where c.moto_id = m.id);
  delete from public.clientes where id = p_cliente_id;                -- documentos en cascada; otras motos quedan sin dueño
  return jsonb_build_object('evidencias', to_jsonb(v_evidencias), 'documentos', to_jsonb(v_documentos));
end;
$$;

-- Nombre de empresa comparable: sin tildes, puntos, espacios ni mayúsculas.
-- 'NUÑEZ GROUP EIRL' = 'Nuñez Group E.I.R.L.'. Igual que claveEmpresa() en src/lib/texto.ts.
create or replace function public.clave_empresa(p text)
returns text language sql immutable
set search_path = ''
as $$
  select regexp_replace(translate(lower(coalesce(p, '')), 'áéíóúüñàèìòù', 'aeiouunaeiou'), '[^a-z0-9]', '', 'g');
$$;

-- Importa UNA fila de la plantilla Excel de clientes (solo administrador).
-- Crea o reutiliza cliente (por DNI) y moto (por placa), y crea el contrato con
-- las cuotas ya pagadas según el cuaderno. Devuelve el id del contrato.
create or replace function public.importar_cliente(p_fila jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
-- Una fila de la plantilla (cuaderno) = un contrato. DNI y placa pueden faltar: quedan pendientes
-- y salen en la pantalla "Datos pendientes" para completarlos después.
declare
  v_empresa   uuid;
  v_cliente   public.clientes;
  v_moto      public.motos;
  v_id        uuid;
  v_dni       text := nullif(regexp_replace(coalesce(p_fila ->> 'dni', ''), '\D', '', 'g'), '');
  v_nombres   text := regexp_replace(trim(coalesce(p_fila ->> 'nombres', '')), '\s+', ' ', 'g');
  v_placa     text := nullif(upper(trim(coalesce(p_fila ->> 'placa', ''))), '');
  v_tramite   boolean := false;
  v_celular   text := nullif(regexp_replace(coalesce(p_fila ->> 'celular', ''), '\D', '', 'g'), '');
  v_cuota     numeric := nullif(p_fila ->> 'cuota', '')::numeric;
  v_nro       integer := nullif(p_fila ->> 'nro_cuotas', '')::integer;
  v_inicio    date := nullif(p_fila ->> 'fecha_inicio', '')::date;
  v_pagadas   integer := coalesce(nullif(p_fila ->> 'cuotas_pagadas', '')::integer, 0);
  v_ultimo    date := nullif(p_fila ->> 'ultimo_pago', '')::date;
  v_frec      text := case lower(coalesce(p_fila ->> 'frecuencia', ''))
                        when 'mensual' then 'mensual' when 'quincenal' then 'quincenal'
                        when 'diario' then 'diario' when 'diaria' then 'diario' else 'semanal' end;
  v_nota      text;
begin
  if not public.es_admin() then
    raise exception 'SIN_PERMISO' using errcode = '42501';
  end if;

  select id into v_empresa from public.empresas where public.clave_empresa(nombre) = public.clave_empresa(p_fila ->> 'empresa');
  if v_empresa is null then
    raise exception 'La empresa "%" no existe en el sistema. Revisa el nombre en Configuración.', p_fila ->> 'empresa';
  end if;
  if v_dni is not null and v_dni !~ '^\d{8,12}$' then raise exception 'DNI o Carné de Extranjería inválido.'; end if;
  if v_nombres = '' then raise exception 'Falta el nombre.'; end if;
  if v_celular is not null and v_celular !~ '^9\d{8}$' then v_celular := null; end if;
  if v_cuota is null or v_cuota <= 0 then raise exception 'Falta la cuota.'; end if;
  if v_nro is null then raise exception 'Falta el número de cuotas.'; end if;
  if v_inicio is null then raise exception 'Falta la fecha de la 1.ª cuota.'; end if;

  -- Cliente: por DNI; sin DNI, por nombre (el mismo cliente con 2 motos va en 2 filas)
  if v_dni is not null then
    select * into v_cliente from public.clientes where dni = v_dni;
  end if;
  if v_cliente.id is null then
    select * into v_cliente from public.clientes
    where lower(nombres) = lower(v_nombres) and (v_dni is null or dni is null)
    order by creado_en limit 1;
  end if;
  if v_cliente.id is null then
    insert into public.clientes (empresa_id, nombres, dni, celular, direccion, referencia)
    values (v_empresa, v_nombres, v_dni, v_celular, nullif(trim(p_fila ->> 'direccion'), ''), nullif(trim(p_fila ->> 'referencia'), ''))
    returning * into v_cliente;
  else
    update public.clientes
    set dni = coalesce(dni, v_dni),
        celular = coalesce(celular, v_celular),
        direccion = coalesce(direccion, nullif(trim(p_fila ->> 'direccion'), '')),
        referencia = coalesce(referencia, nullif(trim(p_fila ->> 'referencia'), ''))
    where id = v_cliente.id;
  end if;

  -- La misma fila importada dos veces: mismo cliente, misma 1.ª cuota, misma cuota y n.º de cuotas → se rechaza
  if exists (select 1 from public.contratos
             where cliente_id = v_cliente.id and estado = 'activo' and fecha_inicio = v_inicio
               and monto_cuota = round(v_cuota, 2) and nro_cuotas = v_nro) then
    raise exception 'Esta fila ya se importó (el cliente ya tiene ese mismo contrato).';
  end if;

  -- "EN TRÁMITE" en la columna PLACA no es una placa: la moto queda con la placa en trámite
  if v_placa ~ 'TR[AÁ]MITE' then
    v_placa := null;
    v_tramite := true;
  end if;

  -- Moto: por placa. Si la placa ya es de OTRO cliente con contrato activo, se crea sin placa y se avisa.
  if v_placa is not null then
    select * into v_moto from public.motos where placa = v_placa;
    if v_moto.id is not null and exists (select 1 from public.contratos where moto_id = v_moto.id and estado = 'activo' and cliente_id <> v_cliente.id) then
      v_nota := format('Placa %s anotada en el cuaderno, pero ya es de otro cliente: revisar.', v_placa);
      v_moto := null;
      v_placa := null;
    end if;
  end if;
  if v_moto.id is null then
    insert into public.motos (cliente_id, empresa_id, placa, placa_tramite, tipo, marca, color)
    values (v_cliente.id, v_empresa, v_placa, v_tramite,
            coalesce(nullif(trim(p_fila ->> 'tipo'), ''), 'Otro'),
            coalesce(trim(p_fila ->> 'marca'), ''), coalesce(trim(p_fila ->> 'color'), ''))
    returning * into v_moto;
  elsif v_moto.cliente_id is distinct from v_cliente.id then
    update public.motos set cliente_id = v_cliente.id where id = v_moto.id;
  end if;

  v_id := public.crear_contrato(
    v_cliente.id, v_moto.id, v_cuota, v_nro, v_inicio,
    nullif(p_fila ->> 'precio', '')::numeric, nullif(p_fila ->> 'inicial', '')::numeric,
    least(v_pagadas, v_nro), v_ultimo,
    concat_ws(' · ', 'Importado de cuaderno', nullif(trim(p_fila ->> 'hoja'), ''), v_nota, nullif(trim(p_fila ->> 'observaciones'), '')),
    v_frec
  );
  return v_id;
end;
$$;


-- =============================================================================
-- 5. VISTAS (todas respetan la seguridad por fila: security_invoker)
-- =============================================================================

-- Cronograma con su estado calculado al día de hoy
create or replace view public.cuotas
with (security_invoker = true) as
select
  c.id,
  c.contrato_id,
  c.numero,
  c.fecha_vencimiento,
  c.monto,
  c.monto_pagado,
  c.fecha_pago,
  case
    when c.monto_pagado >= c.monto then
      case when coalesce(c.fecha_pago, c.fecha_vencimiento) <= c.fecha_vencimiento
           then 'pagada_a_tiempo' else 'pagada_con_atraso' end
    when c.fecha_vencimiento < h.hoy then 'vencida'
    else 'pendiente'
  end as estado
from public.cuotas_base c
-- "hoy" se calcula UNA vez por consulta y no por cada cuota ("offset 0" evita que
-- Postgres lo vuelva a meter fila por fila). Con 100 000 cuotas: 0.4 s → milisegundos.
cross join (select public.hoy_lima() as hoy offset 0) h;

-- Una fila por contrato activo con su semáforo.
-- Solo se calculan los contratos activos: los terminados y cerrados (que crecen
-- cada mes) no se recorren, así la vista no se vuelve más lenta con los años.
create or replace view public.v_estado_cliente
with (security_invoker = true) as
with resumen as (
  select
    cu.contrato_id,
    count(*) filter (where cu.estado = 'vencida') as semanas_atraso,
    coalesce(sum(cu.monto - cu.monto_pagado) filter (where cu.estado = 'vencida'), 0) as deuda,
    min(cu.fecha_vencimiento) filter (where cu.estado = 'pendiente') as proxima_cuota,
    min(cu.fecha_vencimiento) filter (where cu.estado = 'vencida') as vencida_desde
  from public.cuotas cu
  join public.contratos ca on ca.id = cu.contrato_id and ca.estado = 'activo'
  group by cu.contrato_id
),
ultimo as (
  select p.contrato_id, max(p.fecha_pago) as fecha
  from public.pagos p
  join public.contratos ca on ca.id = p.contrato_id and ca.estado = 'activo'
  where not p.anulado
  group by p.contrato_id
)
select
  co.id                                  as contrato_id,
  co.cliente_id,
  co.tipo,                               -- 'vehiculo' o 'prestamo' (préstamo de dinero, sin placa)
  cl.nombres                             as cliente,
  cl.dni,
  m.placa,
  cl.celular,
  co.empresa_id,
  e.nombre                               as empresa,
  co.monto_cuota                         as cuota,
  coalesce(r.semanas_atraso, 0)::integer as semanas_atraso,
  coalesce(r.deuda, 0)::numeric(12, 2)   as deuda,
  case
    when coalesce(r.semanas_atraso, 0) = 0 then 'verde'
    when r.semanas_atraso <= 3 then 'amarillo'
    else 'rojo'
  end                                    as color,
  greatest(u.fecha, co.ultimo_pago_inicial) as ultimo_pago,
  r.proxima_cuota,
  cl.direccion,
  cl.ubicacion,                          -- para que el cobrador lo encuentre
  cl.tipo_doc,
  r.vencida_desde,                       -- vencimiento de la cuota impaga más antigua
  -- 4 semanas de deuda (la cuota impaga más antigua venció hace más de 21 días): hay que inmovilizar el vehículo.
  -- Se mide por fecha para que valga igual en contratos diarios, semanales, quincenales y mensuales;
  -- en los semanales coincide con el rojo (4 cuotas vencidas).
  (co.tipo = 'vehiculo' and coalesce(r.vencida_desde < public.hoy_lima() - 21, false)) as inmovilizar,
  cl.celular2,
  -- contrato con varios vehículos: las placas de los demás ("EN TRÁMITE" si aún no sale)
  (select string_agg(coalesce(m2.placa, 'EN TRÁMITE'), ' · ' order by m2.creado_en)
     from public.motos m2 where m2.contrato_id = co.id and m2.id <> co.moto_id) as otras_placas
from public.contratos co
join public.clientes cl on cl.id = co.cliente_id
left join public.motos m on m.id = co.moto_id   -- un préstamo no tiene vehículo
join public.empresas e on e.id = co.empresa_id
left join resumen r on r.contrato_id = co.id
left join ultimo u on u.contrato_id = co.id
where co.estado = 'activo';

-- ¿Quién no paga? De más a menos semanas de atraso
create or replace view public.v_morosos
with (security_invoker = true) as
select * from public.v_estado_cliente
where semanas_atraso > 0
order by semanas_atraso desc, deuda desc;

-- Panel del dueño: SOLO el dueño (Andrés) recibe filas; otro administrador (Elvis) no. Semana = lunes a domingo.
create or replace view public.v_resumen_empresa
with (security_invoker = true) as
with dia as (
  select public.hoy_lima() as hoy
),
semana as (
  select hoy, hoy - (extract(isodow from hoy)::integer - 1) as lunes from dia
),
pagos_vigentes as (
  -- solo los de esta semana (usa el índice por fecha, no todo el historial)
  select co.empresa_id, p.monto, p.fecha_pago
  from public.pagos p
  join public.contratos co on co.id = p.contrato_id
  cross join semana s
  where not p.anulado and co.estado <> 'anulado' and p.fecha_pago between s.lunes and s.hoy
),
esperado as (
  select co.empresa_id, sum(cb.monto) as total
  from public.cuotas_base cb
  join public.contratos co on co.id = cb.contrato_id
  cross join semana s
  where co.estado in ('activo', 'terminado') and cb.fecha_vencimiento between s.lunes and s.lunes + 6
  group by co.empresa_id
),
colores as (
  select empresa_id,
         count(*) filter (where color = 'verde') as verde,
         count(*) filter (where color = 'amarillo') as amarillo,
         count(*) filter (where color = 'rojo') as rojo,
         sum(deuda) as deuda
  from public.v_estado_cliente
  group by empresa_id
)
select
  e.id     as empresa_id,
  e.nombre as empresa,
  coalesce((select sum(pv.monto) from pagos_vigentes pv where pv.empresa_id = e.id and pv.fecha_pago = s.hoy), 0)::numeric(12, 2) as cobrado_hoy,
  coalesce((select sum(pv.monto) from pagos_vigentes pv where pv.empresa_id = e.id and pv.fecha_pago between s.lunes and s.hoy), 0)::numeric(12, 2) as cobrado_semana,
  coalesce(es.total, 0)::numeric(12, 2) as esperado_semana,
  coalesce(c.verde, 0)::integer    as clientes_verde,
  coalesce(c.amarillo, 0)::integer as clientes_amarillo,
  coalesce(c.rojo, 0)::integer     as clientes_rojo,
  coalesce(c.deuda, 0)::numeric(12, 2) as deuda,
  -- clientes registrados (no archivados): los que tienen un contrato con esta empresa,
  -- o los que aún no tienen contrato y están puestos en ella
  (select count(*) from public.clientes cl
    where not coalesce(cl.archivado, false)
      and (exists (select 1 from public.contratos co where co.cliente_id = cl.id and co.empresa_id = e.id and co.estado <> 'anulado')
           or (cl.empresa_id = e.id and not exists (select 1 from public.contratos co where co.cliente_id = cl.id and co.estado <> 'anulado'))))::integer as clientes_registrados,
  (select count(*) from public.motos m where m.empresa_id = e.id and not coalesce(m.archivado, false))::integer as vehiculos,
  -- lo que falta cobrar de los contratos activos (vencido + por vencer)
  coalesce((select sum(cu.monto - cu.monto_pagado) from public.cuotas cu join public.contratos co on co.id = cu.contrato_id
    where co.empresa_id = e.id and co.estado = 'activo'), 0)::numeric(12, 2) as por_cobrar,
  -- clientes registrados en total (un cliente con vehículos en dos empresas cuenta una vez)
  (select count(*) from public.clientes cl where not coalesce(cl.archivado, false))::integer as clientes_total,
  -- ingresos: pagos de cuotas de este mes y de siempre, y las iniciales de los contratos
  coalesce((select sum(p.monto) from public.pagos p join public.contratos co on co.id = p.contrato_id
    where co.empresa_id = e.id and co.estado <> 'anulado' and not p.anulado and p.fecha_pago >= date_trunc('month', s.hoy)::date), 0)::numeric(12, 2) as cobrado_mes,
  coalesce((select sum(p.monto) from public.pagos p join public.contratos co on co.id = p.contrato_id
    where co.empresa_id = e.id and co.estado <> 'anulado' and not p.anulado), 0)::numeric(12, 2) as cobrado_total,
  coalesce((select sum(co.inicial) from public.contratos co where co.empresa_id = e.id and co.estado <> 'anulado'), 0)::numeric(12, 2) as iniciales
from public.empresas e
cross join semana s
left join esperado es on es.empresa_id = e.id
left join colores c on c.empresa_id = e.id
where public.es_dueno()
order by e.nombre;


-- Cobrado vs esperado por semana (lunes a domingo) y empresa: gráfico del panel.
-- Solo el dueño recibe filas. Máximo 26 semanas.
create or replace function public.cobranza_semanal(p_semanas integer default 8)
returns table (semana date, empresa_id uuid, cobrado numeric, esperado numeric)
language sql
stable
set search_path = ''
as $$
  with rango as (
    select h.hoy,
           h.hoy - (extract(isodow from h.hoy)::integer - 1) as lunes,
           h.hoy - (extract(isodow from h.hoy)::integer - 1) - 7 * (greatest(least(p_semanas, 26), 1) - 1) as desde
    from (select public.hoy_lima() as hoy) h
  ),
  semanas as (
    select g::date as semana from rango r, generate_series(r.desde, r.lunes, interval '7 days') g
  ),
  cobrado as (
    select p.fecha_pago - (extract(isodow from p.fecha_pago)::integer - 1) as semana, co.empresa_id, sum(p.monto) as total
    from public.pagos p
    join public.contratos co on co.id = p.contrato_id
    cross join rango r
    where not p.anulado and co.estado <> 'anulado' and p.fecha_pago between r.desde and r.hoy
    group by 1, 2
  ),
  esperado as (
    select cb.fecha_vencimiento - (extract(isodow from cb.fecha_vencimiento)::integer - 1) as semana, co.empresa_id, sum(cb.monto) as total
    from public.cuotas_base cb
    join public.contratos co on co.id = cb.contrato_id
    cross join rango r
    where co.estado in ('activo', 'terminado') and cb.fecha_vencimiento between r.desde and r.lunes + 6
    group by 1, 2
  )
  select s.semana, e.id, coalesce(c.total, 0)::numeric(12, 2), coalesce(x.total, 0)::numeric(12, 2)
  from semanas s
  cross join public.empresas e
  left join cobrado c on c.semana = s.semana and c.empresa_id = e.id
  left join esperado x on x.semana = s.semana and x.empresa_id = e.id
  where public.es_dueno()
  order by s.semana, e.nombre;
$$;


-- Espacio usado por las fotos en Supabase Storage (medidor del panel; solo el dueño).
-- El plan gratis da 1 GB: el panel avisa antes de que se llene.
create or replace function public.uso_fotos()
returns table (bytes bigint, archivos bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0)::bigint, count(*)::bigint
  from storage.objects o
  where o.bucket_id in ('evidencias', 'documentos')
    and public.es_dueno();
$$;


-- =============================================================================
-- 6. CONSULTA PÚBLICA POR DNI (página /consulta, sin iniciar sesión)
--    Devuelve solo nombre, placa, deuda y cronograma. Nunca dirección, celular ni fotos.
-- =============================================================================
create or replace function public.consulta_publica_datos(p_dni text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  -- Un cliente puede tener varias motos: se devuelven TODOS sus contratos activos.
  -- El nombre sale reservado ("Rosa Q. H."): el cliente se reconoce y un extraño
  -- que pruebe DNIs al azar no obtiene el nombre completo.
  -- El cliente NO ve su cronograma (eso es solo del dueño): ve lo que debe hoy, lo que le falta en total,
  -- cuándo y cuánto es su próximo pago, y sus últimos pagos con el saldo que le quedó después de cada uno.
  with cliente as (
    select cl.id, cl.nombres
    from public.clientes cl
    where upper(p_dni) ~ '^[A-Z0-9]{5,12}$' and cl.dni = upper(p_dni)
  ),
  contratos as (
    select co.id, co.monto_cuota, co.frecuencia, co.creado_en, co.nro_cuotas,
           case when co.tipo = 'prestamo' then 'PRÉSTAMO' else m.placa end as placa, m.placa_tramite,
           (select sum(cu.monto) from public.cuotas cu where cu.contrato_id = co.id) as total,
           (select sum(cu.monto_pagado) from public.cuotas cu where cu.contrato_id = co.id) as pagado
    from cliente c
    join public.contratos co on co.cliente_id = c.id and co.estado = 'activo'
    left join public.motos m on m.id = co.moto_id   -- un préstamo no tiene vehículo
  )
  select jsonb_build_object(
    'nombre', (
      select string_agg(case when t.n = 1 then t.palabra else left(t.palabra, 1) || '.' end, ' ' order by t.n)
      from cliente c, regexp_split_to_table(trim(c.nombres), '\s+') with ordinality as t(palabra, n)
    ),
    'contratos', (
      select jsonb_agg(jsonb_build_object(
        'placa', k.placa,
        'cuota', k.monto_cuota,
        'frecuencia', k.frecuencia,
        'nro_cuotas', k.nro_cuotas,
        'tramite', coalesce(k.placa_tramite, false),
        'total', coalesce(k.total, 0),
        'pagado', coalesce(k.pagado, 0),
        'saldo', coalesce(k.total, 0) - coalesce(k.pagado, 0),
        'deuda', coalesce((select sum(cu.monto - cu.monto_pagado) from public.cuotas cu where cu.contrato_id = k.id and cu.estado = 'vencida'), 0),
        'semanas_atraso', (select count(*) from public.cuotas cu where cu.contrato_id = k.id and cu.estado = 'vencida'),
        'proxima_fecha', (select min(cu.fecha_vencimiento) from public.cuotas cu where cu.contrato_id = k.id and cu.estado = 'pendiente'),
        'proxima_monto', (select cu.monto - cu.monto_pagado from public.cuotas cu where cu.contrato_id = k.id and cu.estado = 'pendiente' order by cu.numero limit 1),
        'pagos', coalesce((
          select jsonb_agg(jsonb_build_object('fecha', x.fecha_pago, 'monto', x.monto, 'saldo', x.saldo) order by x.fecha_pago desc, x.creado_en desc)
          from (
            select p.fecha_pago, p.monto, p.creado_en,
                   -- saldo que quedó después de este pago = saldo de hoy + lo pagado después de él
                   (coalesce(k.total, 0) - coalesce(k.pagado, 0))
                     + coalesce(sum(p.monto) over (order by p.fecha_pago desc, p.creado_en desc rows between unbounded preceding and 1 preceding), 0) as saldo
            from public.pagos p
            where p.contrato_id = k.id and not p.anulado
            order by p.fecha_pago desc, p.creado_en desc
            limit 12
          ) x), '[]'::jsonb)
      ) order by k.creado_en)
      from contratos k
    )
  )
  where exists (select 1 from contratos);
$$;

-- Límite de consultas públicas: así nadie puede probar DNIs uno tras otro con un programa.
-- Se guarda solo una huella (hash) de la IP, por 1 día.
create table if not exists public.consulta_intentos (
  huella text not null,
  en     timestamptz not null default now()
);
create index if not exists consulta_intentos_idx on public.consulta_intentos (huella, en);
alter table public.consulta_intentos enable row level security; -- sin políticas: solo la función la toca

create or replace function public.consulta_publica(p_dni text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_h      json := nullif(current_setting('request.headers', true), '')::json;
  v_ip     text := coalesce(nullif(trim(split_part(v_h ->> 'x-forwarded-for', ',', 1)), ''), v_h ->> 'cf-connecting-ip');
  v_huella text := md5('cn-consulta:' || coalesce(v_ip, 'sin-ip'));
  v_limite integer := case when v_ip is null then 300 else 10 end; -- 10 consultas cada 10 minutos por persona
begin
  delete from public.consulta_intentos where en < now() - interval '1 day';
  if (select count(*) from public.consulta_intentos where huella = v_huella and en > now() - interval '10 minutes') >= v_limite then
    raise exception 'DEMASIADAS_CONSULTAS';
  end if;
  insert into public.consulta_intentos (huella) values (v_huella);
  return public.consulta_publica_datos(p_dni);
end;
$$;


-- =============================================================================
-- 7. USUARIOS Y AUDITORÍA
-- =============================================================================

-- Al crear un usuario en Supabase Auth se crea su perfil.
-- El rol y la activación solo se toman de app_metadata, que únicamente puede escribir
-- el servidor (función "usuarios"). Un registro hecho desde fuera queda DESACTIVADO.
create or replace function public.al_crear_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfiles (id, nombre, email, rol, activo)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''), split_part(new.email, '@', 1)),
    coalesce(new.email, ''),
    case when lower(new.email) = public.correo_dueno() then 'administrador'::public.rol_usuario
         else 'cobrador'::public.rol_usuario end,
    -- el dueño queda activo al crearse; los demás solo si los creó el dueño desde la app
    lower(new.email) = public.correo_dueno()
      or coalesce((new.raw_app_meta_data ->> 'creado_por_admin')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.al_crear_usuario();

-- Registro de cambios
create or replace function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.auditoria (usuario_id, accion, tabla, registro_id, detalle)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    v_fila ->> 'id',
    case when tg_op = 'UPDATE' then jsonb_build_object('antes', to_jsonb(old), 'despues', to_jsonb(new)) else v_fila end
  );
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['empresas', 'cuentas', 'perfiles', 'clientes', 'documentos', 'motos', 'contratos', 'pagos'] loop
    execute format('drop trigger if exists auditoria on public.%I', t);
    execute format('create trigger auditoria after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()', t);
  end loop;
end $$;


-- =============================================================================
-- 8. SEGURIDAD POR FILA (RLS)
--    Administrador: todo. Cobrador: ve todo y registra clientes, motos y pagos;
--    no borra, no anula, no ve el panel de dinero ni la auditoría.
--    Público (anon): nada directo; solo la función consulta_publica.
-- =============================================================================
alter table public.empresas    enable row level security;
alter table public.cuentas     enable row level security;
alter table public.perfiles    enable row level security;
alter table public.clientes    enable row level security;
alter table public.documentos  enable row level security;
alter table public.motos       enable row level security;
alter table public.contratos   enable row level security;
alter table public.cuotas_base enable row level security;
alter table public.pagos       enable row level security;
alter table public.pago_cuota  enable row level security;
alter table public.auditoria   enable row level security;
alter table public.reportes_mensuales enable row level security;

do $$
declare r record;
begin
  -- borrar políticas anteriores de estas tablas para poder re-ejecutar el archivo
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('empresas', 'cuentas', 'perfiles', 'clientes', 'documentos', 'motos', 'contratos', 'cuotas_base', 'pagos', 'pago_cuota', 'auditoria', 'reportes_mensuales')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Lectura para todo el personal activo
create policy leer on public.empresas    for select to authenticated using ((select public.es_staff()));
create policy leer on public.cuentas     for select to authenticated using ((select public.es_staff()));
create policy leer on public.perfiles    for select to authenticated using ((select public.es_staff()) or id = (select auth.uid()));
create policy leer on public.clientes    for select to authenticated using ((select public.es_staff()));
create policy leer on public.documentos  for select to authenticated using ((select public.es_staff()));
create policy leer on public.motos       for select to authenticated using ((select public.es_staff()));
create policy leer on public.contratos   for select to authenticated using ((select public.es_staff()));
create policy leer on public.cuotas_base for select to authenticated using ((select public.es_staff()));
create policy leer on public.pagos       for select to authenticated using ((select public.es_staff()));
create policy leer on public.pago_cuota  for select to authenticated using ((select public.es_staff()));
create policy leer on public.auditoria   for select to authenticated using ((select public.es_admin()));
create policy leer on public.reportes_mensuales for select to authenticated using ((select public.es_admin()));
create policy crear on public.reportes_mensuales for insert to authenticated with check ((select public.es_admin()));

-- Empresas y cuentas: solo el administrador las crea o cambia
create policy crear on public.empresas for insert to authenticated with check ((select public.es_admin()));
create policy editar on public.empresas for update to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy borrar on public.empresas for delete to authenticated using ((select public.es_admin()));
create policy crear on public.cuentas for insert to authenticated with check ((select public.es_admin()));
create policy editar on public.cuentas for update to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy borrar on public.cuentas for delete to authenticated using ((select public.es_admin()));

-- Clientes y motos: el personal los crea y edita; solo el administrador borra
-- Clientes y motos: solo el dueño los crea y edita (el cobrador solo cobra y ve quién no paga)
create policy crear on public.clientes for insert to authenticated with check ((select public.es_admin()));
create policy editar on public.clientes for update to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy borrar on public.clientes for delete to authenticated using ((select public.es_admin()));
create policy crear on public.motos for insert to authenticated with check ((select public.es_admin()));
create policy editar on public.motos for update to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy borrar on public.motos for delete to authenticated using ((select public.es_admin()));

-- Documentos del cliente y contratos firmados: los sube el dueño
create policy crear on public.documentos for insert to authenticated with check ((select public.es_admin()));
create policy borrar on public.documentos for delete to authenticated
  using ((select public.es_admin()) or ((select public.es_staff()) and subido_por = (select auth.uid())));

-- contratos, cuotas_base, pagos, pago_cuota: sin escritura directa.
-- Solo cambian a través de crear_contrato, registrar_pago, anular_pago y cerrar_contrato.


-- =============================================================================
-- 9. ALMACENAMIENTO DE FOTOS (buckets privados; se ven con URL firmada de 1 hora)
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('evidencias', 'evidencias', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  -- documentos acepta PDF (DNI, recibos escaneados) sin comprimir: hasta 10 MB
  ('documentos', 'documentos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "cn leer fotos" on storage.objects;
drop policy if exists "cn subir fotos" on storage.objects;
drop policy if exists "cn borrar evidencias" on storage.objects;
drop policy if exists "cn borrar documentos" on storage.objects;

create policy "cn leer fotos" on storage.objects for select to authenticated
  using (bucket_id in ('evidencias', 'documentos') and (select public.es_staff()));

-- Comprobantes de pago: dueño y cobradores. Fotos y documentos del cliente: solo el dueño.
create policy "cn subir fotos" on storage.objects for insert to authenticated
  with check (
    (bucket_id = 'evidencias' and (select public.es_staff()))
    or (bucket_id = 'documentos' and (select public.es_admin()))
  );

-- Una evidencia solo se borra si quien la subió la descarta antes de quedar ligada a un pago
create policy "cn borrar evidencias" on storage.objects for delete to authenticated
  using (
    bucket_id = 'evidencias'
    and ((select public.es_admin()) or ((select public.es_staff()) and owner_id = (select auth.uid())::text))
    and not exists (select 1 from public.pagos p where p.foto_ruta = name)
  );

create policy "cn borrar documentos" on storage.objects for delete to authenticated
  using (
    bucket_id = 'documentos'
    and ((select public.es_admin()) or ((select public.es_staff()) and owner_id = (select auth.uid())::text))
  );


-- Capital prestado e interés de cada contrato (solo administradores; el cliente no lo ve:
-- no sale en la consulta pública ni en el PDF del cronograma). Se activa con un botón en la pantalla.
-- Menos de S/ 2 500: interes_pct = % del capital por mes (20 %). De S/ 2 500 a S/ 12 000: interes_mes = S/ por mes (500).
-- Más de S/ 12 000: interes_pct = % al año (50 %; a 12 meses se calcula por día). GPS: S/ 3 por mes si hay vehículo.
-- El precio total y la cuota se calculan en la pantalla y se pueden corregir. También la fecha de entrega del vehículo.
alter table public.contratos add column if not exists capital numeric(12, 2);
alter table public.contratos add column if not exists interes_pct numeric(6, 2);
alter table public.contratos add column if not exists interes_mes numeric(12, 2);
alter table public.contratos add column if not exists gps_mes numeric(8, 2);
alter table public.contratos add column if not exists fecha_entrega date;
-- Cancelación anticipada: interés de los meses no usados que se descuenta, y el pago con que se canceló
alter table public.contratos add column if not exists descuento numeric(12, 2) not null default 0;
alter table public.contratos add column if not exists descuento_pago_id uuid;
alter table public.contratos drop constraint if exists contratos_descuento_pago_fk;
alter table public.contratos add constraint contratos_descuento_pago_fk foreign key (descuento_pago_id) references public.pagos (id) on delete set null;
alter table public.contratos drop constraint if exists contratos_descuento_check;
alter table public.contratos add constraint contratos_descuento_check check (descuento >= 0);
alter table public.contratos drop constraint if exists contratos_capital_check;
alter table public.contratos add constraint contratos_capital_check check (
  (capital is null or capital > 0)
  and (interes_pct is null or (interes_pct >= 0 and interes_pct <= 500))
  and (interes_mes is null or interes_mes >= 0)
  and (gps_mes is null or gps_mes >= 0)
);

drop function if exists public.guardar_capital(uuid, numeric, numeric);
drop function if exists public.guardar_capital(uuid, numeric, numeric, numeric);
create or replace function public.guardar_capital(
  p_contrato_id uuid, p_capital numeric, p_interes numeric, p_interes_mes numeric default null,
  p_gps_mes numeric default null, p_fecha_entrega date default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'SIN_PERMISO' using errcode = '42501';
  end if;
  if p_capital is not null and p_capital <= 0 then
    raise exception 'El capital debe ser mayor a 0.';
  end if;
  if p_interes is not null and (p_interes < 0 or p_interes > 500) then
    raise exception 'El interés debe estar entre 0 %% y 500 %%.';
  end if;
  if p_interes_mes is not null and p_interes_mes < 0 then
    raise exception 'El interés por mes no puede ser negativo.';
  end if;
  if p_gps_mes is not null and p_gps_mes < 0 then
    raise exception 'El GPS no puede ser negativo.';
  end if;
  update public.contratos
  set capital = round(p_capital, 2), interes_pct = round(p_interes, 2), interes_mes = round(p_interes_mes, 2),
      gps_mes = round(p_gps_mes, 2), fecha_entrega = p_fecha_entrega
  where id = p_contrato_id;
  if not found then
    raise exception 'El contrato no existe.';
  end if;
end;
$$;
revoke all on function public.guardar_capital(uuid, numeric, numeric, numeric, numeric, date) from public, anon;
grant execute on function public.guardar_capital(uuid, numeric, numeric, numeric, numeric, date) to authenticated;

-- Cancelación anticipada (solo administradores): el cliente paga todo de una vez antes del plazo y solo se le
-- cobra el interés de los meses que usó (el monto lo calcula la pantalla y se puede corregir). Se registra el pago
-- con su voucher como cualquier otro; lo que faltaba se descuenta y el contrato queda terminado.
-- Si después se anula ese pago, el descuento se quita y el contrato vuelve a estar activo.
create or replace function public.cancelar_anticipado(
  p_contrato_id uuid, p_monto numeric, p_fecha_pago date, p_medio public.medio_pago,
  p_cuenta_id uuid, p_nro_operacion text, p_foto_ruta text, p_foto_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_saldo numeric;
  v_id    uuid;
begin
  if not public.es_admin() then
    raise exception 'SIN_PERMISO' using errcode = '42501';
  end if;
  perform 1 from public.contratos where id = p_contrato_id and estado = 'activo' for update;
  if not found then
    raise exception 'Este contrato no está activo.';
  end if;
  select coalesce(sum(monto - monto_pagado), 0) into v_saldo from public.cuotas_base where contrato_id = p_contrato_id;
  if p_monto is null or p_monto <= 0 or p_monto > v_saldo then
    raise exception 'El monto para cancelar debe ser mayor a 0 y no más de lo que debe (S/ %).', v_saldo;
  end if;

  select pago_id into v_id
  from public.registrar_pago(p_contrato_id, p_monto, p_fecha_pago, p_medio, p_cuenta_id, p_nro_operacion, p_foto_ruta, p_foto_hash);

  update public.contratos set descuento = round(v_saldo - p_monto, 2), descuento_pago_id = v_id where id = p_contrato_id;
  perform public.recalcular_contrato(p_contrato_id);
  return v_id;
end;
$$;
revoke all on function public.cancelar_anticipado(uuid, numeric, date, public.medio_pago, uuid, text, text, text) from public, anon;
grant execute on function public.cancelar_anticipado(uuid, numeric, date, public.medio_pago, uuid, text, text, text) to authenticated;


-- =============================================================================
-- 10. PERMISOS
-- =============================================================================
-- El público (anon) no ve tablas ni vistas: solo puede llamar a consulta_publica.
revoke all on all tables in schema public from anon;
-- La función "usuarios" (llave service_role) lee el perfil y le pone nombre y puesto.
-- Los proyectos nuevos de Supabase no le dan estos permisos por defecto.
grant select, update on table public.perfiles to service_role;
grant execute on function public.correo_dueno() to service_role; -- la usa la regla "solo el dueño es administrador"
revoke all on function public.recalcular_contrato(uuid) from public, anon, authenticated;
revoke all on function public.al_crear_usuario() from public, anon, authenticated;
revoke all on function public.registrar_auditoria() from public, anon, authenticated;

-- Crear un préstamo de dinero (sin vehículo). Solo el dueño/administrador. Genera el cronograma igual que una venta:
-- por días y cuotas, con la misma frecuencia (diario, semanal, quincenal o mensual).
create or replace function public.crear_prestamo(
  p_cliente_id      uuid,
  p_empresa_id      uuid,
  p_monto_cuota     numeric,
  p_nro_cuotas      integer,
  p_fecha_inicio    date,
  p_precio_total    numeric default null,
  p_inicial         numeric default null,
  p_capital         numeric default null,
  p_interes_pct     numeric default null,
  p_interes_mes     numeric default null,
  p_gps_mes         numeric default null,
  p_frecuencia      text    default 'semanal',
  p_observaciones   text    default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.es_admin() then
    raise exception 'SIN_PERMISO' using errcode = '42501';
  end if;
  if not exists (select 1 from public.clientes where id = p_cliente_id) then
    raise exception 'El cliente no existe.';
  end if;
  if not exists (select 1 from public.empresas where id = p_empresa_id) then
    raise exception 'Elige la empresa.';
  end if;
  if p_monto_cuota is null or p_monto_cuota <= 0 then
    raise exception 'La cuota debe ser mayor a 0.';
  end if;
  if coalesce(p_frecuencia, 'semanal') not in ('diario', 'semanal', 'quincenal', 'mensual') then
    raise exception 'Frecuencia no válida.';
  end if;
  if p_nro_cuotas is null or p_nro_cuotas < 1 or p_nro_cuotas > 1000 then
    raise exception 'El número de cuotas debe estar entre 1 y 1000.';
  end if;
  if p_fecha_inicio is null then
    raise exception 'Elige la fecha de la primera cuota.';
  end if;

  insert into public.contratos (
    cliente_id, moto_id, empresa_id, tipo, monto_cuota, nro_cuotas, fecha_inicio,
    precio_total, inicial, observaciones, frecuencia,
    capital, interes_pct, interes_mes, gps_mes
  ) values (
    p_cliente_id, null, p_empresa_id, 'prestamo', round(p_monto_cuota, 2), p_nro_cuotas, p_fecha_inicio,
    p_precio_total, p_inicial, nullif(trim(p_observaciones), ''), coalesce(p_frecuencia, 'semanal'),
    p_capital, p_interes_pct, p_interes_mes, p_gps_mes
  )
  returning id into v_id;

  perform public.generar_cuotas(v_id);
  perform public.recalcular_contrato(v_id);
  return v_id;
end;
$$;
revoke all on function public.crear_prestamo(uuid, uuid, numeric, integer, date, numeric, numeric, numeric, numeric, numeric, numeric, text, text) from public, anon;
grant execute on function public.crear_prestamo(uuid, uuid, numeric, integer, date, numeric, numeric, numeric, numeric, numeric, numeric, text, text) to authenticated;

revoke all on function public.crear_contrato(uuid, uuid, numeric, integer, date, numeric, numeric, integer, date, text, text) from public, anon;
revoke all on function public.registrar_pago(uuid, numeric, date, public.medio_pago, uuid, text, text, text) from public, anon;
revoke all on function public.anular_pago(uuid, text) from public, anon;
revoke all on function public.editar_fecha_pago(uuid, date) from public, anon;
grant execute on function public.editar_fecha_pago(uuid, date) to authenticated;
revoke all on function public.cerrar_contrato(uuid, text) from public, anon;
revoke all on function public.actualizar_usuario(uuid, public.rol_usuario, boolean) from public, anon;
revoke all on function public.importar_cliente(jsonb) from public, anon;
revoke all on function public.es_staff() from public, anon;
revoke all on function public.es_admin() from public, anon;
revoke all on function public.es_dueno() from public, anon;
grant execute on function public.es_dueno() to authenticated;
revoke all on function public.archivar(text, uuid, boolean, text) from public, anon;
grant execute on function public.archivar(text, uuid, boolean, text) to authenticated;

grant execute on function public.crear_contrato(uuid, uuid, numeric, integer, date, numeric, numeric, integer, date, text, text) to authenticated;
grant execute on function public.registrar_pago(uuid, numeric, date, public.medio_pago, uuid, text, text, text) to authenticated;
revoke all on function public.registrar_pago_anterior(uuid, integer[], date, public.medio_pago, uuid, text, text, text) from public, anon;
grant execute on function public.registrar_pago_anterior(uuid, integer[], date, public.medio_pago, uuid, text, text, text) to authenticated;

-- Pago hecho desde una entidad que no está entre las cuentas (Lemon, Scotiabank…): se anota cuál.
alter table public.pagos add column if not exists entidad_origen text check (entidad_origen is null or length(entidad_origen) <= 60);

-- Anota la entidad de origen de un pago recién registrado (quien lo registró o un administrador).
create or replace function public.anotar_entidad_pago(p_pago_id uuid, p_entidad text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_staff() then
    raise exception 'SIN_PERMISO' using errcode = '42501';
  end if;
  update public.pagos set entidad_origen = left(nullif(trim(p_entidad), ''), 60)
  where id = p_pago_id and not anulado and (registrado_por = auth.uid() or public.es_admin());
end;
$$;
revoke all on function public.anotar_entidad_pago(uuid, text) from public, anon;
grant execute on function public.anotar_entidad_pago(uuid, text) to authenticated;
grant execute on function public.anular_pago(uuid, text) to authenticated;
grant execute on function public.cerrar_contrato(uuid, text) to authenticated;
grant execute on function public.actualizar_usuario(uuid, public.rol_usuario, boolean) to authenticated;
grant execute on function public.importar_cliente(jsonb) to authenticated;
revoke all on function public.generar_cuotas(uuid) from public, anon, authenticated;
revoke all on function public.editar_contrato(uuid, numeric, integer, date, numeric, numeric, integer, text, text) from public, anon;
revoke all on function public.eliminar_contrato(uuid) from public, anon;
revoke all on function public.convertir_a_prestamo(uuid) from public, anon;
grant execute on function public.convertir_a_prestamo(uuid) to authenticated;
revoke all on function public.guardar_documento_contrato(uuid, jsonb) from public, anon;
grant execute on function public.guardar_documento_contrato(uuid, jsonb) to authenticated;
revoke all on function public.eliminar_cliente(uuid) from public, anon;
grant execute on function public.editar_contrato(uuid, numeric, integer, date, numeric, numeric, integer, text, text) to authenticated;
grant execute on function public.eliminar_contrato(uuid) to authenticated;
grant execute on function public.eliminar_cliente(uuid) to authenticated;
grant execute on function public.clave_empresa(text) to authenticated;
revoke all on function public.correo_dueno() from public, anon;
grant execute on function public.correo_dueno() to authenticated;

-- Si el proyecto se creó con "Enable automatic RLS", Supabase agrega esta función;
-- no debe poder llamarse desde la API (el disparador automático sigue funcionando).
do $$
begin
  if exists (select 1 from pg_proc where proname = 'rls_auto_enable' and pronamespace = 'public'::regnamespace) then
    revoke all on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
grant execute on function public.es_staff() to authenticated;
grant execute on function public.es_admin() to authenticated;
grant execute on function public.hoy_lima() to anon, authenticated;
revoke all on function public.consulta_publica_datos(text) from public, anon, authenticated;
grant execute on function public.consulta_publica(text) to anon, authenticated;
revoke all on function public.uso_fotos() from public, anon;
grant execute on function public.uso_fotos() to authenticated;
revoke all on function public.cobranza_semanal(integer) from public, anon;
grant execute on function public.cobranza_semanal(integer) to authenticated;

grant select on public.cuotas, public.v_estado_cliente, public.v_morosos, public.v_resumen_empresa to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;  -- RLS decide qué se puede


-- =============================================================================
-- 11. DATOS INICIALES
--    Las 4 empresas de Andrés con su RUC. Se pueden editar en Configuración.
--    La columna EMPRESA del Excel se compara sin puntos, tildes ni mayúsculas.
-- =============================================================================
-- Si este archivo ya se ejecutó con los nombres provisionales, se renombran
-- (así no quedan 8 empresas).
update public.empresas e
set nombre = v.nuevo
from (values
  ('Inversiones Ane',                  'Inversiones Anne E.I.R.L.'),
  ('Inversiones Comerciales de Arroz', 'Inversiones Comerciales Yarhua E.I.R.L.'),
  ('Empresa 3',                        'Nuñez Group E.I.R.L.'),
  ('Empresa 4',                        'Grupo Comercial Romi S.A.C.')
) as v(viejo, nuevo)
where e.nombre = v.viejo
  and not exists (select 1 from public.empresas x where x.nombre = v.nuevo);

insert into public.empresas (nombre, ruc) values
  ('Inversiones Anne E.I.R.L.',               '20615867161'),
  ('Inversiones Comerciales Yarhua E.I.R.L.', '20613322079'),
  ('Nuñez Group E.I.R.L.',                    '20612130036'),
  ('Grupo Comercial Romi S.A.C.',             '20614675838')
on conflict (nombre) do update set ruc = coalesce(public.empresas.ruc, excluded.ruc);


-- =============================================================================
-- 12. CUENTA DEL DUEÑO
-- -----------------------------------------------------------------------------
--  Supabase → Authentication → Users → Add user → Create new user
--  con el correo de correo_dueno() (nunezgroupeirl@gmail.com) y "Auto Confirm User".
--  Queda como administrador activo automáticamente. Es la ÚNICA cuenta que puede
--  ser administrador; los demás usuarios se crean como cobradores desde la app.
--  IMPORTANTE: en Authentication → Sign In / Providers desactiva
--  "Allow new users to sign up". Así nadie puede registrarse por su cuenta.
-- =============================================================================
