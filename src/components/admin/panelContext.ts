// Pantallas del celular que se muestran dentro del portal de escritorio (Tarifas, Reportes, Perfil):
// con este contexto, HeroHeader se dibuja como encabezado de escritorio en vez de la franja oscura.
import { createContext, useContext } from 'react'
export const InPanel = createContext(false)
export const useInPanel = () => useContext(InPanel)
