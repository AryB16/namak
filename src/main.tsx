import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/index.css'
import './index.css'
import App from './App.tsx'
import { AppProvider } from './state.tsx'
import { DemoProvider } from './demo/Demo.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        <AppProvider>
          <DemoProvider>
            <App />
          </DemoProvider>
        </AppProvider>
      </LazyMotion>
    </MotionConfig>
  </StrictMode>,
)
