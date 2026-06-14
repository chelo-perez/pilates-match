// src/screens/auth/LoginScreen.tsx

import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert, Image
} from 'react-native'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { authAPI } from '../../lib/api'
import { Button, Input, colors, spacing, typography, radius } from '../../components/ui'

const schema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})
type Form = z.infer<typeof schema>

export default function LoginScreen({ navigation }: any) {
  const [loading, setLoading] = useState(false)
  const { control, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (data: Form) => {
    try {
      setLoading(true)
      await authAPI.signIn(data.email, data.password)
    } catch (e: any) {
      const msg = e.message?.toLowerCase() ?? ''
      Alert.alert(
        'Error de acceso',
        msg.includes('invalid') || msg.includes('credentials')
          ? 'El correo o la contraseña son incorrectos.'
          : 'No se pudo conectar. Revisá tu conexión e intentá de nuevo.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoArea}>
          <Image
            source={require('../../../assets/icon.png')}
            style={styles.logoIcon}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>PilatesMatch</Text>
          <Text style={styles.tagline}>La comunidad de Pilates{'\n'}de Buenos Aires</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Controller
            control={control} name="email"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Email"
                placeholder="hola@mipilates.com"
                value={value} onChangeText={onChange}
                keyboardType="email-address" autoCapitalize="none"
                error={errors.email?.message}
              />
            )}
          />
          <Controller
            control={control} name="password"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Contraseña"
                placeholder="••••••••"
                value={value} onChangeText={onChange}
                secureTextEntry
                error={errors.password?.message}
              />
            )}
          />
          <Button
            label="Iniciar sesión"
            onPress={handleSubmit(onSubmit)}
            isLoading={loading}
            fullWidth size="lg"
            style={{ marginTop: spacing.sm }}
          />
          <TouchableOpacity style={styles.registerLink} onPress={() => navigation.navigate('RegisterRole')}>
            <Text style={styles.registerText}>
              ¿No tenés cuenta?{' '}
              <Text style={{ color: colors.sage, fontFamily: 'Nunito-Bold' }}>Registrate</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>Avalado por la Cámara de Pilates de Buenos Aires</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:    { flexGrow: 1, backgroundColor: colors.cream, padding: spacing.xl, justifyContent: 'center' },
  logoArea:     { alignItems: 'center', marginBottom: spacing.xxxl },
  logoIcon:     { width: 64, height: 64, marginBottom: spacing.md },
  logoText:     { fontFamily: 'Nunito-Bold', fontSize: 32, color: colors.sage, letterSpacing: -0.5, marginBottom: spacing.xs },
  tagline:      { fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.mid, textAlign: 'center', lineHeight: 22 },
  form:         { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 0.5, borderColor: colors.border },
  registerLink: { alignItems: 'center', marginTop: spacing.lg },
  registerText: { fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.mid },
  footer:       { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light, textAlign: 'center', marginTop: spacing.xl, letterSpacing: 0.2 },
})
