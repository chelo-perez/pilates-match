# ── 1. Fix ProfileEditScreen — certificados y foto ──────────────
profile = open('src/screens/instructor/ProfileEditScreen.tsx', 'r').read()

# Fix bucket: reemplazar upload manual por storage.uploadCertification
old_cert_upload = """      // Subir archivo del certificado (PDF o imagen)
      const docResult = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      })

      let fileUrl = null
      if (!docResult.canceled && docResult.assets?.[0]) {
        const asset = docResult.assets[0]
        const blob = await (await fetch(asset.uri)).blob()
        const ext = asset.name.split('.').pop() ?? 'pdf'
        const path = `certifications/${instructor!.id}/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(path, blob, { contentType: asset.mimeType ?? 'application/pdf' })
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)
          fileUrl = urlData.publicUrl
        }
      }

      await supabase.from('certifications').insert({
        instructor_id: instructor!.id,
        name: certName.trim(),
        institution: certInstitution.trim() || null,
        year: certYear ? parseInt(certYear) : null,
        file_url: fileUrl,
        verified: false,
      })"""

new_cert_upload = """      // Primero crear el registro para obtener el ID
      const { data: certData, error: certError } = await supabase.from('certifications').insert({
        instructor_id: instructor!.id,
        name: certName.trim(),
        institution: certInstitution.trim() || null,
        year: certYear ? parseInt(certYear) : null,
        verified: false,
      }).select().single()

      if (certError) throw certError

      // Subir archivo usando storage.uploadCertification
      const docResult = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      })

      if (!docResult.canceled && docResult.assets?.[0] && certData) {
        try {
          const asset = docResult.assets[0]
          const blob = await (await fetch(asset.uri)).blob()
          const fileUrl = await storage.uploadCertification(instructor!.id, certData.id, blob)
          if (fileUrl) {
            await supabase.from('certifications').update({ file_url: fileUrl }).eq('id', certData.id)
          }
        } catch (uploadErr) {
          console.log('Error subiendo archivo:', uploadErr)
          // El certificado se guardó igual, solo sin archivo
        }
      }"""

profile = profile.replace(old_cert_upload, new_cert_upload)

# Fix foto de perfil — en React Native los blobs no funcionan igual
old_avatar = """    try {
      setUploading(true)
      const uri = result.assets[0].uri
      const blob = await (await fetch(uri)).blob()
      const url = await storage.uploadAvatar(user!.id, blob)
      await supabase.from('instructors').update({ avatar_url: url }).eq('id', instructor!.id)
      qc.invalidateQueries({ queryKey: ['my-instructor-profile'] })
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setUploading(false)
    }"""

new_avatar = """    try {
      setUploading(true)
      const uri = result.assets[0].uri
      const ext = uri.split('.').pop() ?? 'jpg'
      const path = `${user!.id}/avatar.${ext}`
      const formData = new FormData()
      formData.append('file', { uri, name: `avatar.${ext}`, type: `image/${ext}` } as any)
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, formData, { upsert: true, contentType: `image/${ext}` })
      if (uploadError) throw uploadError
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
      await supabase.from('instructors').update({ avatar_url: url }).eq('id', instructor!.id)
      qc.invalidateQueries({ queryKey: ['my-instructor-profile'] })
      Alert.alert('✓ Foto actualizada')
    } catch (e: any) {
      Alert.alert('Error al subir foto', e.message)
    } finally {
      setUploading(false)
    }"""

profile = profile.replace(old_avatar, new_avatar)

open('src/screens/instructor/ProfileEditScreen.tsx', 'w').write(profile)
print("OK: ProfileEditScreen")

# ── 2. Fix DashboardScreen — etiquetas tarifas ──────────────────
dash = open('src/screens/instructor/DashboardScreen.tsx', 'r').read()
dash = dash.replace(
    '<Text style={s.rateLabel}>Estudio Socio</Text>',
    '<Text style={s.rateLabel}>Clase regular</Text>'
)
dash = dash.replace(
    '<Text style={s.rateLabel}>Estudio No Socio</Text>',
    '<Text style={s.rateLabel}>Reemplazo</Text>'
)
open('src/screens/instructor/DashboardScreen.tsx', 'w').write(dash)
print("OK: DashboardScreen etiquetas")

# ── 3. Fix RatesScreen — paddingTop + quitar emoji + colores ────
rates = open('src/screens/instructor/RatesScreen.tsx', 'r').read()

# paddingTop
rates = rates.replace(
    "content: { padding: spacing.lg, paddingBottom: 40 },",
    "content: { padding: spacing.lg, paddingTop: 52, paddingBottom: 40 },"
)

# Quitar emoji 🏛️
rates = rates.replace("🏛️ Rango Cámara", "Rango Cámara")

# Reemplazo: cambiar color rojo por dorado/amber
rates = rates.replace(
    "accentColor={colors.redTx}\n        accentBg=\"#F5E8E8\"",
    "accentColor={colors.gold}\n        accentBg={colors.goldLight}"
)

# Quitar emoji 🔒
rates = rates.replace("🔒", "")
rates = rates.replace(
    "<Text style={styles.lockIcon}>🔒</Text>\n        <Text style={styles.privacyText}>",
    "<Text style={styles.privacyText}>"
)
rates = rates.replace(
    "  lockIcon: { fontSize: 14, marginTop: 1 },\n  ",
    "  "
)

open('src/screens/instructor/RatesScreen.tsx', 'w').write(rates)
print("OK: RatesScreen")

# ── 4. Fix AvailabilityScreen — color reemplazo ─────────────────
avail = open('src/screens/instructor/AvailabilityScreen.tsx', 'r').read()
avail = avail.replace(
    "slot.type === 'regular' ? colors.sageLight : colors.warnBg",
    "slot.type === 'regular' ? colors.sageLight : colors.goldLight"
)
avail = avail.replace(
    "slot.type === 'regular' ? colors.sage : colors.warnTx",
    "slot.type === 'regular' ? colors.sage : colors.gold"
)
open('src/screens/instructor/AvailabilityScreen.tsx', 'w').write(avail)
print("OK: AvailabilityScreen colores")

print("\nTodos los fixes aplicados")

# ── 5. Fix AvailabilityScreen — integrar ZonasCABA ──────────────
avail = open('/home/claude/AvailabilityScreen.tsx', 'r').read()

# Agregar import del componente
avail = avail.replace(
    "import { Feather } from '@expo/vector-icons'",
    "import { Feather } from '@expo/vector-icons'\nimport ZonasCABA from '../../components/ZonasCABA'"
)

# Reemplazar toggleZone para manejar __all__ y __clear__
avail = avail.replace(
    "  const toggleZone = (z: string) => setSelectedZones(prev =>\n    prev.includes(z) ? prev.filter(x => x !== z) : [...prev, z]\n  )",
    """  const ALL_NEIGHBORHOODS = [
    'Agronomía','Almagro','Balvanera','Barracas','Belgrano',
    'Boedo','Caballito','Chacarita','Colegiales','Flores',
    'Floresta','La Boca','Liniers','Mataderos','Monte Castro',
    'Montserrat','Nueva Pompeya','Núñez','Palermo','Parque Chacabuco',
    'Parque Patricios','Paternal','Puerto Madero','Recoleta','Retiro',
    'San Cristóbal','San Nicolás','San Telmo','Versalles','Villa Crespo',
    'Villa del Parque','Villa Devoto','Villa Lugano','Villa Luro','Villa Ortúzar',
    'Villa Pueyrredón','Villa Real','Villa Urquiza',
  ]
  const toggleZone = (z: string) => {
    if (z === '__all__') { setSelectedZones(ALL_NEIGHBORHOODS); return }
    if (z === '__clear__') { setSelectedZones([]); return }
    setSelectedZones(prev => prev.includes(z) ? prev.filter(x => x !== z) : [...prev, z])
  }"""
)

# Reemplazar el grid de zonas manual por el componente
old_zonas = """            <Text style={s.zoneInfo}>
              Seleccioná los barrios de CABA donde estás disponible para trabajar.
              {selectedZones.length > 0 ? ` Seleccionados: ${selectedZones.length}` : ''}
            </Text>
            <View style={s.zonesGrid}>
              {NEIGHBORHOODS.map(n => (
                <TouchableOpacity
                  key={n}
                  style={[s.zoneChip, selectedZones.includes(n) && s.zoneChipActive]}
                  onPress={() => toggleZone(n)}
                >
                  <Text style={[s.zoneText, selectedZones.includes(n) && s.zoneTextActive]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>"""

new_zonas = """            <ZonasCABA selected={selectedZones} onToggle={toggleZone} />"""

avail = avail.replace(old_zonas, new_zonas)

open('/home/claude/AvailabilityScreen.tsx', 'w').write(avail)
print("OK: AvailabilityScreen con ZonasCABA")
