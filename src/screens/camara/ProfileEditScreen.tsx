import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'
import { LoadingScreen, colors, spacing } from '../../components/ui'
import { Feather } from '@expo/vector-icons'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'
import SaveButton from '../../components/SaveButton'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'

export default function CamaraProfileEditScreen({ navigation }: any) {
  const user = useAuthStore(s => s.user)
  const qc   = useQueryClient()
  const { toast, showToast, hideToast } = useToast()
  const [uploading, setUploading] = useState(false)

  const { data: camara, isLoading } = useQuery({
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
      const { error } = await supabase.from('camaras').update({
        name:     name.trim(),
        website:  website.trim() || null,
        phone:    phone.trim() || null,
      }).eq('id', user?.camara_id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['camara-profile'] }),
    onError: (e: any) => showToast('Error: ' + e.message),
  })


  const pickAndUploadAvatar = async (
    bucketName: string,
    storagePath: string,
    onSuccess: (url: string) => void
  ) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería'); return }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7,
    })
    if (result.canceled || !result.assets[0]) return

    try {
      setUploading(true)
      const sourceUri = result.assets[0].uri
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
      onSuccess(url)
      showToast('Foto actualizada')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setUploading(false)
    }
  }

  const pickLogo = () => pickAndUploadAvatar(
    'camara-logos',
    `${user?.camara_id}/logo.jpg`,
    async (url) => {
      await supabase.from('camaras').update({ logo_url: url }).eq('id', user?.camara_id)
      setLogoUrl(url)
      qc.invalidateQueries({ queryKey: ['camara-profile'] })
    }
  )

  if (isLoading) return <LoadingScreen />

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader
        title="Perfil de la Cámara"
        subtitle="Nombre e identidad visual"
        centered
        avatarUri={logoUrl}
        avatarFallback={name || 'C'}
        onAvatarPress={pickLogo}
        rightElement={
          <TouchableOpacity style={s.logoutPill} onPress={() => navigation.goBack()}>
            <Feather name="x" size={14} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        }
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
          <Text style={s.hint}>PNG con fondo transparente, mínimo 512×512px</Text>
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
      </ScrollView>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  )
}

const s = StyleSheet.create({
  content:       { padding: spacing.md, paddingBottom: 48 },
  logoutPill:    { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  card:          { padding: spacing.md, marginBottom: spacing.md },
  sectionTitle:  { fontFamily: 'Nunito-Bold', fontSize: 9, color: colors.light, letterSpacing: 0.8, marginBottom: spacing.md },
  label:         { fontFamily: 'Nunito-Bold', fontSize: 9, color: colors.light, letterSpacing: 0.7, marginBottom: 5, marginTop: spacing.sm },
  input:         { backgroundColor: colors.sageLighter, borderTopLeftRadius: 12, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 12, borderWidth: 0.5, borderColor: colors.border, padding: 12, fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.dark },
  hint:          { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light, marginTop: 6 },
  logoUploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.sageLight, borderTopLeftRadius: 12, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 12, padding: 14, borderWidth: 0.5, borderColor: colors.border },
  logoUploadTxt: { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.sage },
})
