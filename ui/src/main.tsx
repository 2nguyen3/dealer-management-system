import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LocaleRoot } from './app/LocaleRoot'
import { bootI18n } from './lib/i18n/runtime'
import '@fontsource/be-vietnam-pro/vietnamese-400.css'
import '@fontsource/be-vietnam-pro/vietnamese-500.css'
import '@fontsource/be-vietnam-pro/vietnamese-600.css'
import '@fontsource/be-vietnam-pro/vietnamese-700.css'
import '@fontsource/be-vietnam-pro/latin-400.css'
import '@fontsource/be-vietnam-pro/latin-500.css'
import '@fontsource/be-vietnam-pro/latin-600.css'
import '@fontsource/be-vietnam-pro/latin-700.css'
import './styles.css'

// The saved language is activated before the application modules load, so
// texts they build at import time (menus, labels) are already translated.
void bootI18n()
  .catch(() => 'vi')
  .then(() => import('./app/App'))
  .then(({ App }) => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <LocaleRoot App={App} />
      </StrictMode>,
    )
  })
