import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

import '@/styles/tokens.css'
import '@/styles/layout.css'
import '@/styles/components.css'
import '@/styles/pages.css'
import '@/styles/login.css'

createApp(App).use(router).mount('#app')
