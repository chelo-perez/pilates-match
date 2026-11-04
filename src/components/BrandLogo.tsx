// Logo de Trabajo Más Fácil en dos tonos, como el de Facturo Más Fácil:
// la mano y "Más fácil" en el color base; "Trabajo" y la cruz en el acento.
import React from 'react'
import { View, Image, StyleProp, ViewStyle } from 'react-native'
import { colors } from './ui'

const RATIO = 462 / 600 // alto / ancho de las capas

interface Props {
  width: number
  baseColor?: string
  accentColor?: string
  style?: StyleProp<ViewStyle>
}

export default function BrandLogo({ width, baseColor = colors.white, accentColor = colors.goldBright, style }: Props) {
  const size = { width, height: Math.round(width * RATIO) }
  return (
    <View style={[size, style]} accessible accessibilityRole="image" accessibilityLabel="Trabajo Más Fácil">
      <Image source={require('../../assets/logo-base.png')} style={[size, { position: 'absolute', tintColor: baseColor }]} resizeMode="contain" />
      <Image source={require('../../assets/logo-accent.png')} style={[size, { position: 'absolute', tintColor: accentColor }]} resizeMode="contain" />
    </View>
  )
}
