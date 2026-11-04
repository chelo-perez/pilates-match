// Elegir una foto cuadrada (avatar / logo) sin el recortador nativo de Android.
//
// El recortador de expo-image-picker (allowsEditing) en Android 15 con pantalla
// "edge-to-edge" deja el botón de confirmar debajo de la barra de estado: se ve
// la foto para recortar pero no se puede guardar. Acá elegimos la foto sin editar
// y la recortamos nosotros: cuadrado centrado y achicado (sube rápido y pesa poco).
import * as ImagePicker from 'expo-image-picker'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'
import { UserError } from './errors'

export async function pickSquareImage(size = 512): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (status !== 'granted') throw new UserError('Necesitamos acceso a tu galería para elegir la foto')

  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 })
  if (result.canceled || !result.assets?.[0]) return null

  const { uri, width, height } = result.assets[0]
  const side = Math.min(width, height)
  const actions: any[] = []
  if (side > 0 && width !== height) {
    actions.push({ crop: { originX: Math.floor((width - side) / 2), originY: Math.floor((height - side) / 2), width: side, height: side } })
  }
  if (side > size || side === 0) actions.push({ resize: { width: size, height: size } })

  const out = await manipulateAsync(uri, actions, { compress: 0.8, format: SaveFormat.JPEG })
  return out.uri
}
