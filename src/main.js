import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { bootLocale, t, tt } from '@/composables/useLocale'
import { bootTheme } from '@/composables/useTheme'

import '@/styles/tokens.css'
import '@/styles/layout.css'
import '@/styles/components.css'
import '@/styles/pages.css'
import '@/styles/login.css'

bootTheme()
bootLocale()

const app = createApp(App)
app.config.globalProperties.t = t
app.config.globalProperties.tt = tt
app.use(router).mount('#app')
