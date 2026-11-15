import { createRoot } from 'react-dom/client'
import App from './App'
import { LanguageProvider } from './i18n'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Missing React root element')
}

createRoot(container).render(<LanguageProvider><App /></LanguageProvider>)
