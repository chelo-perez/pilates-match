# Ficha de Play Store y formularios de Play Console

Todo lo que pide Play Console, listo para copiar. Cuenta de desarrollador: **Tecnología Más Fácil S.A.S.** (organización).

## Datos de la app

- **Nombre de la app:** Trabajo Más Fácil
- **Idioma predeterminado:** Español (Latinoamérica) – es-419
- **App o juego:** App
- **Gratis o paga:** Gratis
- **Paquete:** `ar.com.masfacil.trabajo`

## Ficha de la tienda

**Nombre** (máx. 30): `Trabajo Más Fácil`

**Descripción corta** (máx. 80):
`Reemplazos y clases regulares con instructores verificados por tu Cámara.`

**Descripción completa** (máx. 4000):

```
Trabajo Más Fácil conecta estudios de pilates, gimnasios y negocios similares con instructores verificados, para cubrir reemplazos y sumar clases regulares sin perder tiempo.

Cada red está coordinada por una entidad del sector, como la Cámara de Pilates, que revisa la identidad y los certificados de cada instructor antes de que aparezca en las búsquedas.

PARA ESTUDIOS
• Buscá instructores que saben usar tu equipamiento, trabajan en tu zona y están disponibles en tu horario. La app los ordena por compatibilidad con tu clase.
• Enviá una propuesta de reemplazo en segundos, o publicá una clase abierta para que se anoten los instructores compatibles y elijas.
• Para una clase regular, coordiná una entrevista con clase de prueba en tu estudio.
• Con la clase confirmada, tenés el contacto del instructor, un recordatorio el día anterior y la clase registrada.
• Evaluá a cada instructor después de la clase y mirá las evaluaciones de otros estudios.

PARA INSTRUCTORES
• Cargá tus certificados y obtené la verificación de la entidad de tu red.
• Configurá tus horarios, zonas y tarifas: solo te llegan propuestas que encajan con vos.
• Recibí cada propuesta con aviso al celular y respondé con un toque: aceptá, rechazá o proponé otro monto.
• Siempre cobrás el 100% de lo que acordás con el estudio.
• Evaluá a los estudios: tu opinión ayuda a cuidar la red.

PARA ENTIDADES
• Verificá instructores y revisá sus certificados uno por uno.
• Gestioná los estudios de tu red, sus planes y quiénes son socios.
• Mirá la actividad y la calidad de tu red, desde el celular o la compu.

Los estudios socios de su entidad tienen el plan incluido. Los demás empiezan gratis, con 1 aviso cubierto por mes.
```

**Categoría:** Empresa
**Etiquetas:** Empleo, Empresa, Fitness (elegir las que ofrezca Play Console)
**Email de contacto:** info@masfacil.com.ar
**Teléfono (opcional):** +54 11 4027-8519
**Sitio web:** https://masfacil.com.ar/trabajo
**Política de privacidad:** https://masfacil.com.ar/trabajo/privacidad

**Gráficos** (en `docs/play-store/graficos/`):
- Ícono 512 × 512: `icono-512.png`
- Imagen destacada 1024 × 500: `destacada-1024x500.png`
- Capturas de teléfono 1080 × 1920, en este orden:
  1. `captura-1.png`: Estudios e instructores, conectados
  2. `captura-2.png`: Encontrá instructores compatibles
  3. `captura-3.png`: Recibí propuestas y respondé al toque
  4. `captura-4.png`: Cada clase, confirmada y registrada
  5. `captura-5.png`: Tus horarios y zonas, a tu manera
  6. `captura-6.png`: La entidad verifica a cada instructor

Las capturas usan cuentas y datos de ejemplo de la red de prueba: no hay datos de personas reales.

## Acceso a la app (para los revisores de Google)

Elegir **"Todas o algunas de las funciones están restringidas"** y agregar dos instrucciones:

| Nombre | Usuario | Contraseña | Instrucciones |
|---|---|---|---|
| Estudio | revision-estudio@qa.pilatesmatch.test | (la que te pasó Claude por chat) | Tocá "Continuar con email" e iniciá sesión. Es un estudio de una red de prueba: puede buscar instructores, enviar propuestas y ver sus clases. |
| Instructora | revision-instructora@qa.pilatesmatch.test | (la misma) | Tocá "Continuar con email" e iniciá sesión. Tiene una propuesta pendiente para aceptar o rechazar. |

Antes de enviar a revisión, volver a cargar los datos de ejemplo. Las pruebas automáticas (`npm run test:e2e`) y `tests/visual/seed.mjs` borran las propuestas de la red de prueba, así que este comando va **al final**:
`REVIEW_PASSWORD='...' node tests/visual/store-seed.mjs`

## Anuncios

¿La app tiene anuncios? **Sí**. La sección "Beneficios de tu red" muestra descuentos y formaciones de empresas del sector que pagan por aparecer (contenido patrocinado). No hay redes de anuncios (como AdMob), ni anuncios de terceros dentro de las pantallas de trabajo, y no se usa el ID de publicidad. Google pide marcar "Sí" ante cualquier promoción pagada de terceros.

## Clasificación de contenido (cuestionario IARC)

- Email de contacto: info@masfacil.com.ar
- Categoría: **Todas las demás categorías de apps** (no es juego, ni red social, ni noticias).
- Violencia, sexo, lenguaje vulgar, drogas, alcohol, tabaco, apuestas, contenido aterrador: **No** en todo.
- ¿Los usuarios pueden interactuar o intercambiar contenido? **Sí**: los estudios y los instructores se envían propuestas con notas y ven el contacto de la otra parte cuando la clase se confirma. No hay chat ni contenido público.
- ¿La app comparte la ubicación física del usuario con otros usuarios? **No**: solo el barrio que eligen y la dirección del estudio, que el estudio carga.
- ¿Permite comprar productos digitales? **No**.
- Resultado esperado: apta para todo público / 3+ (Google lo calcula).

## Público objetivo y contenido

- Grupo de edad: **18 años o más** (solo).
- ¿Puede atraer a menores sin querer? **No**.
- **No** está en la sección "Diseñada para familias".

## Seguridad de los datos (Data safety)

Respuestas generales:
- ¿La app recopila o comparte alguno de los tipos de datos requeridos? **Sí**.
- ¿Todos los datos se encriptan en tránsito? **Sí**.
- ¿Ofrecés una forma de pedir que se borren los datos? **Sí**: desde la app ("Eliminar mi cuenta") y en https://masfacil.com.ar/trabajo/eliminar-cuenta
- ¿Cumple la Política de Familias? No aplica.
- Revisión de seguridad independiente: **No**.

Para cada dato: **se recopila: Sí · se comparte: No** (ver nota) · **se procesa de forma efímera: No**.

| Categoría → tipo de dato | ¿Obligatorio u opcional? | Para qué (marcar) |
|---|---|---|
| Información personal → **Nombre** | Obligatorio | Funciones de la app · Administración de la cuenta |
| Información personal → **Dirección de correo** | Obligatorio | Funciones de la app · Administración de la cuenta · Comunicaciones del desarrollador |
| Información personal → **Número de teléfono** | Opcional | Funciones de la app (contacto entre estudio e instructor) |
| Información personal → **Dirección** (barrio y dirección del estudio) | Obligatorio | Funciones de la app |
| Información personal → **Otra información** (DNI, CUIT) | Obligatorio (DNI de instructores) | Funciones de la app · Prevención de fraude, seguridad y cumplimiento |
| Información financiera → **Historial de compras** (plan y cargos pagados en la web) | Opcional | Administración de la cuenta |
| Fotos y videos → **Fotos** | Opcional | Funciones de la app (foto de perfil y logo) |
| Archivos y documentos → **Archivos y documentos** (certificados) | Opcional | Funciones de la app · Prevención de fraude, seguridad y cumplimiento |
| Mensajes → **Otros mensajes en la app** (notas de las propuestas) | Opcional | Funciones de la app |
| Actividad en la app → **Otro contenido generado por el usuario** (evaluaciones) | Opcional | Funciones de la app |
| Actividad en la app → **Interacciones con la app** (qué beneficio vio o usó: vistas, clics en el link, código copiado) | Obligatorio | Estadísticas (resultados agregados para la entidad y el patrocinador; nunca se identifica a la persona ante el patrocinador) |
| Información y rendimiento de la app → **Registros de fallas** | — | **No se recopila** (no hay herramienta de errores instalada) |
| Dispositivo u otros IDs → **ID del dispositivo u otros IDs** (token para notificaciones) | Obligatorio | Funciones de la app |

**Nota:** según Google, no cuenta como "compartir" lo que procesan los proveedores por cuenta nuestra (Supabase, Expo, Firebase Cloud Messaging, Mercado Pago, Resend) ni lo que el propio usuario decide mostrar a otros usuarios de la app.

**No se recopila:** ubicación (precisa ni aproximada), contactos, calendario, mensajes SMS o de email, audio, salud y fitness, datos de tarjeta o cuenta bancaria (los maneja Mercado Pago), historial web, apps instaladas, ni actividad en otras apps.

## Otras declaraciones de Play Console

- **Acceso a la app:** ver arriba.
- **App de noticias:** No.
- **App de gobierno:** No.
- **Funciones financieras:** Ninguna.
- **App de salud:** No.
- **Permisos:** la app solo pide notificaciones. Las fotos se eligen con el selector del sistema, sin permiso de galería ni de cámara.
- **ID de publicidad:** la app **no usa** el ID de publicidad. En la declaración de "ID de publicidad" responder **No**.
- **Pagos:** la versión de Play Store no vende planes ni muestra sus precios. El cargo de incorporación de una clase regular es un servicio del mundo real (una incorporación de personal), por lo que no está alcanzado por la facturación de Google Play. Igual, en esta versión la app indica pagarlo desde la web.

## Subir la primera versión

1. Generar el paquete: `npx eas build --platform android --profile production` (archivo `.aab`).
2. En Play Console → **Probar y publicar → Pruebas → Prueba cerrada**: crear la versión, subir el `.aab` y escribir las notas de la versión.
3. Agregar a los testers por lista de emails y compartir el link de inscripción.
4. Con la prueba conforme, **Producción → Crear versión** con el mismo paquete.
5. Las siguientes versiones se pueden subir con `npx eas submit --platform android --profile production`.

Notas de la versión (es-419):
```
Primera versión de Trabajo Más Fácil: búsqueda de instructores verificados, propuestas de reemplazo y clases regulares, clases abiertas, recordatorios y evaluaciones.
```
