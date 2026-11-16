# Genera los mails de autenticación (Supabase Auth) con un mismo diseño.
# Uso: python3 docs/emails/build.py  → escribe un .html por mail y templates.json (para la API de Supabase).
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))

def layout(title, intro, button=None, url=None, note=None, code=False):
    btn = ''
    if button and url:
        btn = f'''<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
            <a href="{url}" style="display:inline-block;background:#2C6566;color:#FFFFFF;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 28px;border-radius:12px;">{button}</a>
          </td></tr></table>'''
    if code:
        btn = '''<p style="margin:0;text-align:center;font-size:32px;letter-spacing:8px;font-weight:bold;color:#172322;font-family:'Courier New',monospace;">{{ .Token }}</p>'''
    note_html = f'<p style="margin:24px 0 0;font-size:13px;line-height:19px;color:#93A09F;">{note}</p>' if note else ''
    return f'''<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#F4F7F7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7F7;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border-radius:20px;overflow:hidden;">
        <tr><td style="background:#163235;padding:28px;text-align:center;">
          <img src="https://masfacil.com.ar/logo-trabajo.png" alt="Trabajo Más Fácil" width="140" style="display:inline-block;max-width:140px;height:auto;">
        </td></tr>
        <tr><td style="padding:32px 28px 8px;">
          <h1 style="margin:0 0 12px;font-size:22px;line-height:28px;color:#172322;">{title}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:22px;color:#566362;">{intro}</p>
          {btn}
          {note_html}
        </td></tr>
        <tr><td style="padding:24px 28px 28px;">
          <hr style="border:none;border-top:1px solid #EBF1F0;margin:0 0 16px;">
          <p style="margin:0;font-size:12px;line-height:18px;color:#93A09F;text-align:center;">
            Trabajo Más Fácil · Estudios e instructores conectados<br>
            <a href="https://masfacil.com.ar/trabajo" style="color:#2C6566;">masfacil.com.ar/trabajo</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
'''

ONCE = 'El link sirve una sola vez y vence en una hora.'
NOT_YOU = 'Si no fuiste vos, ignorá este mail.'
MAILS = {
  'recovery': ('Elegí tu nueva contraseña · Trabajo Más Fácil', layout(
      'Elegí tu nueva contraseña',
      'Pediste cambiar la contraseña de tu cuenta ({{ .Email }}). Tocá el botón y elegí una nueva. La podés usar después en la app del celular y en la web.',
      'Elegir contraseña nueva', '{{ .ConfirmationURL }}', f'{ONCE} {NOT_YOU} Tu contraseña no cambia.')),
  'confirmation': ('Confirmá tu cuenta · Trabajo Más Fácil', layout(
      'Confirmá tu cuenta',
      'Te registraste en Trabajo Más Fácil con {{ .Email }}. Confirmá que este mail es tuyo para empezar a usar la app.',
      'Confirmar mi cuenta', '{{ .ConfirmationURL }}', f'{ONCE} {NOT_YOU}')),
  'invite': ('Te invitaron a Trabajo Más Fácil', layout(
      'Te invitaron a Trabajo Más Fácil',
      'Te sumaron a Trabajo Más Fácil, la app que conecta estudios e instructores dentro de tu red. Tocá el botón para crear tu cuenta con {{ .Email }}.',
      'Crear mi cuenta', '{{ .ConfirmationURL }}', 'Si no esperabas esta invitación, ignorá este mail.')),
  'magic_link': ('Tu link para entrar · Trabajo Más Fácil', layout(
      'Entrá a Trabajo Más Fácil',
      'Tocá el botón para entrar a tu cuenta ({{ .Email }}) sin contraseña.',
      'Entrar', '{{ .ConfirmationURL }}', f'{ONCE} {NOT_YOU}')),
  'email_change': ('Confirmá tu nuevo email · Trabajo Más Fácil', layout(
      'Confirmá tu nuevo email',
      'Pediste cambiar el email de tu cuenta de {{ .Email }} a {{ .NewEmail }}. Confirmalo para que el cambio quede hecho.',
      'Confirmar el cambio', '{{ .ConfirmationURL }}', f'{ONCE} Si no lo pediste vos, ignorá este mail: tu email no cambia.')),
  'reauthentication': ('Tu código: {{ .Token }} · Trabajo Más Fácil', layout(
      'Tu código de verificación',
      'Usá este código para confirmar que sos vos:', code=True,
      note=f'El código vence en una hora. {NOT_YOU}')),
  'password_changed_notification': ('Cambiaste tu contraseña · Trabajo Más Fácil', layout(
      'Cambiaste tu contraseña',
      'La contraseña de tu cuenta ({{ .Email }}) se cambió recién. Desde ahora usá la nueva, en el celular y en la web.',
      note='Si no fuiste vos, pedí una contraseña nueva desde "¿Olvidaste tu contraseña?" y escribinos a info@masfacil.com.ar.')),
  'email_changed_notification': ('Cambió el email de tu cuenta · Trabajo Más Fácil', layout(
      'Cambió el email de tu cuenta',
      'El email de tu cuenta cambió de {{ .OldEmail }} a {{ .Email }}.',
      note='Si no fuiste vos, escribinos cuanto antes a info@masfacil.com.ar.')),
}

payload = {}
for key, (subject, html) in MAILS.items():
    open(os.path.join(HERE, f'{key}.html'), 'w').write(html)
    payload[f'mailer_subjects_{key}'] = subject
    payload[f'mailer_templates_{key}_content'] = html
json.dump(payload, open(os.path.join(HERE, 'templates.json'), 'w'), ensure_ascii=False, indent=1)
print('\n'.join(MAILS))
