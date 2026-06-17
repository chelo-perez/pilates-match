import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
      <Text style={styles.sub}>Pantalla de login</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F6', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, color: '#4A5D4E', marginBottom: 8 },
  sub:   { fontSize: 14, color: '#9A9A9A' },
})
