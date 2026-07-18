import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

type ThemeChoice = 'system' | 'light' | 'dark'

interface ThemeState {
  theme: ThemeChoice
  setTheme: (t: ThemeChoice) => void
}

const ThemeContext = createContext<ThemeState>({ theme: 'system', setTheme: () => {} })
const THEME_KEY = 'checkbook.theme'

function apply(theme: ThemeChoice) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>(
    () => (localStorage.getItem(THEME_KEY) as ThemeChoice) || 'system',
  )

  useEffect(() => {
    apply(theme)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => apply(theme)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = useCallback((t: ThemeChoice) => {
    localStorage.setItem(THEME_KEY, t)
    setThemeState(t)
  }, [])

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
