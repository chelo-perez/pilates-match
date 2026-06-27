// src/components/LottieTab.tsx
// Componente de ícono de tab con animación Lottie
import React, { useRef, useEffect } from 'react'
import { View } from 'react-native'
import LottieView from 'lottie-react-native'

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
            color: focused ? '#4A5D4E' : '#9A9A9A',
          },
        ]}
        speed={1.2}
      />
    </View>
  )
}
