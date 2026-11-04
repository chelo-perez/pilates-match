// A dónde lleva un aviso según el perfil (lo usan el aviso del celular y la campanita).
export function openNotificationTarget(nav: any, role: string | undefined, data: any) {
  const screen = data?.screen ?? (data?.match_id ? 'propuestas' : null)
  if (!nav || !screen) return
  if (role === 'instructor') {
    if (screen === 'propuestas') nav.navigate('InstructorTabs', { screen: 'InstructorPropuestas' })
    else if (screen === 'perfil') nav.navigate('InstructorTabs', { screen: 'InstructorPerfil' })
    else if (screen === 'inicio') nav.navigate('InstructorTabs', { screen: 'InstructorInicio' })
  } else if (role === 'estudio') {
    if (screen === 'historial') nav.navigate('EstudioHome', { screen: 'HistoryList' })
    else if (screen === 'inicio') nav.navigate('EstudioHome', { screen: 'EstudioInicio' })
  } else if (role === 'camara_admin' || role === 'super_admin') {
    if (screen === 'verificar' && data?.instructor_id) nav.navigate('VerifyInstructor', { instructorId: data.instructor_id })
    else if (screen === 'verificar') nav.navigate('CamaraTabs', { screen: 'Directorio', params: { filter: 'pendiente' } })
    else if (screen === 'inicio') nav.navigate('CamaraTabs', { screen: 'CamaraInicio' })
  }
}
