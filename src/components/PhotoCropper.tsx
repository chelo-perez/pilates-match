// Recortador de fotos propio (avatar / logo): la persona arrastra la foto y ajusta el
// zoom dentro de un círculo, y recién ahí se recorta.
//
// Reemplaza al recortador nativo de expo-image-picker (allowsEditing), que en Android 15
// con pantalla edge-to-edge deja el botón de confirmar debajo de la barra de estado.
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { View, Text, Modal, Image, Animated, PanResponder, StyleSheet, TouchableOpacity, useWindowDimensions, ActivityIndicator, Platform } from 'react-native'
import Slider from '@react-native-community/slider'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'
import { UserError } from '../lib/errors'
import { colors, spacing, radius } from './ui'

const OUT_SIZE = 512
const MAX_ZOOM = 4
const DIM = 200 // borde grueso que oscurece las esquinas fuera del círculo

interface Picked { uri: string; width: number; height: number }

/**
 * Uso:
 *   const { pickPhoto, cropModal } = usePhotoCropper()
 *   const uri = await pickPhoto()   // null si cancela
 *   ...  y en el JSX: {cropModal}
 */
export function usePhotoCropper(title = 'Ajustá tu foto') {
  const [picked, setPicked] = useState<Picked | null>(null)
  const resolver = useRef<((uri: string | null) => void) | null>(null)

  const pickPhoto = useCallback(async (): Promise<string | null> => {
    // En Android se usa el selector de fotos del sistema: no hace falta permiso de galería
    // (Google Play restringe READ_MEDIA_IMAGES para apps que eligen una foto de vez en cuando)
    if (Platform.OS === 'ios') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') throw new UserError('Necesitamos acceso a tus fotos para elegir la imagen')
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 })
    const a = result.canceled ? null : result.assets?.[0]
    if (!a) return null
    // Algunas galerías no informan el tamaño: lo pedimos a la imagen
    let { width, height } = a
    if (!width || !height) {
      const size = await new Promise<{ w: number; h: number }>((res, rej) => Image.getSize(a.uri, (w, h) => res({ w, h }), rej))
      width = size.w; height = size.h
    }
    return new Promise(resolve => { resolver.current = resolve; setPicked({ uri: a.uri, width, height }) })
  }, [])

  const finish = (uri: string | null) => { resolver.current?.(uri); resolver.current = null; setPicked(null) }

  const cropModal = picked ? <CropModal key={picked.uri} title={title} image={picked} onCancel={() => finish(null)} onDone={finish} /> : null
  return { pickPhoto, cropModal }
}

function CropModal({ title, image, onCancel, onDone }: { title: string; image: Picked; onCancel: () => void; onDone: (uri: string) => void }) {
  const { width: screenW } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const FRAME = Math.min(screenW - spacing.lg * 2, 340)
  const base = FRAME / Math.min(image.width, image.height) // escala para que la foto cubra el marco
  const [zoom, setZoom] = useState(1)
  const [saving, setSaving] = useState(false)

  const offset = useRef({ x: 0, y: 0 })
  const start = useRef({ x: 0, y: 0 })
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current
  const zoomRef = useRef(1)

  // Límite de movimiento: la foto siempre cubre todo el círculo
  const clamp = (x: number, y: number, z = zoomRef.current) => {
    const maxX = (image.width * base * z - FRAME) / 2
    const maxY = (image.height * base * z - FRAME) / 2
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) }
  }

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { start.current = { ...offset.current } },
    onPanResponderMove: (_e, g) => {
      const c = clamp(start.current.x + g.dx, start.current.y + g.dy)
      offset.current = c
      pan.setValue(c)
    },
  }), [])

  const onZoom = (z: number) => {
    zoomRef.current = z
    setZoom(z)
    const c = clamp(offset.current.x, offset.current.y, z)
    offset.current = c
    pan.setValue(c)
  }

  const confirm = async () => {
    try {
      setSaving(true)
      const k = base * zoomRef.current            // px de pantalla por px de la foto
      const dw = image.width * k, dh = image.height * k
      const side = Math.min(image.width, image.height, Math.round(FRAME / k))
      const originX = Math.round(Math.max(0, Math.min(image.width - side, ((dw - FRAME) / 2 - offset.current.x) / k)))
      const originY = Math.round(Math.max(0, Math.min(image.height - side, ((dh - FRAME) / 2 - offset.current.y) / k)))
      const actions: any[] = [{ crop: { originX, originY, width: side, height: side } }]
      if (side > OUT_SIZE) actions.push({ resize: { width: OUT_SIZE, height: OUT_SIZE } })
      const out = await manipulateAsync(image.uri, actions, { compress: 0.85, format: SaveFormat.JPEG })
      onDone(out.uri)
    } catch {
      setSaving(false)
    }
  }

  const dw = image.width * base * zoom
  const dh = image.height * base * zoom

  return (
    <Modal visible animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={[s.root, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={onCancel} hitSlop={12} accessibilityLabel="Cancelar"><Text style={s.headerBtn}>Cancelar</Text></TouchableOpacity>
          <Text style={s.title}>{title}</Text>
          <View style={{ width: 64 }} />
        </View>

        <View style={s.stage}>
          <View style={[s.frame, { width: FRAME, height: FRAME }]} {...responder.panHandlers}>
            <Animated.View style={{ position: 'absolute', left: (FRAME - dw) / 2, top: (FRAME - dh) / 2, width: dw, height: dh, transform: pan.getTranslateTransform() }}>
              <Image source={{ uri: image.uri }} style={{ width: dw, height: dh }} />
            </Animated.View>
            {/* Fuera del círculo, oscurecido: así se va a ver la foto de perfil */}
            <View pointerEvents="none" style={{ position: 'absolute', left: -DIM, top: -DIM, width: FRAME + DIM * 2, height: FRAME + DIM * 2, borderRadius: FRAME / 2 + DIM, borderWidth: DIM, borderColor: 'rgba(0,0,0,0.55)' }} />
            <View pointerEvents="none" style={[s.circle, { width: FRAME, height: FRAME, borderRadius: FRAME / 2 }]} />
          </View>
          <Text style={s.hint}><Feather name="move" size={13} color="rgba(255,255,255,0.7)" />  Arrastrá la foto para encuadrarla</Text>
        </View>

        <View style={s.controls}>
          <View style={s.zoomRow}>
            <Feather name="zoom-out" size={18} color={colors.white} />
            <Slider style={{ flex: 1 }} minimumValue={1} maximumValue={MAX_ZOOM} value={zoom} onValueChange={onZoom}
              minimumTrackTintColor={colors.goldBright} maximumTrackTintColor="rgba(255,255,255,0.3)" thumbTintColor={colors.white} />
            <Feather name="zoom-in" size={18} color={colors.white} />
          </View>
          <TouchableOpacity style={s.useBtn} onPress={confirm} disabled={saving} activeOpacity={0.85}>
            {saving ? <ActivityIndicator color={colors.forestDeep} /> : <><Feather name="check" size={18} color={colors.forestDeep} /><Text style={s.useTxt}>Usar esta foto</Text></>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: colors.forestDeep, paddingHorizontal: spacing.lg },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBtn: { fontFamily: 'Nunito-SemiBold', fontSize: 15, color: 'rgba(255,255,255,0.8)', width: 64 },
  title:     { fontFamily: 'Nunito-Bold', fontSize: 17, color: colors.white },
  stage:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  frame:     { overflow: 'hidden', backgroundColor: colors.black, borderRadius: 16 },
  circle:    { position: 'absolute', left: 0, top: 0, borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
  hint:      { fontFamily: 'Nunito-Regular', fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  controls:  { gap: spacing.md },
  zoomRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  useBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.goldBright, paddingVertical: 15, ...radius.leaf },
  useTxt:    { fontFamily: 'Nunito-Bold', fontSize: 15, color: colors.forestDeep },
})
