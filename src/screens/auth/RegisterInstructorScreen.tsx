// src/screens/auth/RegisterInstructorScreen.tsx
import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, Alert, TouchableOpacity
} from 'react-native'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '../../lib/supabase'
import { authAPI, instructorAPI } from '../../lib/api'
import { Button, Input, Card, Avatar, Badge, colors, spacing, radius, typography } from '../../components/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

// ── Schemas por paso ────────────────────────────────────────

const schemaPersonal = z.object({
  fullName:  z.string().min(2, 'Nombre requerido'),
  dni:       z.string().min(7, 'DNI inválido').max(8, 'DNI inválido'),
  birthDate: z.string().min(8, 'Fecha inválida'),
  phone:     z.string().min(8, 'Teléfono inválido'),
  neighborhood: z.string().min(2, 'Barrio requerido'),
})

const schemaCert = z.object({
  institution: z.string().min(2, 'Institución requerida'),
  year:        z.string().min(4, 'Año inválido').max(4, 'Año inválido'),
})

const schemaAccess = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type PersonalForm = z.infer<typeof schemaPersonal>
type CertForm    = z.infer<typeof schemaCert>
type AccessForm  = z.infer<typeof schemaAccess>

const NEIGHBORHOODS = [
  'Palermo', 'Villa Crespo', 'Almagro', 'Caballito', 'Belgrano',
  'Recoleta', 'Núñez', 'Colegiales', 'Flores', 'Floresta',
  'San Telmo', 'Balvanera', 'Villa Urquiza', 'Otro',
]

type Props = NativeStackScreenProps<any, 'RegisterInstructor'>

export default function RegisterInstructorScreen({ navigation }: Props) {
  const [loading, setLoading]           = useState(false)
  const [step, setStep]                 = useState(1)
  const [searchQuery, setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching]       = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<any>(null)
  const [personalData, setPersonalData] = useState<PersonalForm | null>(null)
  const [certData, setCertData]         = useState<CertForm | null>(null)
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('')

  // Forms
  const insets = useSafeAreaInsets()
  const personal = useForm<PersonalForm>({ resolver: zodResolver(schemaPersonal) })
  const cert     = useForm<CertForm>({ resolver: zodResolver(schemaCert) })
  const access   = useForm<AccessForm>({ resolver: zodResolver(schemaAccess) })

  const TOTAL_STEPS = 4

  // ── Búsqueda en directorio ──────────────────────────────
  const searchInDirectory = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    const { data } = await supabase
      .from('instructors')
      .select('id, full_name, neighborhood, verification_status')
      .ilike('full_name', `%${searchQuery}%`)
      .is('user_id', null)
      .limit(5)
    setSearchResults(data ?? [])
    setSearching(false)
  }

  const claimProfile = (profile: any) => {
    setSelectedProfile(profile)
    setStep(4) // Si reclama perfil va directo al acceso
  }

  // ── Submit final ────────────────────────────────────────
  const onSubmit = async (data: AccessForm) => {
    if (!personalData) return
    try {
      setLoading(true)

      // 1. Crear usuario en Auth
      const authData = await authAPI.signUp(
        data.email, data.password, 'instructor', personalData.fullName
      )
      const user = authData.user
      if (!user) throw new Error('Error creando usuario')

      // 2. Esperar trigger
      await new Promise(r => setTimeout(r, 1000))

      if (selectedProfile) {
        // Reclamar perfil existente del directorio
        await instructorAPI.claimProfile(selectedProfile.id)

        // Actualizar con los datos nuevos que ingresó
        await supabase.from('instructors').update({
          dni:          personalData.dni,
          phone:        personalData.phone,
          neighborhood: selectedNeighborhood || personalData.neighborhood,
        }).eq('id', selectedProfile.id)

      } else {
        // Crear perfil nuevo
        const { data: instrData, error: instrError } = await supabase
          .from('instructors')
          .insert({
            user_id:      user.id,
            full_name:    personalData.fullName,
            dni:          personalData.dni,
            phone:        personalData.phone,
            neighborhood: selectedNeighborhood || personalData.neighborhood,
            verification_status: 'pendiente',
          })
          .select('id')
          .single()

        if (instrError) throw new Error(instrError.message)

        // Agregar certificación si se completó
        if (certData && instrData) {
          await supabase.from('certifications').insert({
            instructor_id: instrData.id,
            name:          'Formación en Pilates',
            institution:   certData.institution,
            year:          parseInt(certData.year),
            verified:      false,
          })
        }
      }

      Alert.alert(
        '¡Cuenta creada!',
        'Tu perfil está pendiente de verificación por la Cámara. Te notificaremos cuando esté aprobado.',
        [{ text: 'Entendido' }]
      )

    } catch (e: any) {
      Alert.alert('Error al registrarse', e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Render ──────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 20 }]} keyboardShouldPersistTaps="handled">

        {/* Barra de progreso */}
        <View style={styles.progress}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View key={i} style={[
              styles.progressDot,
              { backgroundColor: i + 1 <= step ? colors.lavDark : colors.lavender }
            ]} />
          ))}
        </View>

        {/* ── PASO 1: Buscar perfil ── */}
        {step === 1 && (
          <>
            <Text style={styles.title}>¿Ya estás en{'\n'}el directorio?</Text>
            <View style={styles.infoBanner}>
              <Text style={{ fontSize: 18, marginRight: spacing.sm }}>🏛️</Text>
              <Text style={[styles.infoText, { flex: 1 }]}>
                La Cámara puede haberte cargado. Buscá tu nombre para reclamar tu perfil.
              </Text>
            </View>

            <View style={styles.searchRow}>
              <Input
                label="" placeholder="Tu nombre y apellido..."
                value={searchQuery} onChangeText={setSearchQuery}
                style={{ flex: 1, marginBottom: 0 }}
              />
              <Button label="Buscar" onPress={searchInDirectory}
                isLoading={searching} style={{ marginLeft: spacing.sm }} />
            </View>

            {searchResults.map(r => (
              <Card key={r.id} style={styles.resultCard} onPress={() => claimProfile(r)}>
                <Avatar name={r.full_name} size={36} color={colors.lavender} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={styles.resultName}>{r.full_name}</Text>
                  <Text style={styles.resultMeta}>{r.neighborhood}</Text>
                </View>
                <Badge
                  label={r.verification_status === 'verificado' ? '✓ Verificado' : 'Pendiente'}
                  color={r.verification_status === 'verificado' ? 'success' : 'warning'}
                />
              </Card>
            ))}

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>o</Text>
              <View style={styles.dividerLine} />
            </View>

            <Button label="Crear perfil nuevo →" onPress={() => setStep(2)}
              fullWidth variant="secondary" />
          </>
        )}

        {/* ── PASO 2: Datos personales ── */}
        {step === 2 && (
          <>
            <Text style={styles.title}>Datos personales</Text>
            <Text style={styles.sub}>Paso 2 de {TOTAL_STEPS} · La Cámara los usa para verificar tu identidad</Text>

            <Controller control={personal.control} name="fullName"
              render={({ field: { onChange, value } }) => (
                <Input label="NOMBRE Y APELLIDO *" placeholder="Martina Ruiz"
                  value={value ?? ''} onChangeText={onChange}
                  error={personal.formState.errors.fullName?.message} />
              )}
            />
            <Controller control={personal.control} name="dni"
              render={({ field: { onChange, value } }) => (
                <Input label="DNI *" placeholder="32445871"
                  value={value ?? ''} onChangeText={onChange} keyboardType="numeric"
                  error={personal.formState.errors.dni?.message} />
              )}
            />
            <Controller control={personal.control} name="birthDate"
              render={({ field: { onChange, value } }) => (
                <Input
                  label="FECHA DE NACIMIENTO *"
                  placeholder="DD/MM/AAAA"
                  value={value ?? ''}
                  onChangeText={(text) => {
                    // Auto-insertar / después de DD y MM
                    const digits = text.replace(/\D/g, '')
                    let formatted = digits
                    if (digits.length >= 3) {
                      formatted = digits.slice(0, 2) + '/' + digits.slice(2)
                    }
                    if (digits.length >= 5) {
                      formatted = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8)
                    }
                    onChange(formatted)
                  }}
                  keyboardType="numeric"
                  error={personal.formState.errors.birthDate?.message}
                />
              )}
            />
            <Controller control={personal.control} name="phone"
              render={({ field: { onChange, value } }) => (
                <Input label="TELÉFONO *" placeholder="1155556666"
                  value={value ?? ''} onChangeText={onChange} keyboardType="phone-pad"
                  error={personal.formState.errors.phone?.message} />
              )}
            />

            <Text style={styles.fieldLabel}>BARRIO EN QUE VIVÍS *</Text>
            <View style={styles.neighborhoodGrid}>
              {NEIGHBORHOODS.map(n => (
                <TouchableOpacity
                  key={n}
                  style={[styles.neighborhoodChip, selectedNeighborhood === n && styles.neighborhoodChipActive]}
                  onPress={() => { setSelectedNeighborhood(n); personal.setValue('neighborhood', n) }}
                >
                  <Text style={[styles.neighborhoodText, selectedNeighborhood === n && styles.neighborhoodTextActive]}>
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {personal.formState.errors.neighborhood && (
              <Text style={styles.errorText}>{personal.formState.errors.neighborhood.message}</Text>
            )}

            <Button label="Continuar →" size="lg" fullWidth
              onPress={personal.handleSubmit(data => {
                setPersonalData(data)
                setStep(3)
              })}
              style={{ marginTop: spacing.lg }}
            />
          </>
        )}

        {/* ── PASO 3: Certificación ── */}
        {step === 3 && (
          <>
            <Text style={styles.title}>Formación</Text>
            <Text style={styles.sub}>Paso 3 de {TOTAL_STEPS} · La Cámara verificará tus certificaciones</Text>

            <View style={styles.infoBanner}>
              <Text style={{ fontSize: 18, marginRight: spacing.sm }}>🎓</Text>
              <Text style={[styles.infoText, { flex: 1 }]}>
                Ingresá al menos una certificación. Podés agregar más desde tu perfil después de registrarte.
              </Text>
            </View>

            <Controller control={cert.control} name="institution"
              render={({ field: { onChange, value } }) => (
                <Input label="INSTITUCIÓN *" placeholder="Ej: BASI Pilates, Stott, Body Arts..."
                  value={value ?? ''} onChangeText={onChange}
                  error={cert.formState.errors.institution?.message} />
              )}
            />
            <Controller control={cert.control} name="year"
              render={({ field: { onChange, value } }) => (
                <Input label="AÑO DE EGRESO *" placeholder="2020"
                  value={value ?? ''} onChangeText={onChange} keyboardType="numeric"
                  error={cert.formState.errors.year?.message} />
              )}
            />

            <View style={styles.infoBox}>
              <Text style={styles.infoBoxText}>
                📎 La Cámara puede pedirte el documento de certificación por mail para completar la verificación.
              </Text>
            </View>

            <Button label="Continuar →" size="lg" fullWidth
              onPress={cert.handleSubmit(data => {
                setCertData(data)
                setStep(4)
              })}
              style={{ marginTop: spacing.md }}
            />
          </>
        )}

        {/* ── PASO 4: Acceso ── */}
        {step === 4 && (
          <>
            <Text style={styles.title}>
              {selectedProfile
                ? `Bienvenida, ${selectedProfile.full_name.split(' ')[0]}`
                : 'Crear acceso'}
            </Text>
            <Text style={styles.sub}>Paso 4 de {TOTAL_STEPS} · Tu email y contraseña</Text>

            {selectedProfile && (
              <View style={styles.claimBanner}>
                <Text style={{ fontSize: 16 }}>✓</Text>
                <Text style={[styles.infoText, { flex: 1, color: colors.success }]}>
                  Vas a reclamar el perfil de{' '}
                  <Text style={{ fontFamily: 'DM_Sans-SemiBold' }}>{selectedProfile.full_name}</Text>
                </Text>
              </View>
            )}

            <Controller control={access.control} name="email"
              render={({ field: { onChange, value } }) => (
                <Input label="EMAIL *" placeholder="martina@mail.com"
                  value={value ?? ''} onChangeText={onChange} keyboardType="email-address"
                  error={access.formState.errors.email?.message} />
              )}
            />
            <Controller control={access.control} name="password"
              render={({ field: { onChange, value } }) => (
                <Input label="CONTRASEÑA *" placeholder="Mínimo 6 caracteres"
                  value={value ?? ''} onChangeText={onChange} secureTextEntry
                  error={access.formState.errors.password?.message} />
              )}
            />

            <View style={styles.infoBox}>
              <Text style={styles.infoBoxText}>
                ⏳ Tu perfil quedará pendiente hasta que la Cámara verifique tu documentación. Te avisamos por email cuando esté aprobado.
              </Text>
            </View>

            <Button label="Crear cuenta" size="lg" fullWidth
              onPress={access.handleSubmit(onSubmit)}
              isLoading={loading}
              style={{ marginTop: spacing.md }}
            />
          </>
        )}

        {/* Botón atrás */}
        {step > 1 && (
          <Button label="← Atrás" variant="ghost"
            onPress={() => {
              if (step === 4 && selectedProfile) setStep(1)
              else setStep(s => s - 1)
            }}
            fullWidth style={{ marginTop: spacing.sm }}
          />
        )}

        {/* Link a login */}
        {step === 1 && (
          <TouchableOpacity style={styles.loginLink} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginText}>
              ¿Ya tenés cuenta?{' '}
              <Text style={{ color: colors.lavDark, fontFamily: 'DM_Sans-SemiBold' }}>Iniciá sesión</Text>
            </Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.cream, padding: spacing.xl },
  progress: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xl },
  progressDot: { flex: 1, height: 3, borderRadius: 2 },
  title: { fontFamily: 'Playfair_Display-Medium', fontSize: 24, color: colors.dark, marginBottom: 4 },
  sub: { ...typography.small, color: colors.mid, marginBottom: spacing.xl },
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.sageLight, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.lg,
    borderWidth: 0.5, borderColor: colors.sageMid,
  },
  claimBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.successBg, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.lg,
  },
  infoText: { ...typography.small, color: colors.mid, lineHeight: 18 },
  infoBox: {
    backgroundColor: colors.lavLight, borderRadius: radius.md,
    padding: spacing.md, marginTop: spacing.sm,
  },
  infoBoxText: { ...typography.small, color: colors.mid, lineHeight: 18 },
  fieldLabel: { ...typography.label, color: colors.mid, marginBottom: spacing.sm },
  neighborhoodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  neighborhoodChip: {
    paddingVertical: 7, paddingHorizontal: 14,
    borderRadius: radius.full, backgroundColor: colors.white,
    borderWidth: 0.5, borderColor: colors.border,
  },
  neighborhoodChipActive: { backgroundColor: colors.lavDark, borderColor: colors.lavDark },
  neighborhoodText: { ...typography.small, color: colors.mid },
  neighborhoodTextActive: { color: colors.white, fontFamily: 'DM_Sans-SemiBold' },
  errorText: { ...typography.small, color: colors.danger, marginTop: 4, marginBottom: spacing.sm },
  searchRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: spacing.md },
  resultCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, marginBottom: spacing.sm },
  resultName: { fontFamily: 'DM_Sans-SemiBold', fontSize: 14, color: colors.dark },
  resultMeta: { ...typography.small, color: colors.mid },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: colors.border },
  dividerText: { ...typography.small, color: colors.light, marginHorizontal: spacing.md },
  loginLink: { alignItems: 'center', marginTop: spacing.xl },
  loginText: { ...typography.body, color: colors.mid },
})
