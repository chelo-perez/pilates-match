// src/screens/auth/RegisterStudioScreen.tsx
import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert
} from 'react-native'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '../../lib/supabase'
import { authAPI } from '../../lib/api'
import { Button, Input, Badge, colors, spacing, radius, typography } from '../../components/ui'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

const NEIGHBORHOODS = [
  'Palermo', 'Villa Crespo', 'Almagro', 'Caballito', 'Belgrano',
  'Recoleta', 'Núñez', 'Colegiales', 'Flores', 'Floresta', 'Otro'
]

const schema = z.object({
  studioName: z.string().min(2, 'Nombre requerido'),
  neighborhood: z.string().min(1, 'Barrio requerido'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  camaraCode: z.string().optional(),
})
type Form = z.infer<typeof schema>

type Props = NativeStackScreenProps<any, 'RegisterStudio'>

export default function RegisterStudioScreen({ navigation, route }: Props) {
  const role = route.params?.role ?? 'estudio'
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const [codeVerified, setCodeVerified] = useState(false)
  const [verifyingCode, setVerifyingCode] = useState(false)
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('')

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { studioName: '', neighborhood: '', phone: '', email: '', password: '', camaraCode: '' },
  })

  const camaraCode = watch('camaraCode')

  const verifyCode = async () => {
    if (!camaraCode) return
    setVerifyingCode(true)
    // Verificar que el código existe en la DB y no está usado
    const { data } = await supabase.from('studios').select('id').eq('camara_code', camaraCode).single()
    setVerifyingCode(false)
    setCodeVerified(!data) // Si no hay estudio con ese código, es válido
    if (data) Alert.alert('Código en uso', 'Este código ya está asociado a otro estudio.')
  }

  const onSubmit = async (data: Form) => {
    try {
      setLoading(true)
      console.log('PASO 1: Iniciando registro...')

      const authData = await authAPI.signUp(data.email, data.password, role, data.studioName)
      const user = authData.user
      console.log('PASO 1 OK - user id:', user?.id)
      if (!user) throw new Error('Error creando usuario')

      console.log('PASO 2: Esperando trigger...')
      await new Promise(r => setTimeout(r, 1000))

      console.log('PASO 3: Creando estudio...')
      const { data: studioData, error: studioError } = await supabase
        .from('studios')
        .insert({
          user_id: user.id,
          name: data.studioName,
          neighborhood: selectedNeighborhood || data.neighborhood,
          phone: data.phone || null,
          camara_code: data.camaraCode || null,
          is_member: codeVerified,
          member_since: codeVerified ? new Date().toISOString().split('T')[0] : null,
        })
        .select('id')
        .single()

      console.log('PASO 3 studioData:', JSON.stringify(studioData))
      console.log('PASO 3 studioError:', JSON.stringify(studioError))
      if (studioError) throw new Error('Error estudio: ' + studioError.message + ' | ' + studioError.code)
      if (!studioData?.id) throw new Error('No se pudo crear el estudio')

      console.log('PASO 4: Creando membresia con studio_id:', studioData.id)
      const { error: memError } = await supabase.from('memberships').insert({
        studio_id: studioData.id,
        status: 'activa',
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        matches_limit: codeVerified ? null : 3,
        monthly_price_ars: 15000,
      })

      console.log('PASO 4 memError:', JSON.stringify(memError))
      if (memError) throw new Error('Error membresia: ' + memError.message + ' | ' + memError.code)

      console.log('REGISTRO COMPLETADO OK')

    } catch (e: any) {
      console.log('ERROR FINAL:', e.message)
      Alert.alert('Error al registrarse', e.message)
    } finally {
      setLoading(false)
    }
  }


  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Progress */}
        <View style={styles.progress}>
          {[1, 2, 3].map(s => (
            <View key={s} style={[styles.progressDot, s <= step && styles.progressDotActive]} />
          ))}
        </View>

        <Text style={styles.title}>
          {step === 1 ? 'Tu estudio' : step === 2 ? 'Acceso' : 'Código de la Cámara'}
        </Text>
        <Text style={styles.sub}>Paso {step} de 3</Text>

        {step === 1 && (
          <>
            <Controller control={control} name="studioName"
              render={({ field: { onChange, value } }) => (
                <Input label="NOMBRE DEL ESTUDIO" placeholder="Studio Zen Palermo"
                  value={value} onChangeText={onChange} error={errors.studioName?.message} />
              )}
            />
            <Text style={styles.fieldLabel}>BARRIO</Text>
            <View style={styles.chipGrid}>
              {NEIGHBORHOODS.map(n => (
                <Button key={n} label={n} size="sm"
                  variant={selectedNeighborhood === n ? 'primary' : 'ghost'}
                  onPress={() => { setSelectedNeighborhood(n); setValue('neighborhood', n) }}
                  style={{ marginBottom: spacing.xs }}
                />
              ))}
            </View>
            <Controller control={control} name="phone"
              render={({ field: { onChange, value } }) => (
                <Input label="TELÉFONO (OPCIONAL)" placeholder="11 4444-5555"
                  value={value} onChangeText={onChange} keyboardType="phone-pad" />
              )}
            />
          </>
        )}

        {step === 2 && (
          <>
            <Controller control={control} name="email"
              render={({ field: { onChange, value } }) => (
                <Input label="EMAIL" placeholder="hola@mipilates.com"
                  value={value} onChangeText={onChange} keyboardType="email-address"
                  error={errors.email?.message} />
              )}
            />
            <Controller control={control} name="password"
              render={({ field: { onChange, value } }) => (
                <Input label="CONTRASEÑA" placeholder="••••••••"
                  value={value} onChangeText={onChange} secureTextEntry
                  error={errors.password?.message} />
              )}
            />
          </>
        )}

        {step === 3 && (
          <>
            <View style={[styles.codeBox, codeVerified && styles.codeBoxVerified]}>
              <Text style={{ fontSize: 20, marginRight: spacing.sm }}>🏛️</Text>
              <Controller control={control} name="camaraCode"
                render={({ field: { onChange, value } }) => (
                  <Input label="" placeholder="CAM-2024-XXXX"
                    value={value} onChangeText={onChange}
                    style={{ flex: 1, marginBottom: 0 }} />
                )}
              />
              {codeVerified && <Badge label="✓ Verificado" color="success" />}
            </View>
            {camaraCode && !codeVerified && (
              <Button label="Verificar código" variant="secondary" size="sm"
                onPress={verifyCode} isLoading={verifyingCode} style={{ marginBottom: spacing.md }} />
            )}
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Si tu estudio ya es socio de la Cámara, ingresá el código que recibiste. Si no, podés omitirlo y asociarte más adelante.
              </Text>
            </View>
          </>
        )}

        <View style={styles.actions}>
          {step < 3 ? (
            <Button label="Continuar →" onPress={() => setStep(s => s + 1)} fullWidth size="lg" />
          ) : (
            <Button label="Crear cuenta" onPress={handleSubmit(onSubmit)}
              isLoading={loading} fullWidth size="lg" />
          )}
          {step > 1 && (
            <Button label="Atrás" variant="ghost" onPress={() => setStep(s => s - 1)}
              fullWidth style={{ marginTop: spacing.sm }} />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.cream, padding: spacing.xl },
  progress: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xl },
  progressDot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.sageMid },
  progressDotActive: { backgroundColor: colors.sage },
  title: { fontFamily: 'Playfair_Display-Medium', fontSize: 24, color: colors.dark, marginBottom: 4 },
  sub: { ...typography.small, color: colors.mid, marginBottom: spacing.xl },
  fieldLabel: { ...typography.label, color: colors.mid, marginBottom: spacing.sm },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  codeBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.cream, borderRadius: radius.md,
    padding: spacing.sm, marginBottom: spacing.sm,
    borderWidth: 0.5, borderColor: colors.cream,
  },
  codeBoxVerified: { borderColor: colors.sage, backgroundColor: colors.sageLighter },
  infoBox: { backgroundColor: colors.sageLight, borderRadius: radius.md, padding: spacing.md },
  infoText: { ...typography.small, color: colors.mid, lineHeight: 18 },
  actions: { marginTop: spacing.xl },
})
