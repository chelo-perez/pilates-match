# Ficha de Play Store y formularios de Play Console

## Ficha de la tienda

**Nombre de la app** (máx. 30): `Trabajo Más Fácil`

**Descripción corta** (máx. 80):
`Reemplazos y clases regulares con instructores verificados.`

**Descripción completa** (máx. 4000):

```
Trabajo Más Fácil conecta estudios con instructores verificados para cubrir reemplazos y clases regulares, de forma rápida y segura.

Cada red está coordinada por una entidad del sector, como la Cámara de Pilates, que verifica la identidad y la formación de cada instructor antes de que aparezca en las búsquedas.

PARA ESTUDIOS
• Encontrá instructores verificados que saben usar tu equipamiento, trabajan en tu zona y están disponibles en tu horario.
• Enviá propuestas de reemplazo o de clase regular en segundos.
• Mirá el puntaje y las evaluaciones de otros estudios.
• Seguí tus propuestas y evaluá a cada instructor después de la clase.

PARA INSTRUCTORES
• Cargá tus certificados y obtené la verificación de la entidad de tu red.
• Configurá tus horarios, zonas y tarifas: los estudios ven si encajás antes de proponerte.
• Recibí propuestas con aviso al celular y respondé con un toque.
• Evaluá a los estudios: tu opinión es anónima para ellos y ayuda a cuidar la red.

PARA ENTIDADES
• Verificá instructores y certificados desde el celular.
• Gestioná los estudios de tu red y sus planes.
• Mirá reportes de actividad y calidad de tu red.

Empezá gratis: los estudios tienen 1 propuesta por mes sin costo.
```

**Categoría:** Empresa (alternativa: Productividad)
**Etiquetas:** empleo, pilates, gimnasios, reemplazos
**Email de soporte:** [EMAIL DE CONTACTO]
**Sitio web:** [URL]
**Política de privacidad:** [URL de la política publicada]

**Gráficos** (listos en `docs/play-store/graficos/`):
- Ícono 512 × 512: `icono-512.png`
- Imagen destacada 1024 × 500: `destacada-1024x500.png`
- Capturas de teléfono (mínimo 2, ideal 4 a 8): `captura-*.png`

## Clasificación de contenido (cuestionario IARC)

- Categoría: **Utilidades, productividad, comunicación u otra**.
- Violencia, sexo, lenguaje, drogas, apuestas: **No**.
- ¿Los usuarios pueden interactuar o intercambiar información? **Sí**: los estudios y los instructores se envían propuestas con notas y teléfono de contacto.
- ¿Comparte la ubicación del usuario? **No**: solo el barrio que el usuario elige.
- ¿Compras digitales? **No dentro de la app**: los planes se pagan por fuera de la versión de Play Store.

## Público objetivo

- Edad: **18 años o más**.
- ¿Atrae a menores? **No**.

## Anuncios

- ¿La app tiene anuncios? **No**.

## Acceso a la app (para los revisores de Google)

Elegir "Todas o algunas de las funciones están restringidas" y cargar una cuenta de prueba de estudio y una de instructor, con email y contraseña. **No usar cuentas reales.** Se pueden crear en la red de prueba (QA) antes de enviar a revisión.

## Seguridad de los datos (Data safety)

**¿La app recolecta o comparte datos del usuario?** Sí.
**¿Los datos se cifran en tránsito?** Sí (HTTPS).
**¿El usuario puede pedir que se borren?** Sí: desde la app ("Eliminar mi cuenta") y en [URL DE LA PÁGINA DE ELIMINACIÓN].

| Tipo de dato (categoría de Google) | ¿Se recolecta? | ¿Se comparte con terceros? | Obligatorio | Para qué |
|---|---|---|---|---|
| Nombre | Sí | No* | Sí | Funcionalidad, administración de la cuenta |
| Email | Sí | No* | Sí | Administración de la cuenta, comunicaciones |
| Teléfono | Sí | No* | Opcional (estudios) / Sí (instructores) | Funcionalidad (contacto entre estudio e instructor) |
| Dirección (barrio, dirección del estudio) | Sí | No* | Sí | Funcionalidad (compatibilidad por zona) |
| Otra información (DNI, CUIT) | Sí | No* | DNI sí (instructores), CUIT opcional | Verificación de identidad, prevención de fraude |
| Fotos | Sí | No* | Opcional | Funcionalidad (foto de perfil, logo) |
| Archivos y documentos (certificados) | Sí | No* | Opcional | Verificación por la entidad |
| Historial de compras | Sí | No* | Solo con plan pago | Administración de la cuenta (estado del plan) |
| Otro contenido generado por el usuario (notas, evaluaciones) | Sí | No* | Opcional | Funcionalidad |
| ID del dispositivo u otros IDs (token de notificaciones) | Sí | No* | Sí | Funcionalidad (avisos) |

\* Según Google, **no** cuenta como "compartir" la transferencia a proveedores que procesan datos por cuenta nuestra (Supabase, Expo, Firebase, Mercado Pago), ni lo que el propio usuario decide mostrar a otros usuarios de la app.

**No se recolecta:** ubicación precisa ni aproximada (GPS), contactos, mensajes, audio, salud, información financiera (los datos de tarjeta los maneja Mercado Pago), historial web, ni actividad en otras apps.

## Declaraciones adicionales

- **Permisos:** la app solo pide notificaciones. Las fotos se eligen con el selector del sistema, sin permiso de galería.
- **Servicios financieros:** no aplica.
- **App de gobierno:** no.
- **Pagos:** la versión de Play Store no vende ni muestra planes pagos. Los estudios contratan el plan desde la versión web y el plan se refleja en la app.
