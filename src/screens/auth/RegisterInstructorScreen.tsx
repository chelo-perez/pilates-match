// src/screens/auth/RegisterInstructorScreen.tsx
import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, TouchableOpacity } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { supabase } from '../../lib/supabase'
import { instructorAPI } from '../../lib/api'
import { humanizeError } from '../../lib/errors'
import { startRegistration, finishRegistration, abandonRegistration } from '../../lib/auth'
import BarrioSelect from '../../components/BarrioSelect'
import CamaraSelect from '../../components/CamaraSelect'
import { VERIFICATION_STATUS } from '../../constants/labels'
import { Button, Input, Card, Avatar, Badge, colors, spacing, radius, typography } from '../../components/ui'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'

// ── Schemas por paso ────────────────────────────────────────
const currentYear = new Date().getFullYear()

const schemaPersonal = z.object({
  fullName:     z.string().trim().min(3, 'Escribí tu nombre y apellido'),
  dni:          z.string().trim().regex(/^\d{7,8}$/, 'Ingresá el DNI sin puntos (7 u 8 números)'),
  phone:        z.string().trim().regex(/^[\d\s()+-]{8,20}$/, 'Teléfono inválido'),
  neighborhood: z.string().min(1, 'Elegí tu barrio'),
})

const schemaCert = z.object({
  institution: z.string().trim().min(2, 'Escribí dónde te formaste'),
  year: z.string().trim().regex(/^\d{4}$/, 'Año inválido')
    .refine(v => Number(v) >= 1950 && Number(v) <= currentYear, `Entre 1950 y ${currentYear}`),
})

const schemaAccess = z.object({
  email:    z.string().trim().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
})

type PersonalForm = z.infer<typeof schemaPersonal>
type CertForm    = z.infer<typeof schemaCert>
type AccessForm  = z.infer<typeof schemaAccess>

const TOTAL_STEPS = 4

type Props = NativeStackScreenProps<any, 'RegisterInstructor'>

export default function RegisterInstructorScreen({ navigation }: Props) {
  const { toast, showToast, hideToast } = useToast()
  const insets = useSafeAreaInsets()
  const [loading, setLoading]                 = useState(false)
  const [step, setStep]                       = useState(1)
  const [camaraId, setCamaraId]               = useState<string | null>(null)
  const [searchQuery, setSearchQuery]         = useState('')
  const [searchResults, setSearchResults]     = useState<any[] | null>(null)
  const [searching, setSearching]             = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<any>(null)
  const [personalData, setPersonalData]       = useState<PersonalForm | null>(null)
  const [certData, setCertData]               = useState<CertForm | null>(null)

  const personal = useForm<PersonalForm>({ resolver: zodResolver(schemaPersonal), defaultValues: { fullName: '', dni: '', phone: '', neighborhood: '' } })
  const cert     = useForm<CertForm>({ resolver: zodResolver(schemaCert), defaultValues: { institution: '', year: '' } })
  const access   = useForm<AccessForm>({ resolver: zodResolver(schemaAccess), defaultValues: { email: '', password: '' } })
  const neighborhood = personal.watch('neighborhood')

  // Si sale del formulario a mitad con la cuenta ya creada, va al onboarding
  useEffect(() => () => abandonRegistration(), [])

  // ── Búsqueda en directorio ──────────────────────────────
  const searchInDirectory = async () => {
    const q = searchQuery.trim()
    if (q.length < 3) { showToast('Escribí al menos 3 letras de tu nombre', 'warning'); return }
    setSearching(true)
    // Sin sesión no se puede leer la tabla: esta función devuelve solo datos no sensibles
    const { data, error } = await supabase.rpc('search_unclaimed_instructors', { p_query: q })
    setSearching(false)
    if (error) { showToast(humanizeError(error), 'error'); return }
    setSearchResults(data ?? [])
  }

  const claimProfile = (profile: any) => {
    setSelectedProfile(profile)
    personal.setValue('fullName', profile.full_name ?? '')
    if (profile.neighborhood) personal.setValue('neighborhood', profile.neighborhood)
    setStep(2) // Pide datos personales (el DNI valida el reclamo) y después salta el certificado
  }

  const back = () => {
    if (step === 1) navigation.goBack()
    else if (step === 4 && selectedProfile) setStep(2)
    else if (step === 2 && selectedProfile) { setSelectedProfile(null); setStep(1) }
    else setStep(s => s - 1)
  }

  // ── Submit final ────────────────────────────────────────
  const onSubmit = async (data: AccessForm) => {
    if (!personalData) { setStep(2); return }
    setLoading(true)
    try {
      const res = await startRegistration(data.email, data.password, 'instructor', personalData.fullName.trim())
      if ('needsConfirmation' in res) {
        Alert.alert(
          'Confirmá tu email',
          `Te mandamos un mail a ${res.email}. Abrí el link y después iniciá sesión para terminar de crear tu perfil.`,
          [{ text: 'Entendido', onPress: () => navigation.navigate('Login') }],
        )
        return
      }
      const userId = res.userId

      // ¿Ya quedó creado el perfil en un intento anterior?
      const { data: existing, error: exError } = await supabase
        .from('instructors').select('id').eq('user_id', userId).maybeSingle()
      if (exError) throw exError

      let instructorId = existing?.id as string | undefined

      if (!instructorId && selectedProfile) {
        // Reclamar perfil del directorio (la base valida el DNI)
        await instructorAPI.claimProfile(selectedProfile.id, personalData.dni)
        instructorId = selectedProfile.id
      }

      if (instructorId) {
        const { error: updError } = await supabase.from('instructors').update({
          dni:          personalData.dni,
          phone:        personalData.phone.trim(),
          email:        data.email.trim().toLowerCase(),
          neighborhood: personalData.neighborhood,
        }).eq('id', instructorId)
        if (updError) throw updError
      } else {
        const { data: instrData, error: instrError } = await supabase
          .from('instructors')
          .insert({
            user_id:      userId,
            full_name:    personalData.fullName.trim(),
            dni:          personalData.dni,
            phone:        personalData.phone.trim(),
            email:        data.email.trim().toLowerCase(),
            neighborhood: personalData.neighborhood,
            camara_id:    camaraId,
            verification_status: 'pendiente',
            is_active:    true,
          })
          .select('id')
          .single()
        if (instrError) throw instrError
        instructorId = instrData.id
      }

      if (certData && instructorId && !selectedProfile) {
        const { error: certError } = await supabase.from('certifications').insert({
          instructor_id: instructorId,
          name:          'Formación en Pilates',
          institution:   certData.institution.trim(),
          year:          parseInt(certData.year, 10),
          review_status: 'pending',
        })
        if (certError) throw certError
      }

      Alert.alert(
        '¡Cuenta creada!',
        'Tu perfil quedó pendiente de verificación por la Cámara. Podés ver el estado desde Inicio.',
        [{ text: 'Entendido' }],
      )
      await finishRegistration(userId)
    } catch (e) {
      showToast(humanizeError(e), 'error')
    } finally {
      setLoading(false)
    }
  }

  const firstName = (selectedProfile?.full_name ?? '').split(' ')[0]

  // ── Render ──────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.cream }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Button label="← Volver" variant="ghost" size="sm" onPress={back} style={styles.backBtn} />

        <View style={styles.progress}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View key={i} style={[styles.progressDot, i + 1 <= step && styles.progressDotActive]} />
          ))}
        </View>

        {/* ── PASO 1: Buscar perfil ── */}
        {step === 1 && (
          <>
            <Text style={styles.title}>¿Ya estás en{'\n'}el directorio?</Text>
            <View style={styles.infoBanner}>
              <Feather name="search" size={16} color={colors.sage} style={{ marginRight: spacing.sm, marginTop: 1 }} />
              <Text style={[styles.infoText, { flex: 1 }]}>
                La Cámara puede haberte cargado. Buscá tu nombre para reclamar tu perfil.
              </Text>
            </View>

            <View style={styles.searchRow}>
              <Input
                placeholder="Tu nombre y apellido"
                value={searchQuery} onChangeText={setSearchQuery}
                autoCapitalize="words" returnKeyType="search" onSubmitEditing={searchInDirectory}
                containerStyle={{ flex: 1, marginBottom: 0 }}
              />
              <Button label="Buscar" onPress={searchInDirectory} isLoading={searching} style={{ marginLeft: spacing.sm }} />
            </View>

            {searchResults?.map(r => (
              <Card key={r.id} style={styles.resultCard} onPress={() => claimProfile(r)}>
                <Avatar name={r.full_name} size={36} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={styles.resultName}>{r.full_name}</Text>
                  {r.neighborhood ? <Text style={styles.resultMeta}>{r.neighborhood}</Text> : null}
                </View>
                <Badge
                  label={VERIFICATION_STATUS[r.verification_status]?.label ?? 'Pendiente'}
                  variant={VERIFICATION_STATUS[r.verification_status]?.variant ?? 'warning'}
                />
              </Card>
            ))}
            {searchResults && searchResults.length === 0 && (
              <Text style={styles.emptyText}>No encontramos perfiles sin reclamar con ese nombre. Podés crear uno nuevo.</Text>
            )}

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>o</Text>
              <View style={styles.dividerLine} />
            </View>

            <Button label="Crear perfil nuevo →" onPress={() => { setSelectedProfile(null); setStep(2) }} fullWidth variant="secondary" />

            <TouchableOpacity style={styles.loginLink} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginText}>
                ¿Ya tenés cuenta?{' '}
                <Text style={{ color: colors.sage, fontFamily: 'Nunito-SemiBold' }}>Iniciá sesión</Text>
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── PASO 2: Datos personales ── */}
        {step === 2 && (
          <>
            <Text style={styles.title}>Datos personales</Text>
            <Text style={styles.sub}>
              Paso 2 de {TOTAL_STEPS} · {selectedProfile ? 'Tu DNI tiene que coincidir con el que cargó la Cámara' : 'La Cámara los usa para verificar tu identidad'}
            </Text>

            <Controller control={personal.control} name="fullName"
              render={({ field: { onChange, value } }) => (
                <Input label="NOMBRE Y APELLIDO" placeholder="Martina Ruiz" autoCapitalize="words"
                  value={value} onChangeText={onChange} editable={!selectedProfile}
                  error={personal.formState.errors.fullName?.message} />
              )}
            />
            <Controller control={personal.control} name="dni"
              render={({ field: { onChange, value } }) => (
                <Input label="DNI (SIN PUNTOS)" placeholder="32445871" maxLength={8}
                  value={value} onChangeText={(t: string) => onChange(t.replace(/\D/g, ''))} keyboardType="number-pad"
                  error={personal.formState.errors.dni?.message} />
              )}
            />
            <Controller control={personal.control} name="phone"
              render={({ field: { onChange, value } }) => (
                <Input label="TELÉFONO" placeholder="11 5555-6666"
                  value={value} onChangeText={onChange} keyboardType="phone-pad"
                  error={personal.formState.errors.phone?.message} />
              )}
            />

            {!selectedProfile && <CamaraSelect kind="instructor" value={camaraId} onChange={setCamaraId} />}
            <BarrioSelect label="BARRIO DONDE VIVÍS" placeholder="Elegí tu barrio" value={neighborhood}
              onChange={n => personal.setValue('neighborhood', n, { shouldValidate: true })}
              error={personal.formState.errors.neighborhood?.message} />

            <Button label="Continuar →" size="lg" fullWidth
              onPress={personal.handleSubmit(data => {
                setPersonalData(data)
                setStep(selectedProfile ? 4 : 3)
              })}
              style={{ marginTop: spacing.lg }}
            />
          </>
        )}

        {/* ── PASO 3: Certificación ── */}
        {step === 3 && (
          <>
            <Text style={styles.title}>Formación</Text>
            <Text style={styles.sub}>Paso 3 de {TOTAL_STEPS} · La Cámara revisa tus certificaciones</Text>

            <Controller control={cert.control} name="institution"
              render={({ field: { onChange, value } }) => (
                <Input label="INSTITUCIÓN" placeholder="Ej: BASI Pilates, Stott, Body Arts..."
                  value={value} onChangeText={onChange}
                  error={cert.formState.errors.institution?.message} />
              )}
            />
            <Controller control={cert.control} name="year"
              render={({ field: { onChange, value } }) => (
                <Input label="AÑO DE EGRESO" placeholder="2020" maxLength={4}
                  value={value} onChangeText={onChange} keyboardType="number-pad"
                  error={cert.formState.errors.year?.message} />
              )}
            />

            <View style={styles.infoBox}>
              <Text style={styles.infoBoxText}>
                Después de registrarte podés subir el certificado (PDF o foto) y sumar otros desde tu perfil.
              </Text>
            </View>

            <Button label="Continuar →" size="lg" fullWidth
              onPress={cert.handleSubmit(data => { setCertData(data); setStep(4) })}
              style={{ marginTop: spacing.md }}
            />
          </>
        )}

        {/* ── PASO 4: Acceso ── */}
        {step === 4 && (
          <>
            <Text style={styles.title}>{selectedProfile ? `¡Hola, ${firstName}!` : 'Crear acceso'}</Text>
            <Text style={styles.sub}>Paso 4 de {TOTAL_STEPS} · Tu email y contraseña</Text>

            {selectedProfile && (
              <View style={styles.claimBanner}>
                <Feather name="check-circle" size={16} color={colors.sage} />
                <Text style={[styles.infoText, { flex: 1, color: colors.sage }]}>
                  Vas a reclamar el perfil de{' '}
                  <Text style={{ fontFamily: 'Nunito-SemiBold' }}>{selectedProfile.full_name}</Text>
                </Text>
              </View>
            )}

            <Controller control={access.control} name="email"
              render={({ field: { onChange, value } }) => (
                <Input label="EMAIL" placeholder="martina@mail.com" autoComplete="email" textContentType="emailAddress"
                  value={value} onChangeText={onChange} keyboardType="email-address"
                  error={access.formState.errors.email?.message} />
              )}
            />
            <Controller control={access.control} name="password"
              render={({ field: { onChange, value } }) => (
                <Input label="CONTRASEÑA" placeholder="Mínimo 8 caracteres" textContentType="newPassword"
                  value={value} onChangeText={onChange} secureTextEntry
                  error={access.formState.errors.password?.message} />
              )}
            />

            <View style={styles.infoBox}>
              <Text style={styles.infoBoxText}>
                Tu perfil queda pendiente hasta que la Cámara verifique tus datos. Mientras tanto podés completar horarios y tarifas.
              </Text>
            </View>

            <Button label="Crear cuenta" size="lg" fullWidth
              onPress={access.handleSubmit(onSubmit)}
              isLoading={loading}
              style={{ marginTop: spacing.md }}
            />
          </>
        )}
      </ScrollView>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: spacing.lg },
  backBtn: { alignSelf: 'flex-start', paddingHorizontal: 0, marginBottom: spacing.md },
  progress: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xl },
  progressDot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.sageLight },
  progressDotActive: { backgroundColor: colors.sage },
  title: { fontFamily: 'Nunito-Bold', fontSize: 24, color: colors.dark, marginBottom: 4 },
  sub: { ...typography.small, marginBottom: spacing.xl },
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.sageLight, ...radius.leaf,
    padding: spacing.md, marginVertical: spacing.lg,
    borderWidth: 0.5, borderColor: colors.mint,
  },
  claimBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.sageLighter, ...radius.leaf,
    padding: spacing.md, marginBottom: spacing.lg,
  },
  infoText: { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, lineHeight: 19 },
  infoBox: { backgroundColor: colors.sageLighter, ...radius.leaf, padding: spacing.md, marginTop: spacing.sm },
  infoBoxText: { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, lineHeight: 19 },
  fieldLabel: { ...typography.caption, marginBottom: spacing.sm },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  errorText: { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.redTx, marginTop: 4, marginBottom: spacing.sm },
  searchRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: spacing.md },
  resultCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, marginBottom: spacing.sm },
  resultName: { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.dark },
  resultMeta: { ...typography.small, color: colors.mid },
  emptyText: { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, textAlign: 'center', marginVertical: spacing.sm },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: colors.border },
  dividerText: { ...typography.small, marginHorizontal: spacing.md },
  loginLink: { alignItems: 'center', marginTop: spacing.xl },
  loginText: { ...typography.body },
})
