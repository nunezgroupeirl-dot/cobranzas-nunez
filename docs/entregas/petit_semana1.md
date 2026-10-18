# Petit · Semana 1 · 2026-10-24

## Terminado
- **¿Quién no paga?** (`/morosos`) desde `v_morosos`: placa, cliente, celular (llamar / WhatsApp directo), semanas de atraso con color, deuda y último pago. Filtros por empresa (mismo `?empresa=`) y por color. Botón “Copiar para WhatsApp” y “Descargar Excel”.
- `src/lib/exportar.ts`: texto para WhatsApp, copiar (funciona también en http), y Excel `.xlsx` generado **sin librerías** (probado: abre en Excel/LibreOffice sin errores).
- **Panel del dueño** (`/panel`, solo admin) desde `v_resumen_empresa`: cobrado hoy y en la semana, avance contra lo esperado, clientes por color, tabla por empresa con enlace a sus morosos.
- **Consulta pública** (`/consulta`, sin sesión) con `consulta_publica`: deuda, semanas de atraso y cronograma. No muestra dirección, celular ni fotos. Acepta `?dni=`.
- **Página QR** (`/qr`) tamaño A4 para imprimir, con el logo (`public/logo.png`) y el QR a `/consulta`.
- **PDF del cronograma** en `src/components/reportes/PdfCronograma.tsx` (abre la vista de impresión → “Guardar como PDF”). Ya está colocado en la ficha del cliente y en la vista del contrato.
- **Reportes** (`/reportes`, solo admin): Excel de clientes y Excel de pagos por rango de fechas.

## Pendiente
- Probar con la base de Jefferson (vistas el mié 28, `consulta_publica` el mié 4).
- Poner el logo real en `public/logo.png` cuando Andrés lo mande.

## Cómo probarlo
1. `npm run dev`, entrar con `admin@prueba.pe / admin123`.
2. Morosos → filtrar 🔴 → “Copiar para WhatsApp” y pegar en un chat. “Descargar Excel” y abrirlo.
3. Panel → ver cifras; registrar un pago y volver: “Cobrado hoy” sube.
4. Cerrar sesión, abrir `/consulta` y escribir `45879632` (cliente de prueba).
5. `/qr` → Imprimir.

## Qué uso de la base de datos
- Vistas: `v_morosos`, `v_resumen_empresa`, `v_estado_cliente` (reporte de clientes).
- Funciones: `consulta_publica`.
- Tablas (solo lectura, para el Excel de pagos): `pagos`, `contratos`, `clientes`, `motos`, `cuentas`.

## Necesito de Jefferson
- Aprobar la librería `qrcode` (para `/qr`). Excel y PDF no usan librerías.
- Que `consulta_publica` sea accesible con la llave anon (página pública) y que **no** devuelva dirección, celular ni fotos.
- Confirmar columnas de la plantilla Excel (`docs/Plantilla_clientes_Cobranzas_Nunez.xlsx`) para el importador.
