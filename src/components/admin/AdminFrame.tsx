// En la compu, las pantallas de detalle (pensadas para el celular) se muestran centradas
// en una columna cómoda, con el fondo del panel a los costados.
import React from 'react'
import { View } from 'react-native'
import { useIsWide } from './AdminUI'
import { colors } from '../ui'

export function withAdminFrame<P extends object>(Screen: React.ComponentType<P>, maxWidth = 860) {
  function Framed(props: P) {
    const wide = useIsWide()
    if (!wide) return <Screen {...props} />
    return (
      <View style={{ flex: 1, backgroundColor: colors.sageLighter, alignItems: 'center' }}>
        <View style={{ flex: 1, width: '100%', maxWidth, backgroundColor: colors.cream, borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.borderLight }}>
          <Screen {...props} />
        </View>
      </View>
    )
  }
  Framed.displayName = `AdminFrame(${Screen.displayName ?? Screen.name ?? 'Screen'})`
  return Framed
}
