import { createBrowserRouter } from 'react-router'

import App from './App'
import { ErrorElement } from './components/common/ErrorElement'
import { NotFound } from './components/common/NotFound'
import { AppSkeleton } from './components/ui/app-skeleton'
import { routes } from './generated-routes'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      // Loaded on demand, like the other pages, so the Metrics code only downloads when someone opens it.
      { path: 'metrics', lazy: () => import('./pages/(main)/metrics/index') },
      ...routes,
    ],
    errorElement: <ErrorElement />,
    hydrateFallbackElement: <AppSkeleton />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
])
