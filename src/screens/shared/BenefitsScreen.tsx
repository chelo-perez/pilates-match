// "Beneficios de tu red": descuentos y formaciones que la entidad de la red aprobó para estudios e instructores.
import React, { useMemo, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, Pressable, RefreshControl } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import HeroHeader, { HeaderPills } from '../../components/HeroHeader'
import BlobCard from '../../components/BlobCard'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import { Button, EmptyState, LoadingScreen, colors, spacing } from '../../components/ui'
import { entity } from '../../lib/entity'
import { MODALITY_LABEL, SponsorOffer, copyOfferCode, openOfferLink, openOfferWhatsapp, trackSponsor, useMySponsorOffers } from '../../lib/sponsors'

const shortDate = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })

function Logo({ o, size = 48 }: { o: SponsorOffer; size?: number }) {
  return o.logo_url
    ? <Image source={{ uri: o.logo_url }} style={[s.logo, { width: size, height: size, borderRadius: size / 4 }]} resizeMode="cover" />
    : <View style={[s.logo, s.logoFallback, { width: size, height: size, borderRadius: size / 4 }]}><Text style={[s.logoLetter, { fontSize: size * 0.4 }]}>{o.sponsor_name[0]?.toUpperCase()}</Text></View>
}

export default function BenefitsScreen({ navigation }: any) {
  const { data: offers = [], isLoading, refetch, isRefetching } = useMySponsorOffers()
  const [tab, setTab] = useState<'beneficio' | 'formacion'>('beneficio')
  const [open, setOpen] = useState<SponsorOffer | null>(null)
  const { toast, showToast, hideToast } = useToast()
  const insets = useSafeAreaInsets()

  const benefits = useMemo(() => offers.filter(o => o.kind === 'beneficio'), [offers])
  const courses = useMemo(() => offers.filter(o => o.kind === 'formacion'), [offers])
  const both = benefits.length > 0 && courses.length > 0
  const current = both ? (tab === 'beneficio' ? benefits : courses) : offers

  const show = (o: SponsorOffer) => { setOpen(o); trackSponsor(o.id, 'vista') }
  const copy = async (o: SponsorOffer) => { if (await copyOfferCode(o)) showToast('Código copiado') }

  if (isLoading) return <LoadingScreen />

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader title="Beneficios de tu red" subtitle={`Descuentos y formaciones aprobados por ${entity().la}`}
        onBack={() => navigation.goBack()} backLabel="Inicio"
        bottomElement={both ? <HeaderPills value={tab} onChange={setTab} items={[
          { key: 'beneficio', label: `Beneficios (${benefits.length})` }, { key: 'formacion', label: `Formaciones (${courses.length})` },
        ]} /> : undefined} />

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 40, gap: spacing.sm }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.sage} />}>
        {current.length === 0 ? (
          <EmptyState icon="gift" title="Todavía no hay beneficios" message={`Cuando ${entity().la} publique descuentos o formaciones para tu red, los vas a ver acá.`} />
        ) : current.map(o => (
          <BlobCard key={o.id} style={s.card} onPress={() => show(o)}>
            <View style={s.row}>
              <Logo o={o} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.sponsor} numberOfLines={1}>{o.sponsor_name}</Text>
                <Text style={s.title} numberOfLines={2}>{o.title}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.light} />
            </View>
            {o.perk ? <View style={s.perk}><Feather name="tag" size={13} color={colors.sage} /><Text style={s.perkTxt}>{o.perk}</Text></View> : null}
            {o.kind === 'formacion' && (o.modality || o.course_hours || o.course_start) ? (
              <Text style={s.meta}>{[o.modality ? MODALITY_LABEL[o.modality] : null, o.course_hours ? `${o.course_hours} h` : null, o.course_start ? `Empieza el ${shortDate(o.course_start)}` : null].filter(Boolean).join(' · ')}</Text>
            ) : o.summary ? <Text style={s.meta} numberOfLines={2}>{o.summary}</Text> : null}
          </BlobCard>
        ))}
        {current.length > 0 ? <Text style={s.foot}>Los beneficios los ofrecen empresas del sector. Las condiciones las define cada una.</Text> : null}
      </ScrollView>

      {/* Detalle */}
      <Modal visible={!!open} transparent animationType="slide" onRequestClose={() => setOpen(null)}>
        <Pressable style={s.overlay} onPress={() => setOpen(null)}>
          {open ? (
            <Pressable style={[s.sheet, { paddingBottom: insets.bottom + spacing.lg }]} onPress={() => {}}>
              <View style={s.grabber} />
              <View style={s.row}>
                <Logo o={open} size={56} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.sponsor}>{open.sponsor_name}</Text>
                  <Text style={s.sheetTitle}>{open.title}</Text>
                </View>
              </View>
              {open.perk ? <View style={[s.perk, { marginTop: spacing.md }]}><Feather name="tag" size={14} color={colors.sage} /><Text style={[s.perkTxt, { fontSize: 15 }]}>{open.perk}</Text></View> : null}
              {open.kind === 'formacion' ? (
                <View style={s.facts}>
                  {open.modality ? <Text style={s.fact}><Feather name="map-pin" size={13} color={colors.mid} />  {MODALITY_LABEL[open.modality]}</Text> : null}
                  {open.course_hours ? <Text style={s.fact}><Feather name="clock" size={13} color={colors.mid} />  {open.course_hours} horas</Text> : null}
                  {open.course_start ? <Text style={s.fact}><Feather name="calendar" size={13} color={colors.mid} />  Empieza el {shortDate(open.course_start)}</Text> : null}
                </View>
              ) : null}
              {open.details || open.summary ? <Text style={s.details}>{open.details || open.summary}</Text> : null}
              {open.promo_code ? (
                <TouchableOpacity style={s.code} onPress={() => copy(open)} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`Código ${open.promo_code}`}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.codeLbl}>CÓDIGO</Text>
                    <Text style={s.codeTxt} selectable>{open.promo_code}</Text>
                  </View>
                  <Feather name="copy" size={18} color={colors.sage} />
                </TouchableOpacity>
              ) : null}
              <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                {open.url ? <Button label={open.kind === 'formacion' ? 'Ver la formación' : 'Ir al sitio'} fullWidth onPress={() => openOfferLink(open)}
                  icon={<Feather name="external-link" size={16} color={colors.white} />} /> : null}
                {open.contact_whatsapp ? <Button label="Escribir por WhatsApp" variant="secondary" fullWidth onPress={() => openOfferWhatsapp(open)}
                  icon={<Feather name="message-circle" size={16} color={colors.sage} />} /> : null}
              </View>
              {open.ends_on ? <Text style={s.until}>Válido hasta el {shortDate(open.ends_on)}</Text> : null}
            </Pressable>
          ) : <View />}
        </Pressable>
      </Modal>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  )
}

const s = StyleSheet.create({
  card:        { padding: spacing.md, gap: 10 },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo:        { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderLight },
  logoFallback:{ backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center', borderWidth: 0 },
  logoLetter:  { fontFamily: 'Nunito-Bold', color: colors.sage },
  sponsor:     { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.mid },
  title:       { fontFamily: 'Nunito-Bold', fontSize: 15, lineHeight: 20, color: colors.dark, marginTop: 1 },
  perk:        { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.sageLighter, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999 },
  perkTxt:     { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.sage },
  meta:        { fontFamily: 'Nunito-Regular', fontSize: 13, lineHeight: 18, color: colors.mid },
  foot:        { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light, textAlign: 'center', marginTop: spacing.sm },
  overlay:     { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end', alignItems: 'center' },
  sheet:       { width: '100%', maxWidth: 560, backgroundColor: colors.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingTop: spacing.sm },
  grabber:     { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.md },
  sheetTitle:  { fontFamily: 'Nunito-Bold', fontSize: 19, lineHeight: 24, color: colors.dark, marginTop: 2 },
  facts:       { gap: 6, marginTop: spacing.md },
  fact:        { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.dark },
  details:     { fontFamily: 'Nunito-Regular', fontSize: 14, lineHeight: 21, color: colors.dark, marginTop: spacing.md },
  code:        { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: spacing.md, padding: 14, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.sageMid, backgroundColor: colors.white },
  codeLbl:     { fontFamily: 'Nunito-SemiBold', fontSize: 10, letterSpacing: 1.2, color: colors.mid },
  codeTxt:     { fontFamily: 'Nunito-Bold', fontSize: 20, letterSpacing: 2, color: colors.dark, marginTop: 2 },
  until:       { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.light, textAlign: 'center', marginTop: spacing.md },
})
