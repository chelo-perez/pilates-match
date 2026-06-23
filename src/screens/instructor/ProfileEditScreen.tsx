// src/screens/instructor/ProfileEditScreen.tsx
import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../../lib/supabase'
import { storage } from '../../lib/supabase'
import { useAuthStore } from '../../store'
import { Avatar, Button, Input, Badge, colors, spacing, typography, radius } from '../../components/ui'

const SPECIALTIES = [
  { key: 'mat', label: 'Mat' }, { key: 'reformer', label: 'Reformer' },
  { key: 'cadillac', label: 'Cadillac' }, { key: 'chair', label: 'Chair' },
  { key: 'TRX', label: 'TRX' }, { key: 'prenatal', label: 'Pre/post parto' },
  { key: 'terapeutico', label: 'Terapéutico' }, { key: 'adultos_mayores', label: 'Adultos mayores' },
]

export default function ProfileEditScreen({ navigation }: any) {
  const user = useAuthStore(s => s.user)
  const qc = useQueryClient()
  const [bio, setBio] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  const { data: instructor } = useQuery({
    queryKey: ['my-instructor-profile'],
    queryFn: async () => {
      const { data } = await supabase.from('instructors')
        .select(`*, specialties:instructor_specialties(*), certifications(*)`)
        .eq('user_id', user?.id).single()
      return data
    },
    enabled: !!user?.id,
  })

  useEffect(() => {
    if (instructor) {
      setBio(instructor.bio ?? '')
      setNeighborhood(instructor.neighborhood ?? '')
      setPhone(instructor.phone ?? '')
      setSelectedSpecialties((instructor.specialties ?? []).map((s: any) => s.specialty))
    }
  }, [instructor])

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Update instructor
      await supabase.from('instructors').update({ bio, neighborhood, phone }).eq('id', instructor!.id)
      // Update specialties
      await supabase.from('instructor_specialties').delete().eq('instructor_id', instructor!.id)
      if (selectedSpecialties.length > 0) {
        await supabase.from('instructor_specialties').insert(
          selectedSpecialties.map(s => ({ instructor_id: instructor!.id, specialty: s }))
        )
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-instructor-profile'] })
      Alert.alert('✓ Perfil actualizado', '', [{ text: 'Ok', onPress: () => navigation.goBack() }])
    },
  })

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') return

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7,
    })
    if (result.canceled || !result.assets[0]) return

    try {
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
    }
  }

  const toggleSpecialty = (key: string) =>
    setSelectedSpecialties(prev => prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key])

  const { reset } = useAuthStore()
  const handleSignOut = async () => {
    Alert.alert('Cerrar sesión', '¿Seguro que querés salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: async () => {
        await supabase.auth.signOut()
        reset()
      }},
    ])
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.cream }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={pickAvatar} disabled={uploading}>
          <Avatar name={instructor?.full_name ?? 'IO'} size={72} color={colors.sage}
            imageUrl={instructor?.avatar_url} />
          <View style={styles.editBadge}><Text style={{ fontSize: 14 }}>📷</Text></View>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.lg }}>
          <Text style={styles.profileName}>{instructor?.full_name}</Text>
          <Badge
            label={instructor?.verification_status === 'verificado' ? '✓ Verificada' : '⏳ Pendiente'}
            color={instructor?.verification_status === 'verificado' ? 'success' : 'warning'}
          />
        </View>
      </View>

      {/* Bio */}
      <Input label="SOBRE MÍ" placeholder="Contá tu experiencia y lo que te apasiona..."
        value={bio} onChangeText={setBio} multiline />

      {/* Barrio */}
      <Input label="BARRIO BASE" placeholder="Ej: Palermo"
        value={neighborhood} onChangeText={setNeighborhood} />

      {/* Teléfono */}
      <Input label="TELÉFONO" placeholder="11 5555-6666"
        value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

      {/* Especialidades */}
      <Text style={styles.sectionTitle}>MIS ESPECIALIDADES</Text>
      <View style={styles.specialtiesGrid}>
        {SPECIALTIES.map(sp => (
          <TouchableOpacity key={sp.key}
            style={[styles.specChip, selectedSpecialties.includes(sp.key) && styles.specChipActive]}
            onPress={() => toggleSpecialty(sp.key)}>
            <Text style={[styles.specText, selectedSpecialties.includes(sp.key) && styles.specTextActive]}>
              {sp.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Button label="Guardar perfil" onPress={() => saveMutation.mutate()}
        isLoading={saveMutation.isPending} fullWidth size="lg" style={{ marginTop: spacing.xl }} />

      <Button label="Cerrar sesión" variant="ghost" onPress={handleSignOut}
        fullWidth style={{ marginTop: spacing.md }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  avatarSection: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl },
  editBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: colors.white, borderRadius: 12, width: 24, height: 24,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: colors.border,
  },
  profileName: { fontFamily: 'Nunito-Bold', fontSize: 18, color: colors.dark, marginBottom: spacing.xs },
  sectionTitle: { ...typography.label, color: colors.mid, marginBottom: spacing.sm },
  specialtiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  specChip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.white, borderWidth: 0.5, borderColor: colors.border },
  specChipActive: { backgroundColor: colors.sage, borderColor: colors.sage },
  specText: { ...typography.small, color: colors.mid },
  specTextActive: { color: colors.sage, fontFamily: 'Nunito-SemiBold' },
})
