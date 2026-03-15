import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'
import { VIconBtn } from 'vuetify/labs/VIconBtn'
import 'vuetify/styles'

export default createVuetify({
  components: {
    VIconBtn,
  },
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi,
    },
  },
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        dark: false,
        colors: {
          // Tinted neutrals (no pure #000/#fff): subtle cool for e-ink/paper feel
          primary: '#17181a',
          secondary: '#5c5d62',
          surface: '#f5f6f7',
          background: '#fafbfc',
          error: '#b00020',
          warning: '#e65100',
          info: '#424242',
          success: '#2e7d32',
        },
      },
      dark: {
        dark: true,
        colors: {
          primary: '#e2e3e6',
          secondary: '#9a9ca2',
          surface: '#1c1d21',
          background: '#121318',
          error: '#cf6679',
          warning: '#ffb74d',
          info: '#90a4ae',
          success: '#81c784',
        },
      },
    },
  },
})
