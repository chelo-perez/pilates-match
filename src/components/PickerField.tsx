// Selector de fecha/hora: en Android abre el diálogo nativo; en iOS queda abierto hasta tocar "Listo".
import React, { useState } from 'react'
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { Feather } from '@expo/vector-icons'
import { colors, spacing } from './ui'

export default function PickerField({ value, mode, onChange, display, small, minimumDate, minuteInterval }: {
  value: Date; mode: 'date' | 'time'; onChange: (d: Date) => void; display: string
  small?: boolean; minimumDate?: Date; minuteInterval?: any
}) {
  const [open, setOpen] = useState(false)
  return (
    <View>
      <TouchableOpacity style={small ? s.pickerBtnSm : s.pickerBtn} onPress={() => setOpen(o => !o)} activeOpacity={0.8}>
        {!small && <Feather name={mode === 'date' ? 'calendar' : 'clock'} size={15} color={colors.sage} />}
        <Text style={small ? s.pickerTxtSm : s.pickerTxt}>{display}</Text>
      </TouchableOpacity>
      {open && (
        <>
          <DateTimePicker
            value={value}
            mode={mode}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={minimumDate}
            minuteInterval={minuteInterval}
            is24Hour
            locale="es-AR"
            onChange={(event: any, d?: Date) => {
              if (Platform.OS === 'android') setOpen(false)
              if (event?.type === 'dismissed' || !d) return
              const nd = new Date(d)
              if (mode === 'time') nd.setSeconds(0, 0)
              onChange(nd)
            }}
          />
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={s.doneBtn} onPress={() => setOpen(false)}>
              <Text style={s.doneTxt}>Listo</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  pickerBtn:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.sageLighter, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: spacing.md },
  pickerTxt:   { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.dark, flex: 1 },
  pickerBtnSm: { backgroundColor: colors.goldLight, borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, padding: 10, alignItems: 'center' },
  pickerTxtSm: { fontFamily: 'Nunito-Bold', fontSize: 16, color: colors.gold },
  doneBtn:     { alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 12 },
  doneTxt:     { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.sage },
})
