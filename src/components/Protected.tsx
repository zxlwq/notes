import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/Context'

interface ProtectedRouteProps {
  children: React.ReactNode
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, loading, needsUnlock } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="size-32 animate-spin rounded-full border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={needsUnlock ? { unlock: true } : undefined} />
  }

  return <>{children}</>
}

export default ProtectedRoute
