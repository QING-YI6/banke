import { createRoot } from 'react-dom/client'
import App from './App'
import { useBanke } from './core/store'
import { integrations } from './core/integrations'
import './styles/base.css'
import './styles/stage.css'
import './styles/focus.css'
import './styles/pet.css'
import './styles/panel.css'

// 留给本地调试 / 截图脚本的一点点后门，不影响正常使用。
;(window as unknown as { __banke?: unknown }).__banke = { store: useBanke, integrations }

createRoot(document.getElementById('root')!).render(<App />)
