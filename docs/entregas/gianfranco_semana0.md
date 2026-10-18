# Gianfranco · Semana 0 · 2026-10-17

## Terminado
- Proyecto Next.js 15 (App Router, TypeScript, Tailwind 4) con la estructura de “Tus carpetas”.
- `src/components/ui`: Boton, Campo, AreaTexto, Selector, OpcionesBoton, Tabla (tabla en tablet / tarjetas en celular), Modal, Aviso, EtiquetaSemaforo, Tarjeta, Cargando, formato (soles, fechas, mensajes de error en palabras simples), useCarga.
- `src/components/layout`: menú lateral en tablet, menú inferior en celular (+ “Más”), menú según rol, filtro de empresa en la URL (`?empresa=`, hook `useEmpresa()` para Petit), sesión (`useSesion`, `SoloAdmin`).
- Adelantado de las semanas 1–3 (funciona con datos falsos de la misma forma que las vistas/funciones):
  - Login y cierre de sesión.
  - Clientes: lista desde `v_estado_cliente` con búsqueda por nombre/DNI/placa y color; crear/editar; hasta 6 fotos (cliente, DNI, moto, fachada, recibo, otro) comprimidas a ~200 KB; ficha con fotos ampliables, color, deuda, “Registrar pago”, cronograma e historial.
  - Motos (placa, tipo, marca, color, empresa); contrato con `crear_contrato`; cronograma con 4 estados.
  - Pago: monto, fecha, medio, cuenta destino, n.º de operación, foto obligatoria. `src/lib/fotos.ts` calcula SHA-256 de la original antes de comprimir, sube a `evidencias` y manda ruta + hash a `registrar_pago`. Si rechaza, borra la foto y muestra el error en palabras simples.
  - Historial de pagos con foto y quién registró; anular con motivo (solo admin); usuarios (crear, desactivar, cambiar rol).
  - Espacio en la ficha para “PDF del cronograma” (componente de Petit ya conectado).

## Pendiente
- Probar contra la base real de Jefferson (v1 el lun 19) y ajustar nombres de columnas.
- Revisar en tablet y celular reales.

## Cómo probarlo
1. `npm install && npm run dev`. Sin `.env.local` entra en **modo prueba**.
2. Entrar con `admin@prueba.pe / admin123`: ver menú completo. Luego `cobrador@prueba.pe / cobrador123`: sin Panel, Reportes ni Usuarios.
3. Clientes → buscar “1234ab” → ficha. “+ Nuevo cliente” → fotos → “Guardar y crear contrato” → moto nueva → crear → ver cronograma.
4. Pagar → elegir cliente → Yape, n.º 555, foto → Registrar. Repetir con el mismo n.º → “Este número de operación ya se registró.”
5. Usuarios → “Reiniciar datos de prueba” para volver al inicio.

## Qué uso de la base de datos
- Vistas: `v_estado_cliente`.
- Funciones: `crear_contrato`, `registrar_pago`, `anular_pago`, función de servidor `usuarios`.
- Tablas (lectura/escritura): `clientes`, `documentos`, `motos`, `contratos`, `cuotas`, `pagos`, `perfiles`, `empresas`, `cuentas`.
- Buckets: `evidencias`, `documentos` (ruta `empresa_id/cliente_id/archivo.jpg`).

## Necesito de Jefferson
- Esta base trae **provisionales** en tus carpetas: `src/lib/supabase/` (acceso a datos + modo prueba) y `src/types/database.ts`. Reemplázalos o adáptalos; las pantallas solo usan `getDatos()`.
- Confirmar nombres de tablas/columnas (ver `src/types/database.ts`), sobre todo `pagos.registrado_por` → `perfiles`, `documentos(tipo, ruta)` y `cuentas(medio, activa)`.
- `registrar_pago` debe devolver los códigos `OPERACION_REPETIDA`, `IMAGEN_REPETIDA`, `MONTO_INVALIDO`, `SIN_FOTO` dentro del mensaje de error.
- Middleware de protección de rutas (por ahora la sesión se verifica en el cliente).
- **Librerías para aprobar:** `@supabase/supabase-js` (base) y `qrcode` (lo usa Petit en `/qr`). No se agregó nada más: Excel, PDF, compresión y SHA-256 están hechos sin librerías.
