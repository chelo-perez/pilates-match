// src/screens/auth/RegisterStudioScreen.tsx
import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { supabase } from '../../lib/supabase'
import { humanizeError } from '../../lib/errors'
import { toLocalISODate } from '../../lib/dates'
import { startRegistration, finishRegistration, abandonRegistration } from '../../lib/auth'
import BarrioSelect from '../../components/BarrioSelect'
import CamaraSelect from '../../components/CamaraSelect'
import { Button, Input, Badge, colors, spacing, radius, typography } from '../../components/ui'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import { entity } from '../../lib/entity'

const schema = z.object({
  studioName: z.string().trim().min(2, 'Escribí el nombre del estudio'),
  neighborhood: z.string().min(1, 'Elegí el barrio del estudio'),
  phone: z.string().trim().optional().refine(v => !v || /^[\d\s()+-]{8,20}$/.test(v), 'Teléfono inválido'),
  email: z.string().trim().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  camaraCode: z.string().trim().optional(),
})
type Form = z.infer<typeof schema>

const STEP_FIELDS: Record<number, (keyof Form)[]> = {
  1: ['studioName', 'neighborhood', 'phone'],
  2: ['email', 'password'],
  3: ['camaraCode'],
}
const STEP_TITLES = ['Tu negocio', 'Acceso', 'Código de socio']

type Props = NativeStackScreenProps<any, 'RegisterStudio'>

export default function RegisterStudioScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { toast, showToast, hideToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const [codeStatus, setCodeStatus] = useState<'idle' | 'checking' | 'free' | 'taken'>('idle')
  const [camaraId, setCamaraId] = useState<string | null>(null)

  const { control, handleSubmit, watch, setValue, trigger, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { studioName: '', neighborhood: '', phone: '', email: '', password: '', camaraCode: '' },
  })
  const neighborhood = watch('neighborhood')
  const camaraCode = watch('camaraCode')?.trim()

  // Si sale del formulario a mitad con la cuenta ya creada, va al onboarding
  useEffect(() => () => abandonRegistration(), [])

  const next = async () => {
    const ok = await trigger(STEP_FIELDS[step])
    if (ok) setStep(s => s + 1)
  }

  const back = () => (step > 1 ? setStep(s => s - 1) : navigation.goBack())

  const checkCode = async () => {
    if (!camaraCode) return
    setCodeStatus('checking')
    const { data, error } = await supabase.from('studios').select('id').eq('camara_code', camaraCode).maybeSingle()
    if (error) { setCodeStatus('idle'); showToast(humanizeError(error), 'error'); return }
    setCodeStatus(data ? 'taken' : 'free')
  }

  const onSubmit = async (data: Form) => {
    if (codeStatus === 'taken') { showToast('Ese código ya está asociado a otro estudio', 'warning'); return }
    setLoading(true)
    try {
      const res = await startRegistration(data.email, data.password, 'estudio', data.studioName.trim())
      if ('needsConfirmation' in res) {
        Alert.alert(
          'Confirmá tu email',
          `Te mandamos un mail a ${res.email}. Abrí el link y después iniciá sesión para terminar de crear tu estudio.`,
          [{ text: 'Entendido', onPress: () => navigation.navigate('Login') }],
        )
        return
      }
      if (res.isCamaraAdmin) return // entra como administrador/a de la Cámara
      const userId = res.userId

      // Estudio (si ya existe de un intento anterior, seguimos)
      const { error: studioError } = await supabase.from('studios').insert({
        user_id: userId,
        name: data.studioName.trim(),
        neighborhood: data.neighborhood,
        phone: data.phone?.trim() || null,
        camara_code: data.camaraCode?.trim() || null,
        camara_id: camaraId,
        owner_email: data.email.trim().toLowerCase(),
      })
      if (studioError && !(studioError.code === '23505' && !(studioError.message ?? '').includes('camara_code'))) {
        throw studioError
      }
      const { data: studio, error: getError } = await supabase.from('studios').select('id').eq('user_id', userId).single()
      if (getError) throw getError

      // Todos arrancan en Freemium; la Cámara cambia el plan al validar el código
      const end = new Date()
      end.setFullYear(end.getFullYear() + 10)
      const { error: memError } = await supabase.from('memberships').insert({
        studio_id: studio.id,
        status: 'activa',
        plan_type: 'freemium',
        matches_limit: 1,
        matches_used_month: 0,
        start_date: toLocalISODate(new Date()),
        end_date: toLocalISODate(end),
      })
      if (memError && memError.code !== '23505') throw memError

      await finishRegistration(userId)
    } catch (e) {
      showToast(humanizeError(e), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.cream }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Button label="← Volver" variant="ghost" size="sm" onPress={back} style={styles.backBtn} />

        <View style={styles.progress}>
          {[1, 2, 3].map(s => (
            <View key={s} style={[styles.progressDot, s <= step && styles.progressDotActive]} />
          ))}
        </View>

        <Text style={styles.title}>{STEP_TITLES[step - 1]}</Text>
        <Text style={styles.sub}>Paso {step} de 3</Text>

        {step === 1 && (
          <>
            <CamaraSelect kind="estudio" value={camaraId} onChange={setCamaraId} />
            <Controller control={control} name="studioName"
              render={({ field: { onChange, value } }) => (
                <Input label="NOMBRE DEL ESTUDIO" placeholder="Studio Zen Palermo" autoCapitalize="words"
                  value={value} onChangeText={onChange} error={errors.studioName?.message} />
              )}
            />
            <BarrioSelect label="BARRIO" value={neighborhood}
              onChange={n => setValue('neighborhood', n, { shouldValidate: true })}
              error={errors.neighborhood?.message} />
            <Controller control={control} name="phone"
              render={({ field: { onChange, value } }) => (
                <Input label="TELÉFONO (OPCIONAL)" placeholder="11 4444-5555" containerStyle={{ marginTop: spacing.md }}
                  value={value} onChangeText={onChange} keyboardType="phone-pad" error={errors.phone?.message} />
              )}
            />
          </>
        )}

        {step === 2 && (
          <>
            <Controller control={control} name="email"
              render={({ field: { onChange, value } }) => (
                <Input label="EMAIL" placeholder="hola@mipilates.com" autoComplete="email" textContentType="emailAddress"
                  value={value} onChangeText={onChange} keyboardType="email-address"
                  error={errors.email?.message} />
              )}
            />
            <Controller control={control} name="password"
              render={({ field: { onChange, value } }) => (
                <Input label="CONTRASEÑA" placeholder="Mínimo 8 caracteres" textContentType="newPassword"
                  value={value} onChangeText={onChange} secureTextEntry
                  error={errors.password?.message} />
              )}
            />
          </>
        )}

        {step === 3 && (
          <>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Si tu estudio es socio {entity().de}, ingresá el código que te dieron: {entity().la} lo valida y activa tu plan de socio. Si no tenés código, dejalo vacío: empezás con el plan Freemium (1 propuesta por mes) y podés asociarte más adelante.
              </Text>
            </View>
            <View style={styles.codeRow}>
              <Controller control={control} name="camaraCode"
                render={({ field: { onChange, value } }) => (
                  <Input label="CÓDIGO (OPCIONAL)" placeholder="CAM-2024-XXXX" autoCapitalize="characters" autoCorrect={false}
                    value={value} onChangeText={(t) => { onChange(t); setCodeStatus('idle') }}
                    containerStyle={{ flex: 1, marginBottom: 0 }} />
                )}
              />
              <Button label="Revisar" variant="secondary" size="sm" onPress={checkCode}
                isLoading={codeStatus === 'checking'} disabled={!camaraCode} style={{ marginLeft: spacing.sm, marginBottom: 6 }} />
            </View>
            {codeStatus === 'free' && <Badge label={`Código libre: ${entity().la} lo va a validar`} variant="success" style={{ marginTop: spacing.sm }} />}
            {codeStatus === 'taken' && <Badge label="Ese código ya lo usa otro estudio" variant="danger" style={{ marginTop: spacing.sm }} />}
          </>
        )}

        <View style={styles.actions}>
          {step < 3 ? (
            <Button label="Continuar →" onPress={next} fullWidth size="lg" />
          ) : (
            <Button label="Crear cuenta" onPress={handleSubmit(onSubmit, () => showToast('Revisá los datos de los pasos anteriores', 'warning'))}
              isLoading={loading} fullWidth size="lg" />
          )}
        </View>
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
  fieldLabel: { ...typography.caption, marginBottom: spacing.sm },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  errorText: { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.redTx, marginTop: spacing.xs },
  codeRow: { flexDirection: 'row', alignItems: 'flex-end' },
  infoBox: { backgroundColor: colors.sageLight, ...radius.leaf, padding: spacing.md, marginBottom: spacing.lg },
  infoText: { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, lineHeight: 19 },
  actions: { marginTop: spacing.xl },
})
