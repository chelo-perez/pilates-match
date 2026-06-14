// supabase/functions/send-match-notification/index.ts
// Edge Function - enviar push notification cuando hay un match

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

serve(async (req) => {
  try {
    const { match_id } = await req.json()
    if (!match_id) return new Response('match_id required', { status: 400 })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Obtener datos del match
    const { data: match } = await supabase
      .from('matches')
      .select(`
        *,
        studio:studios(name),
        instructor:instructors(full_name, user_id)
      `)
      .eq('id', match_id)
      .single()

    if (!match) return new Response('Match not found', { status: 404 })

    // Obtener token push del instructor
    const { data: tokenRow } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', match.instructor.user_id)
      .single()

    if (!tokenRow?.token) return new Response('No push token', { status: 200 })

    // Enviar push via Expo
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: tokenRow.token,
        title: '¡Nueva solicitud de clase!',
        body: `${match.studio.name} te solicita ${match.class_type === 'regular' ? 'una clase regular' : 'un reemplazo'} el ${match.class_date}`,
        data: { match_id, screen: 'MatchDetail' },
        sound: 'default',
        badge: 1,
      }),
    })

    const result = await response.json()
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
