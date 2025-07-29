import { useState, useEffect } from 'react'
import './App.css'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import ListPage from './components/ListPage'
import BettingStatsPage from './components/BettingStats'
import { authAPI } from './services/api'
import type { User, AuthState } from './types/auth'

type Page = 'login' | 'dashboard' | 'list' | 'betting'

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('login')
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    loading: true
  })

  // Kiểm tra authentication khi app khởi động
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token')
      const userStr = localStorage.getItem('user')
      
      if (token && userStr) {
        try {
          // Verify token với server
          const response = await authAPI.getCurrentUser()
          setAuthState({
            isAuthenticated: true,
            user: response.user,
            token,
            loading: false
          })
          setCurrentPage('dashboard')
        } catch {
          // Token không hợp lệ, xóa khỏi localStorage
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          setAuthState({
            isAuthenticated: false,
            user: null,
            token: null,
            loading: false
          })
        }
      } else {
        setAuthState(prev => ({ ...prev, loading: false }))
      }
    }

    checkAuth()
  }, [])

  const handleLogin = (token: string, user: User) => {
    setAuthState({
      isAuthenticated: true,
      user,
      token,
      loading: false
    })
    setCurrentPage('dashboard')
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setAuthState({
      isAuthenticated: false,
      user: null,
      token: null,
      loading: false
    })
    setCurrentPage('login')
  }

  const navigateTo = (page: Page) => {
    if (authState.isAuthenticated) {
      setCurrentPage(page)
    }
  }

  // Hiển thị loading khi đang kiểm tra authentication
  if (authState.loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải...</p>
        </div>
      </div>
    )
  }

  if (!authState.isAuthenticated) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h2 className="text-xl font-semibold text-gray-900">Lottety</h2>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => navigateTo('dashboard')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentPage === 'dashboard' 
                    ? 'bg-purple-500 text-white' 
                    : 'text-gray-700 hover:text-purple-600 hover:bg-purple-50'
                }`}
              >
                Trang chủ
              </button>
              <button 
                onClick={() => navigateTo('list')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentPage === 'list' 
                    ? 'bg-purple-500 text-white' 
                    : 'text-gray-700 hover:text-purple-600 hover:bg-purple-50'
                }`}
              >
                Tài khoản
              </button>
              <button 
                onClick={() => navigateTo('betting')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentPage === 'betting' 
                    ? 'bg-purple-500 text-white' 
                    : 'text-gray-700 hover:text-purple-600 hover:bg-purple-50'
                }`}
              >
                📊 Thống kê Betting
              </button>
              <button 
                onClick={handleLogout} 
                className="px-3 py-2 rounded-md text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {currentPage === 'dashboard' && <Dashboard />}
        {currentPage === 'list' && <ListPage />}
        {currentPage === 'betting' && <BettingStatsPage />}
      </main>
    </div>
  )
}

export default App
