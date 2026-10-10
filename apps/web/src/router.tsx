import { createBrowserRouter } from 'react-router'

import App from './App'
import { ErrorElement } from './components/common/ErrorElement'
import { NotFound } from './components/common/NotFound'
import { AppSkeleton } from './components/ui/app-skeleton'
import { routes } from './generated-routes'
import MetricsPage from './pages/(main)/metrics/index'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      ...routes, 
      { path: 'metrics', element: <MetricsPage /> }
    ],
    errorElement: <ErrorElement />,
    hydrateFallbackElement: <AppSkeleton />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
])
