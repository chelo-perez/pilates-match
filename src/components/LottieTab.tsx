// src/components/LottieTab.tsx
// Componente de ícono de tab con animación Lottie
import React, { useRef, useEffect } from 'react'
import { View } from 'react-native'
import LottieView from 'lottie-react-native'
import { colors } from './ui'

interface LottieTabProps {
  source: any
  focused: boolean
  size?: number
}

export default function LottieTab({ source, focused, size = 26 }: LottieTabProps) {
  const ref = useRef<LottieView>(null)

  useEffect(() => {
    if (focused) {
      ref.current?.play()
    } else {
      ref.current?.reset()
    }
  }, [focused])

  return (
    <View style={{ width: size, height: size }}>
      <LottieView
        ref={ref}
        source={source}
        autoPlay={false}
        loop={false}
        style={{ width: size, height: size }}
        colorFilters={[
          {
            keypath: '**',
            color: focused ? colors.sage : colors.light,
          },
        ]}
        speed={1.2}
        // Al terminar vuelve al cuadro inicial: el último cuadro de algunas
        // animaciones es una pose intermedia y el ícono queda deforme
        onAnimationFinish={() => ref.current?.reset()}
      />
    </View>
  )
}
