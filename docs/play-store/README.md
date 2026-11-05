# Publicación en Google Play — estado y pasos

## Ya hecho en el código
- Eliminar la cuenta desde la app: botón en el perfil de instructor, estudio y entidad. Requiere la migración `delete_my_account`.
- Permisos de Android reducidos a notificaciones. Las fotos se eligen con el selector del sistema, sin permiso de galería.
- Versión de producción: el número de versión sube solo (`autoIncrement`), el canal de actualizaciones es `production` y hay un perfil para subir con `eas submit`.
- Pagos según la política de Google Play:
  - La versión de Play Store **no muestra precios ni el botón de Mercado Pago**.
  - El estudio paga desde la versión web, y el plan se activa solo en el celular (webhook de Mercado Pago).
  - La versión de prueba (preview) y la web sí muestran el pago.
  - Lo controla `EXPO_PUBLIC_IN_APP_PAYMENTS` (`eas.json` y `scripts/publish-update.sh`).
- Textos legales (borradores): `politica-de-privacidad.md`, `terminos-y-condiciones.md`, `eliminar-cuenta.md`.
- Ficha y formularios: `ficha-y-formularios.md`. Gráficos: `graficos/`.

## Cambio de identificador: `com.pilates.match` → `ar.com.masfacil.trabajo`
El identificador no se puede cambiar después de publicar. Pasos:
1. **Firebase** (console.firebase.google.com → el proyecto actual): **Agregar app → Android** con el paquete `ar.com.masfacil.trabajo`. Descargar el `google-services.json` nuevo.
2. Pasarle ese archivo a Claude. No es secreto: va dentro de la app. Claude actualiza `app.json` y el archivo, y arma la versión nueva.
3. **expo.dev → Credentials → Android → ar.com.masfacil.trabajo**: subir la misma clave FCM V1 que se subió para el identificador anterior. Sin esto no llegan las notificaciones.
4. Instalar la versión nueva. Es una app distinta de la anterior: conviene desinstalar la vieja.

## Publicar
- Actualizaciones de prueba: `scripts/publish-update.sh preview "mensaje"`.
- Actualizaciones de Play Store: `scripts/publish-update.sh production "mensaje"`.
- Versión web (pagos): `scripts/deploy-web.sh --prod` → https://pilates-match-uzk6zjlax-yy3roxz8-ao.expo.app
- Paquete para Play Store: `npx eas build --platform android --profile production`. **La primera vez** se sube a mano en Play Console. Después se puede usar `npx eas submit --platform android --profile production`.

## Pendiente de terceros
- Cuenta de Google Play Console (USD 25) y prueba cerrada con 12 personas durante 14 días.
- Completar los datos entre [CORCHETES] de los textos legales y publicarlos en una URL propia.
- Plan Pro de Supabase antes de lanzar, porque el plan gratuito pausa el proyecto si no se usa.
- Mercado Pago de la plataforma: Access Token, webhook y clave secreta.
