import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usePhotoCropper } from '../../components/PhotoCropper'
import CamaraTeam from '../../components/CamaraTeam'
import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'
import { LoadingScreen, ErrorState, colors, spacing, radius, typography } from '../../components/ui'
import { errorText, UserError } from '../../lib/errors'
import { Feather } from '@expo/vector-icons'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'
import SaveButton from '../../components/SaveButton'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'

export default function CamaraProfileEditScreen({ navigation }: any) {
  const { pickPhoto, cropModal } = usePhotoCropper('Ajustá el logo')
  const user = useAuthStore(s => s.user)
  const qc   = useQueryClient()
  const { toast, showToast, hideToast } = useToast()
  const [uploading, setUploading] = useState(false)

  const { data: camara, isLoading, isError, refetch } = useQuery({
    queryKey: ['camara-profile', user?.camara_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('camaras').select('*').eq('id', user?.camara_id).single()
      if (error) throw error
      return data
    },
    enabled: !!user?.camara_id,
  })

  const [name,     setName]     = useState('')
  const [website,  setWebsite]  = useState('')
  const [phone,    setPhone]    = useState('')
  const [logoUrl,  setLogoUrl]  = useState<string | null>(null)

  useEffect(() => {
    if (!camara) return
    setName(camara.name ?? '')
    setWebsite(camara.website ?? '')
    setPhone(camara.phone ?? '')
    setLogoUrl(camara.logo_url ?? null)
  }, [camara])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new UserError('El nombre de la Cámara no puede quedar vacío.')
      const { data, error } = await supabase.from('camaras').update({
        name:     name.trim(),
        website:  website.trim() || null,
        phone:    phone.trim() || null,
      }).eq('id', user!.camara_id).select('id')
      if (error) throw error
      if (!data?.length) throw new UserError('No tenés permiso para editar esta Cámara.')
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['camara-profile'] }); showToast('Perfil guardado') },
    onError: (e: any) => showToast(errorText(e), 'error'),
  })


  const pickAndUploadAvatar = async (
    bucketName: string,
    storagePath: string,
    onSuccess: (url: string) => Promise<void>
  ) => {
    // Sin el recortador nativo (en Android 15 no deja guardar): recortamos nosotros
    let pickedUri: string | null
    try { pickedUri = await pickPhoto() } catch (e) { showToast(errorText(e), 'warning'); return }
    if (!pickedUri) return

    try {
      setUploading(true)
      const sourceUri = pickedUri
      // Copy to cache to resolve content:// URIs on Android
      const cacheUri = FileSystem.cacheDirectory + 'upload_' + Date.now() + '.jpg'
      await FileSystem.copyAsync({ from: sourceUri, to: cacheUri })
      // Read base64 from cached file:// URI
      const base64 = await FileSystem.readAsStringAsync(cacheUri, {
        encoding: FileSystem.EncodingType.Base64,
      })
      // Decode base64 to bytes without external library
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

      const { error } = await supabase.storage
        .from(bucketName)
        .upload(storagePath, bytes, { upsert: true, contentType: 'image/jpeg' })
      if (error) throw error

      const url = supabase.storage.from(bucketName).getPublicUrl(storagePath).data.publicUrl + '?t=' + Date.now()
      await onSuccess(url)
      showToast('Logo actualizado')
    } catch (e: any) {
      showToast(errorText(e), 'error')
    } finally {
      setUploading(false)
    }
  }

  const pickLogo = () => pickAndUploadAvatar(
    'avatars',
    `${user?.id}/camara-logo.jpg`,
    async (url) => {
      const { data, error } = await supabase.from('camaras').update({ logo_url: url }).eq('id', user!.camara_id).select('id')
      if (error) throw error
      if (!data?.length) throw new UserError('No tenés permiso para editar esta Cámara.')
      setLogoUrl(url)
      qc.invalidateQueries({ queryKey: ['camara-profile'] })
    }
  )

  if (!user?.camara_id) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream }}>
        <HeroHeader title="Perfil de la Cámara" onBack={() => navigation.goBack()} backLabel="Inicio" />
        <ErrorState message="Tu usuario no está asociado a ninguna Cámara. Pedile a un administrador que lo configure." onRetry={() => navigation.goBack()} />
      </View>
    )
  }
  if (isLoading) return <LoadingScreen message="Cargando perfil..." />
  if (isError || !camara) return <ErrorState message="No pudimos cargar el perfil de la Cámara." onRetry={refetch} />

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader
        title="Perfil de la Cámara"
        subtitle="Nombre e identidad visual"
        centered
        avatarUri={logoUrl}
        avatarFallback={name || 'C'}
        onAvatarPress={pickLogo}
        onBack={() => navigation.goBack()}
        backLabel="Inicio"
      />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Logo */}
        <BlobCard style={s.card} delay={0}>
          <Text style={s.sectionTitle}>LOGO</Text>
          <TouchableOpacity style={s.logoUploadBtn} onPress={pickLogo} disabled={uploading} activeOpacity={0.8}>
            <Feather name="upload" size={16} color={colors.sage} />
            <Text style={s.logoUploadTxt}>
              {uploading ? 'Subiendo...' : logoUrl ? 'Cambiar logo' : 'Subir logo'}
            </Text>
          </TouchableOpacity>
          <Text style={s.hint}>Imagen cuadrada, idealmente de 512 × 512 px o más</Text>
        </BlobCard>

        {/* Nombre e info */}
        <BlobCard style={s.card} delay={1500}>
          <Text style={s.sectionTitle}>INFORMACIÓN</Text>

          <Text style={s.label}>NOMBRE DE LA CÁMARA</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="Cámara de Pilates de CABA"
            placeholderTextColor={colors.light}
          />

          <Text style={s.label}>SITIO WEB</Text>
          <TextInput
            style={s.input}
            value={website}
            onChangeText={setWebsite}
            placeholder="www.camarapilates.org.ar"
            placeholderTextColor={colors.light}
            autoCapitalize="none"
            keyboardType="url"
          />

          <Text style={s.label}>TELÉFONO</Text>
          <TextInput
            style={s.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="11 5555-6666"
            placeholderTextColor={colors.light}
            keyboardType="phone-pad"
          />
        </BlobCard>

        <SaveButton
          label="Guardar cambios"
          onPress={() => saveMutation.mutate()}
          isPending={saveMutation.isPending}
          isSuccess={saveMutation.isSuccess}
        />

        {user?.camara_id ? <View style={{ marginTop: spacing.lg }}><CamaraTeam camaraId={user.camara_id} camaraName={camara?.name} /></View> : null}
      </ScrollView>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
      {cropModal}
    </View>
  )
}

const s = StyleSheet.create({
  content:       { padding: spacing.md, paddingBottom: 48 },
  card:          { padding: spacing.md, marginBottom: spacing.md },
  sectionTitle:  { ...typography.caption, marginBottom: spacing.md },
  label:         { ...typography.caption, marginBottom: 5, marginTop: spacing.sm },
  input:         { backgroundColor: colors.sageLighter, ...radius.leaf, borderWidth: 0.5, borderColor: colors.border, padding: 12, fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.dark },
  hint:          { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light, marginTop: 6 },
  logoUploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.sageLight, ...radius.leaf, padding: 14, borderWidth: 0.5, borderColor: colors.border },
  logoUploadTxt: { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.sage },
})
