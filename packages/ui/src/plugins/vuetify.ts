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
})
