// src/components/LottieTab.tsx
// Versión de diagnóstico — Feather icons en vez de Lottie para aislar crash
import React from 'react'
import { View } from 'react-native'
import { Feather } from '@expo/vector-icons'

const ICON_MAP: Record<string, string> = {
  home: 'home', inbox: 'inbox', calendar: 'calendar',
  rates: 'dollar-sign', profile: 'user', search: 'search',
  history: 'clock', star: 'star', users: 'users', reports: 'bar-chart-2',
}

interface LottieTabProps {
  source: any
  focused: boolean
  size?: number
}

export default function LottieTab({ source, focused, size = 24 }: LottieTabProps) {
  // Extraer nombre del archivo lottie para mapear al icono
  const sourceName = typeof source === 'object' 
    ? '' 
    : String(source).split('tab-').pop()?.replace('.json', '') ?? 'home'
  
  const iconName = (ICON_MAP[sourceName] ?? 'circle') as any
  const color = focused ? '#4A5D4E' : '#9A9A9A'

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Feather name={iconName} size={size - 2} color={color} />
    </View>
  )
}
