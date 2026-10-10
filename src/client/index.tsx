import React from 'react'
import { render } from 'react-dom'
import { Provider } from 'react-redux'
import { Router } from 'react-router-dom'
import createSagaMiddleware from 'redux-saga'
import { configureStore, getDefaultMiddleware } from '@reduxjs/toolkit'

import { App } from '@/containers/App'
import rootSaga from '@/sagas'
import rootReducer from '@/slices'
import history from '@/utils/history'
import { AutionalProvider, autionalConfig, useAutional, setAutionalSessionEnd } from '@/autional'

import '@/styles/index.scss'

// Publishes the SDK logout to non-React code (the logout saga) — notes D19.
const AutionalSessionBridge: React.FC = () => {
  const { logout } = useAutional()

  React.useEffect(() => {
    setAutionalSessionEnd(logout)

    return () => setAutionalSessionEnd(null)
  }, [logout])

  return null
}

const sagaMiddleware = createSagaMiddleware()
const store = configureStore({
  reducer: rootReducer,
  middleware: [sagaMiddleware, ...getDefaultMiddleware({ thunk: false })],
  devTools: process.env.NODE_ENV !== 'production',
})

sagaMiddleware.run(rootSaga)

render(
  <AutionalProvider config={autionalConfig}>
    <AutionalSessionBridge />
    <Provider store={store}>
      <Router history={history}>
        <App />
      </Router>
    </Provider>
  </AutionalProvider>,
  document.getElementById('root')
)
