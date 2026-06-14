# Cómo hacer el build y publicar en Play Store

## Prerequisitos (hacer una sola vez)

```bash
# Instalar herramientas globales
npm install -g eas-cli expo-cli

# Loguearte en tu cuenta de Expo (creá una en expo.dev si no tenés)
eas login

# Ir a la carpeta del proyecto
cd pilates-match

# Instalar dependencias
npm install
```

---

## Paso 1 — Build de prueba (APK para testear en tu celular)

```bash
eas build --platform android --profile preview
```

- EAS construye el APK en la nube (no necesitás Android Studio)
- Te manda un link para descargar el APK cuando termina (~10-15 min)
- Instalalo en tu celular y probá que todo funciona

---

## Paso 2 — Build de producción (AAB para Play Store)

```bash
eas build --platform android --profile production
```

Genera un `.aab` (Android App Bundle), que es el formato que pide Google Play.

---

## Paso 3 — Crear la app en Google Play Console

1. Entrá a [play.google.com/console](https://play.google.com/console)
2. Pagá los USD 25 de la cuenta de desarrollador (único pago)
3. Hacé clic en **"Crear app"**
4. Completá:
   - Nombre: **PilatesMatch**
   - Idioma: Español
   - Tipo: App
   - Categoría: Negocios o Salud y bienestar
5. Aceptá las políticas

---

## Paso 4 — Subir el AAB a Play Console

En Play Console → tu app → **Versiones** → **Pruebas internas** → **Crear nueva versión**:

1. Subí el archivo `.aab` que generó EAS
2. Escribí notas de la versión: "Primera versión — MVP"
3. Guardá y enviá a revisión

> Empezar con **Pruebas internas** te permite probar con hasta 100 testers sin pasar por la revisión completa de Google.

---

## Paso 5 — Completar el perfil de la app (requerido para publicar)

En Play Console necesitás completar:

### Ficha de Play Store
- **Descripción corta** (80 caracteres): "Conectamos instructores de Pilates con estudios de Buenos Aires"
- **Descripción completa** (4000 caracteres): ver plantilla abajo
- **Screenshots**: mínimo 2 capturas de pantalla del celular (1080x1920px o similar)
- **Ícono de la app**: 512x512px PNG (ya tenés el de 1024px en assets/)
- **Feature graphic**: 1024x500px (imagen de portada en Play Store)

### Clasificación de contenido
- Completá el cuestionario (es automático, ~5 min)
- La app debería quedar en clasificación "Para todos" o "E"

### Política de privacidad
- **Necesitás una URL pública** con la política de privacidad
- Opción rápida: crear una página en [privacypolicytemplate.net](https://www.privacypolicytemplate.net) y subirla a Firebase Hosting o Notion

---

## Plantilla de descripción para Play Store

**Descripción corta:**
> Conectamos instructores de Pilates verificados con estudios de Buenos Aires.

**Descripción completa:**
> PilatesMatch es la plataforma de la comunidad de Pilates de Buenos Aires, avalada por la Cámara de Pilates CABA.
>
> **Para estudios:**
> • Buscá instructores verificados por barrio y especialidad
> • Solicitá reemplazos de última hora con un solo toque
> • Evaluá el desempeño de cada instructor después de la clase
> • Accedé al directorio completo siendo estudio miembro de la Cámara
>
> **Para instructores:**
> • Registrá tu disponibilidad y tarifas
> • Recibí solicitudes de estudios directamente en tu celular
> • Construí tu reputación con evaluaciones verificadas
> • Accedé a más oportunidades siendo parte de la red de la Cámara
>
> Todos los instructores están verificados por la Cámara de Pilates de Buenos Aires.

---

## Paso 6 — Publicación

Una vez aprobado en pruebas internas, promovés la versión a **Producción** desde Play Console.

La primera revisión de Google tarda entre 1 y 7 días hábiles.

---

## Comandos útiles

```bash
# Ver estado de los builds
eas build:list

# Ver logs de un build específico
eas build:view [BUILD_ID]

# Subir automáticamente a Play Store (track interno)
eas submit --platform android --latest

# Actualizar la app (nueva versión) — autoIncrement sube el versionCode
eas build --platform android --profile production
```

---

## Si algo falla en el build

Los errores más comunes y sus soluciones:

| Error | Solución |
|-------|----------|
| "google-services.json not found" | Verificar que está en la raíz del proyecto |
| "Package name mismatch" | Verificar que app.json y google-services.json tienen el mismo package |
| "Expo account not linked" | Correr `eas init` y linkear el proyecto |
| "Missing permissions" | Verificar que app.json tiene los plugins declarados |
