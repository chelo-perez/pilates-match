// src/screens/camara/CamaraHomeScreen.tsx
import React from 'react'
import { View, Text, StyleSheet, Button } from 'react-native'

interface Props {
  navigation: any;
}

export default function CamaraHomeScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cámara de Pilates CABA</Text>
      <Text style={styles.subtitle}>Panel Institucional de Gestión y Red Global</Text>
      
      <View style={styles.cardProvisional}>
        <Text style={styles.cardText}>
          ✨ Conexión Exitosa con Supabase Rol: 'camara' ✨
        </Text>
        <Text style={styles.subCardText}>
          Los módulos de auditoría de estudios y la bolsa de instructores de Buenos Aires están listos para desarrollo.
        </Text>
      </View>

      <Button 
        title="Cerrar Sesión Institucional" 
        color="#4A5D4E" 
        onPress={() => navigation.replace('Login')} 
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9F9F6', // Tu colors.cream base
    padding: 24,
  },
  title: {
    fontFamily: 'Nunito-Bold',
    fontSize: 28,
    color: '#4A5D4E', // Verde oliva corporativo
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Nunito-Regular',
    fontSize: 14,
    color: '#666666',
    marginBottom: 32,
    textAlign: 'center',
  },
  cardProvisional: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    marginBottom: 40,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#DDDDDD',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  cardText: {
    fontFamily: 'Nunito-SemiBold',
    fontSize: 15,
    color: '#4A5D4E',
    marginBottom: 8,
  },
  subCardText: {
    fontFamily: 'Nunito-Regular',
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 18,
  }
})