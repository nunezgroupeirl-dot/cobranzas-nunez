-- =============================================================================
--  COBRANZAS NÚÑEZ · Esquema completo de la base de datos (Supabase / PostgreSQL)
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
--    · Lo registrado hasta las 10:00 p.m. (Lima) cuenta para ese día.
-- =============================================================================


-- =============================================================================
-- 1. TIPOS
-- =============================================================================
do $$ begin create type public.rol_usuario as enum ('administrador', 'cobrador');
exception when duplicate_object then null; end $$;

do $$ begin create type public.medio_pago as enum ('yape', 'plin', 'banco', 'agente', 'efectivo');
exception when duplicate_object then null; end $$;

do $$ begin create type public.tipo_documento as enum ('cliente', 'dni', 'moto', 'fachada', 'recibo', 'otro');
exception when duplicate_object then null; end $$;

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

-- Usuarios del sistema (uno por cada usuario de Supabase Auth)
create table if not exists public.perfiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nombre     text not null,
  email      text not null,
  rol        public.rol_usuario not null default 'cobrador',
  activo     boolean not null default false,
  creado_en  timestamptz not null default now()
);

-- (La regla "solo el dueño es administrador" se agrega más abajo, cuando ya existe correo_dueno().)

create table if not exists public.clientes (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas (id) on delete restrict,
  nombres     text not null check (length(trim(nombres)) > 0),
  dni         text not null unique check (dni ~ '^\d{8}$'),
  celular     text check (celular is null or celular ~ '^9\d{8}$'),
  direccion   text,
  referencia  text,
  creado_en   timestamptz not null default now()
);
create index if not exists clientes_empresa_idx on public.clientes (empresa_id);

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

create table if not exists public.motos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid references public.clientes (id) on delete set null,
  empresa_id  uuid not null references public.empresas (id) on delete restrict,
  placa       text not null unique check (length(placa) > 0 and placa = upper(trim(placa))),
  tipo        text not null default 'Otro',
  marca       text not null default '',
  color       text not null default '',
  creado_en   timestamptz not null default now()
);
create index if not exists motos_cliente_idx on public.motos (cliente_id);

create table if not exists public.contratos (
  id                      uuid primary key default gen_random_uuid(),
  cliente_id              uuid not null references public.clientes (id) on delete restrict,
  moto_id                 uuid not null references public.motos (id) on delete restrict,
  empresa_id              uuid not null references public.empresas (id) on delete restrict,
  monto_cuota             numeric(10, 2) not null check (monto_cuota > 0),
  nro_cuotas              integer not null check (nro_cuotas between 1 and 260),
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
-- Una moto solo puede tener un contrato activo
create unique index if not exists contratos_moto_activa_uq on public.contratos (moto_id) where estado = 'activo';

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


-- =============================================================================
-- 3. FUNCIONES DE APOYO
-- =============================================================================

-- Fecha operativa en Lima: después de las 10:00 p.m. cuenta para el día siguiente
create or replace function public.hoy_lima()
returns date
language sql
stable
set search_path = ''
as $$
  select case
    when extract(hour from (now() at time zone 'America/Lima')) * 60
       + extract(minute from (now() at time zone 'America/Lima')) > 22 * 60
    then (now() at time zone 'America/Lima')::date + 1
    else (now() at time zone 'America/Lima')::date
  end;
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

-- ¿El usuario conectado es el dueño (administrador activo con el correo del dueño)?
-- El correo se toma de auth.users: nadie puede cambiárselo desde la app.
create or replace function public.es_admin()
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
    where p.id = auth.uid()
      and p.activo
      and p.rol = 'administrador'
      and lower(u.email) = public.correo_dueno()
  );
$$;

-- Defensa en la propia tabla: aunque alguien intente un UPDATE directo,
-- ningún perfil que no sea el del dueño puede tener rol administrador.
update public.perfiles set rol = 'cobrador' where rol = 'administrador' and lower(email) <> public.correo_dueno();
alter table public.perfiles drop constraint if exists solo_el_dueno_es_administrador;
alter table public.perfiles add constraint solo_el_dueno_es_administrador
  check (rol <> 'administrador' or lower(email) = public.correo_dueno());


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
  r_pago     record;
  r_cuota    record;
begin
  select cuotas_pagadas_inicial, estado into v_inicial, v_estado
  from public.contratos where id = p_contrato_id for update;
  if not found then
    raise exception 'El contrato no existe.';
  end if;

  delete from public.pago_cuota pc
  using public.cuotas_base cb
  where pc.cuota_id = cb.id and cb.contrato_id = p_contrato_id;

  update public.cuotas_base
  set monto_pagado = case when numero <= v_inicial then monto else 0 end,
      fecha_pago = null
  where contrato_id = p_contrato_id;

  for r_pago in
    select id, monto, fecha_pago from public.pagos
    where contrato_id = p_contrato_id and not anulado
    order by fecha_pago, creado_en, id
  loop
    v_resto := r_pago.monto;
    for r_cuota in
      select id, monto, monto_pagado from public.cuotas_base
      where contrato_id = p_contrato_id and monto_pagado < monto
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
  insert into public.cuotas_base (contrato_id, numero, fecha_vencimiento, monto)
  select c.id, n, c.fecha_inicio + (n - 1) * 7, c.monto_cuota
  from public.contratos c, generate_series(1, c.nro_cuotas) as n
  where c.id = p_contrato_id;
$$;

-- Crea el contrato y genera todas sus cuotas semanales
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
  p_observaciones   text default null
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
  if not public.es_staff() then
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
  if exists (select 1 from public.contratos where moto_id = p_moto_id and estado = 'activo') then
    raise exception 'Esa moto ya tiene un contrato activo.';
  end if;
  if p_monto_cuota is null or p_monto_cuota <= 0 then
    raise exception 'La cuota semanal debe ser mayor a 0.';
  end if;
  if p_nro_cuotas is null or p_nro_cuotas < 1 or p_nro_cuotas > 260 then
    raise exception 'El número de cuotas debe estar entre 1 y 260.';
  end if;
  if p_fecha_inicio is null then
    raise exception 'Elige la fecha de la primera cuota.';
  end if;
  if coalesce(p_cuotas_pagadas, 0) < 0 or coalesce(p_cuotas_pagadas, 0) > p_nro_cuotas then
    raise exception 'Las cuotas ya pagadas no pueden ser más que el número de cuotas.';
  end if;

  insert into public.contratos (
    cliente_id, moto_id, empresa_id, monto_cuota, nro_cuotas, fecha_inicio,
    precio_total, inicial, cuotas_pagadas_inicial, ultimo_pago_inicial, observaciones
  ) values (
    p_cliente_id, p_moto_id, v_moto.empresa_id, round(p_monto_cuota, 2), p_nro_cuotas, p_fecha_inicio,
    p_precio_total, p_inicial, coalesce(p_cuotas_pagadas, 0), p_ultimo_pago, nullif(trim(p_observaciones), '')
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

  -- La moto queda libre para un nuevo contrato
  update public.motos set cliente_id = null where id = v_contrato.moto_id;
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
  if p_rol = 'administrador' then
    raise exception 'Solo el dueño puede ser administrador.';
  end if;
  update public.perfiles
  set rol = coalesce(p_rol, rol), activo = coalesce(p_activo, activo)
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
create or replace function public.editar_contrato(
  p_contrato_id     uuid,
  p_monto_cuota     numeric,
  p_nro_cuotas      integer,
  p_fecha_inicio    date,
  p_precio_total    numeric default null,
  p_inicial         numeric default null,
  p_cuotas_pagadas  integer default null,
  p_observaciones   text default null
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
    raise exception 'La cuota semanal debe ser mayor a 0.';
  end if;
  if p_nro_cuotas is null or p_nro_cuotas < 1 or p_nro_cuotas > 260 then
    raise exception 'El número de cuotas debe estar entre 1 y 260.';
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
      observaciones = nullif(trim(p_observaciones), '')
  where id = p_contrato_id;

  delete from public.cuotas_base where contrato_id = p_contrato_id;  -- pago_cuota se borra en cascada
  perform public.generar_cuotas(p_contrato_id);
  perform public.recalcular_contrato(p_contrato_id);                 -- reaplica los pagos
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
declare
  v_empresa   uuid;
  v_cliente   public.clientes;
  v_moto      public.motos;
  v_dni       text := regexp_replace(coalesce(p_fila ->> 'dni', ''), '\D', '', 'g');
  v_placa     text := upper(trim(coalesce(p_fila ->> 'placa', '')));
  v_celular   text := nullif(regexp_replace(coalesce(p_fila ->> 'celular', ''), '\D', '', 'g'), '');
  v_cuota     numeric := nullif(p_fila ->> 'cuota', '')::numeric;
  v_nro       integer := nullif(p_fila ->> 'nro_cuotas', '')::integer;
  v_inicio    date := nullif(p_fila ->> 'fecha_inicio', '')::date;
  v_pagadas   integer := coalesce(nullif(p_fila ->> 'cuotas_pagadas', '')::integer, 0);
  v_ultimo    date := nullif(p_fila ->> 'ultimo_pago', '')::date;
begin
  if not public.es_admin() then
    raise exception 'SIN_PERMISO' using errcode = '42501';
  end if;

  select id into v_empresa from public.empresas where public.clave_empresa(nombre) = public.clave_empresa(p_fila ->> 'empresa');
  if v_empresa is null then
    raise exception 'La empresa "%" no existe en el sistema. Revisa el nombre en Configuración.', p_fila ->> 'empresa';
  end if;
  if v_dni !~ '^\d{8}$' then raise exception 'DNI inválido.'; end if;
  if v_placa = '' then raise exception 'Falta la placa.'; end if;
  if coalesce(trim(p_fila ->> 'nombres'), '') = '' then raise exception 'Falta el nombre.'; end if;
  if v_celular is not null and v_celular !~ '^9\d{8}$' then v_celular := null; end if;
  if v_cuota is null or v_cuota <= 0 then raise exception 'Falta la cuota semanal.'; end if;
  if v_nro is null then raise exception 'Falta el número de cuotas.'; end if;
  if v_inicio is null then raise exception 'Falta la fecha de la 1.ª cuota.'; end if;

  -- Cliente (si ya existe por DNI, se reutiliza y se completan datos vacíos)
  select * into v_cliente from public.clientes where dni = v_dni;
  if not found then
    insert into public.clientes (empresa_id, nombres, dni, celular, direccion, referencia)
    values (v_empresa, trim(p_fila ->> 'nombres'), v_dni, v_celular,
            nullif(trim(p_fila ->> 'direccion'), ''), nullif(trim(p_fila ->> 'referencia'), ''))
    returning * into v_cliente;
  else
    update public.clientes
    set celular = coalesce(celular, v_celular),
        direccion = coalesce(direccion, nullif(trim(p_fila ->> 'direccion'), '')),
        referencia = coalesce(referencia, nullif(trim(p_fila ->> 'referencia'), ''))
    where id = v_cliente.id;
  end if;

  -- Moto (si ya existe por placa, se reutiliza)
  select * into v_moto from public.motos where placa = v_placa;
  if not found then
    insert into public.motos (cliente_id, empresa_id, placa, tipo, marca, color)
    values (v_cliente.id, v_empresa, v_placa,
            coalesce(nullif(trim(p_fila ->> 'tipo'), ''), 'Otro'),
            coalesce(trim(p_fila ->> 'marca'), ''), coalesce(trim(p_fila ->> 'color'), ''))
    returning * into v_moto;
  elsif exists (select 1 from public.contratos where moto_id = v_moto.id and estado = 'activo') then
    raise exception 'La placa % ya tiene un contrato activo (¿fila importada dos veces?).', v_placa;
  elsif v_moto.cliente_id is distinct from v_cliente.id then
    update public.motos set cliente_id = v_cliente.id where id = v_moto.id;
  end if;

  return public.crear_contrato(
    v_cliente.id, v_moto.id, v_cuota, v_nro, v_inicio, null, null, v_pagadas, v_ultimo,
    concat_ws(' · ',
      nullif('Importado de cuaderno', ''),
      case when lower(coalesce(p_fila ->> 'frecuencia', '')) = 'diario' then 'Pagaba diario' end,
      nullif(trim(p_fila ->> 'observaciones'), ''))
  );
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
    min(cu.fecha_vencimiento) filter (where cu.estado = 'pendiente') as proxima_cuota
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
  r.proxima_cuota
from public.contratos co
join public.clientes cl on cl.id = co.cliente_id
join public.motos m on m.id = co.moto_id
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

-- Panel del dueño (solo administrador). Semana = lunes a domingo.
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
  coalesce(c.deuda, 0)::numeric(12, 2) as deuda
from public.empresas e
cross join semana s
left join esperado es on es.empresa_id = e.id
left join colores c on c.empresa_id = e.id
where public.es_admin()
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
  where public.es_admin()
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
    and public.es_admin();
$$;


-- =============================================================================
-- 6. CONSULTA PÚBLICA POR DNI (página /consulta, sin iniciar sesión)
--    Devuelve solo nombre, placa, deuda y cronograma. Nunca dirección, celular ni fotos.
-- =============================================================================
create or replace function public.consulta_publica(p_dni text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  -- Un cliente puede tener varias motos: se devuelven TODOS sus contratos activos.
  -- El nombre sale reservado ("Rosa Q. H."): el cliente se reconoce y un extraño
  -- que pruebe DNIs al azar no obtiene el nombre completo.
  with cliente as (
    select cl.id, cl.nombres
    from public.clientes cl
    where p_dni ~ '^\d{8}$' and cl.dni = p_dni
  ),
  contratos as (
    select co.id, co.monto_cuota, co.creado_en, m.placa
    from cliente c
    join public.contratos co on co.cliente_id = c.id and co.estado = 'activo'
    join public.motos m on m.id = co.moto_id
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
        'deuda', coalesce((select sum(cu.monto - cu.monto_pagado) from public.cuotas cu where cu.contrato_id = k.id and cu.estado = 'vencida'), 0),
        'semanas_atraso', (select count(*) from public.cuotas cu where cu.contrato_id = k.id and cu.estado = 'vencida'),
        'cuotas', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'numero', cu.numero,
                   'fecha_vencimiento', cu.fecha_vencimiento,
                   'monto', cu.monto,
                   'monto_pagado', cu.monto_pagado,
                   'fecha_pago', cu.fecha_pago,
                   'estado', cu.estado) order by cu.numero)
          from public.cuotas cu where cu.contrato_id = k.id), '[]'::jsonb)
      ) order by k.creado_en)
      from contratos k
    )
  )
  where exists (select 1 from contratos);
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

do $$
declare r record;
begin
  -- borrar políticas anteriores de estas tablas para poder re-ejecutar el archivo
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('empresas', 'cuentas', 'perfiles', 'clientes', 'documentos', 'motos', 'contratos', 'cuotas_base', 'pagos', 'pago_cuota', 'auditoria')
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

-- Empresas y cuentas: solo el administrador las crea o cambia
create policy crear on public.empresas for insert to authenticated with check ((select public.es_admin()));
create policy editar on public.empresas for update to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy borrar on public.empresas for delete to authenticated using ((select public.es_admin()));
create policy crear on public.cuentas for insert to authenticated with check ((select public.es_admin()));
create policy editar on public.cuentas for update to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy borrar on public.cuentas for delete to authenticated using ((select public.es_admin()));

-- Clientes y motos: el personal los crea y edita; solo el administrador borra
create policy crear on public.clientes for insert to authenticated with check ((select public.es_staff()));
create policy editar on public.clientes for update to authenticated using ((select public.es_staff())) with check ((select public.es_staff()));
create policy borrar on public.clientes for delete to authenticated using ((select public.es_admin()));
create policy crear on public.motos for insert to authenticated with check ((select public.es_staff()));
create policy editar on public.motos for update to authenticated using ((select public.es_staff())) with check ((select public.es_staff()));
create policy borrar on public.motos for delete to authenticated using ((select public.es_admin()));

-- Documentos: el personal los sube; los borra el administrador o quien los subió
create policy crear on public.documentos for insert to authenticated with check ((select public.es_staff()));
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
  ('documentos', 'documentos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "cn leer fotos" on storage.objects;
drop policy if exists "cn subir fotos" on storage.objects;
drop policy if exists "cn borrar evidencias" on storage.objects;
drop policy if exists "cn borrar documentos" on storage.objects;

create policy "cn leer fotos" on storage.objects for select to authenticated
  using (bucket_id in ('evidencias', 'documentos') and (select public.es_staff()));

create policy "cn subir fotos" on storage.objects for insert to authenticated
  with check (bucket_id in ('evidencias', 'documentos') and (select public.es_staff()));

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


-- =============================================================================
-- 10. PERMISOS
-- =============================================================================
-- El público (anon) no ve tablas ni vistas: solo puede llamar a consulta_publica.
revoke all on all tables in schema public from anon;
revoke all on function public.recalcular_contrato(uuid) from public, anon, authenticated;
revoke all on function public.al_crear_usuario() from public, anon, authenticated;
revoke all on function public.registrar_auditoria() from public, anon, authenticated;

revoke all on function public.crear_contrato(uuid, uuid, numeric, integer, date, numeric, numeric, integer, date, text) from public, anon;
revoke all on function public.registrar_pago(uuid, numeric, date, public.medio_pago, uuid, text, text, text) from public, anon;
revoke all on function public.anular_pago(uuid, text) from public, anon;
revoke all on function public.cerrar_contrato(uuid, text) from public, anon;
revoke all on function public.actualizar_usuario(uuid, public.rol_usuario, boolean) from public, anon;
revoke all on function public.importar_cliente(jsonb) from public, anon;
revoke all on function public.es_staff() from public, anon;
revoke all on function public.es_admin() from public, anon;

grant execute on function public.crear_contrato(uuid, uuid, numeric, integer, date, numeric, numeric, integer, date, text) to authenticated;
grant execute on function public.registrar_pago(uuid, numeric, date, public.medio_pago, uuid, text, text, text) to authenticated;
grant execute on function public.anular_pago(uuid, text) to authenticated;
grant execute on function public.cerrar_contrato(uuid, text) to authenticated;
grant execute on function public.actualizar_usuario(uuid, public.rol_usuario, boolean) to authenticated;
grant execute on function public.importar_cliente(jsonb) to authenticated;
revoke all on function public.generar_cuotas(uuid) from public, anon, authenticated;
revoke all on function public.editar_contrato(uuid, numeric, integer, date, numeric, numeric, integer, text) from public, anon;
revoke all on function public.eliminar_contrato(uuid) from public, anon;
revoke all on function public.eliminar_cliente(uuid) from public, anon;
grant execute on function public.editar_contrato(uuid, numeric, integer, date, numeric, numeric, integer, text) to authenticated;
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
