# Lista de pruebas · Cobranzas Núñez

Correr en **tablet (10")** y en **celular**, con el usuario **administrador** y con el **cobrador**. Anotar cada falla en el grupo con: número de caso, equipo, usuario y qué pasó.

| N.º | Regla | Pasos | Resultado esperado | Tablet | Celular |
|---|---|---|---|---|---|
| 1 | Ingreso | Entrar con admin y luego con cobrador | Cada uno entra; ve su nombre y rol | ☐ | ☐ |
| 2 | Ingreso | Contraseña equivocada | Mensaje “Correo o contraseña incorrectos.” | ☐ | ☐ |
| 3 | Roles | Ver el menú con cobrador | No aparecen Panel, Reportes ni Usuarios | ☐ | ☐ |
| 4 | Roles | Con cobrador, escribir `/panel` en la barra | “Esta pantalla es solo para el administrador.” | ☐ | ☐ |
| 5 | Roles | Con cobrador, ver historial de pagos de un cliente | No aparece el botón “Anular” | ☐ | ☐ |
| 6 | Filtro empresa | Elegir “Empresa 2” y pasar de Clientes a Morosos | El filtro se mantiene (`?empresa=` en la URL) | ☐ | ☐ |
| 7 | Búsqueda | Buscar por placa sin guion (`1234ab`) | Aparece el cliente con placa 1234-AB | ☐ | ☐ |
| 8 | Búsqueda | Buscar por DNI y por nombre sin tildes | Encuentra al cliente | ☐ | ☐ |
| 9 | Semáforo | Cliente al día / con 2 semanas / con 5 semanas | Verde · Amarillo · Rojo | ☐ | ☐ |
| 10 | Cliente | Crear cliente con DNI de 7 números | No deja guardar: “El DNI debe tener 8 números.” | ☐ | ☐ |
| 11 | Cliente | Crear cliente con DNI que ya existe | “Ya existe un cliente con ese DNI.” | ☐ | ☐ |
| 12 | Fotos | Subir 6 fotos a un cliente | Acepta 6; ya no deja agregar la 7.ª | ☐ | ☐ |
| 13 | Fotos | Tocar una foto en la ficha | Se amplía | ☐ | ☐ |
| 14 | Contrato | Cliente nuevo → moto → contrato de 52 cuotas | Aparece el cronograma con 52 cuotas semanales | ☐ | ☐ |
| 15 | Contrato | Crear contrato con una moto que ya tiene contrato activo | No aparece en la lista de motos libres | ☐ | ☐ |
| 16 | Pagos | Registrar pago de 1 cuota con Yape y foto | “Pago registrado · cubre la cuota N.º …” | ☐ | ☐ |
| 17 | Pagos | Pago que cubre 2 cuotas atrasadas | Se aplica a las 2 cuotas más antiguas | ☐ | ☐ |
| 18 | Pagos | Pagar tarde una cuota | En el cronograma sale amarilla con la fecha real | ☐ | ☐ |
| 19 | Evidencia | Intentar registrar sin foto | No deja: “La foto es obligatoria.” | ☐ | ☐ |
| 20 | Evidencia | Pago en efectivo | No pide n.º de operación; sí pide foto | ☐ | ☐ |
| 21 | Repetidos | Mismo n.º de operación en otro pago | “Este número de operación ya se registró.” | ☐ | ☐ |
| 22 | Repetidos | Misma foto en otro pago (n.º distinto) | “Esta foto ya se usó en otro pago.” | ☐ | ☐ |
| 23 | Monto | Monto mayor que todo lo que debe | “El monto no es válido…” | ☐ | ☐ |
| 24 | Anular | Admin anula un pago con motivo | Sale ANULADO con el motivo; la cuota vuelve a pendiente/vencida | ☐ | ☐ |
| 25 | Anular | Después de anular, registrar el mismo n.º de operación | Ahora sí lo acepta | ☐ | ☐ |
| 26 | Hora de corte | Registrar un pago a las 10:30 p.m. | La fecha propuesta es la de mañana | ☐ | ☐ |
| 27 | Morosos | Abrir ¿Quién no paga? | Ordenado de más a menos semanas | ☐ | ☐ |
| 28 | Morosos | “Copiar para WhatsApp” y pegar en un chat | Lista legible con placa, celular, semanas y deuda | ☐ | ☐ |
| 29 | Excel | Descargar morosos, clientes y pagos por fechas | Abre en Excel sin error | ☐ | ☐ |
| 30 | Panel | Registrar un pago y abrir el panel | “Cobrado hoy” sube en ese monto | ☐ | ☐ |
| 31 | Consulta pública | En `/consulta`, DNI de un cliente | Ve deuda, semanas y cronograma; **no** ve dirección, celular ni fotos | ☐ | ☐ |
| 32 | Consulta pública | DNI que no existe | “No encontramos un contrato activo…” | ☐ | ☐ |
| 33 | QR | Imprimir `/qr` en A4 y escanearlo con un celular | Abre la consulta | ☐ | ☐ |
| 34 | PDF | “PDF del cronograma” en la ficha | Se abre para imprimir/guardar como PDF | ☐ | ☐ |
| 35 | Pantallas | Revisar todas en tablet horizontal y vertical y en celular | Nada cortado, botones fáciles de tocar | ☐ | ☐ |
