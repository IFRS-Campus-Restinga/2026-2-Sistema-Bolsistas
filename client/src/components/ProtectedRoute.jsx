import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'

/**
 * Rota protegida — verifica autenticação e perfil.
 *
 * Props:
 *   roles    — lista de roles permitidas (ex: ['ADMINISTRADOR'])
 *              se não informado, qualquer usuário autenticado acessa
 *   children — conteúdo da rota
 */
export default function ProtectedRoute({ roles, children }) {
  const { me, carregando } = useAuth()

  if (carregando) return null
  if (!me) return <Navigate to="/acesso-negado" replace />
  if (roles && !roles.includes(me.role)) return <Navigate to="/sem-permissao" replace />

  return children
}
