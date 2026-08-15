import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import apiClient from '../api'
import type { User, RegisterData, UpdateProfileData } from '../types'

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
  updateProfile: (data: UpdateProfileData) => Promise<void>
  /** 由 Dashboard / 其他已包含 user 数据的聚合接口写回，避免重复查 /auth/me */
  setUserFromPayload: (u: User | null) => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

// ============================================================
// 关键优化：页面首屏不要再额外查一次 /auth/me（远程 DB 要 2-4 秒）。
// ------------------------------------------------------------
// 策略：
//   1. localStorage 里已经存了 token + 上次登录/同步拿到的 user，
//      启动时先用它当占位（不阻塞任何首屏渲染）。
//   2. 如果没有本地 user（比如新设备第一次），才发 /auth/me 兜底。
//   3. Dashboard 聚合接口会一次性返回 user + stats，拿到后调用
//      setUserFromPayload 写回 AuthContext（= 用 Dashboard 那 1 次
//      HTTP 请求同时拿到用户信息，省掉 2-4 秒单独查 /me 的时间）。
// ============================================================
const USER_LS_KEY = 'ironai:user'

function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as User
    return parsed && typeof parsed === 'object' && parsed.id ? parsed : null
  } catch {
    return null
  }
}
function writeCachedUser(u: User | null) {
  try {
    if (u) localStorage.setItem(USER_LS_KEY, JSON.stringify(u))
    else   localStorage.removeItem(USER_LS_KEY)
  } catch { /* ignore */ }
}
function clearCachedUser() {
  try { localStorage.removeItem(USER_LS_KEY) } catch { /* ignore */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => readCachedUser())
  const [loading, setLoading] = useState<boolean>(() => {
    // 如果 token 存在但没有本地缓存 user → 要兜底发 /me
    const token = localStorage.getItem('token')
    return !!token && !readCachedUser()
  })

  // 持久化：每次 user 改变时同步到 localStorage
  useEffect(() => {
    writeCachedUser(user || null)
  }, [user])

  // 兜底：只有 token 存在且没有本地缓存 user 时，才发一次 /auth/me
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }
    if (user) {
      setLoading(false)
      return
    }
    let alive = true
    apiClient.get('/auth/me')
      .then(res => alive && setUser(res.data.user))
      .catch(() => {
        localStorage.removeItem('token')
        clearCachedUser()
        alive && setUser(null)
      })
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [user])

  const login = async (email: string, password: string) => {
    const res = await apiClient.post('/auth/login', { email, password })
    localStorage.setItem('token', res.data.token)
    setUser(res.data.user)
  }

  const register = async (data: RegisterData) => {
    const res = await apiClient.post('/auth/register', data)
    localStorage.setItem('token', res.data.token)
    setUser(res.data.user)
  }

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    clearCachedUser()
    setUser(null)
  }, [])

  const updateProfile = async (data: UpdateProfileData) => {
    const res = await apiClient.put('/auth/profile', data)
    setUser(res.data.user)
  }

  const setUserFromPayload = useCallback((u: User | null) => {
    if (u) setUser(u)
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, login, register, logout, updateProfile, setUserFromPayload, loading }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)!
