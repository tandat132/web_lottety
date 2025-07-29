import React, { useState } from 'react'
import { authAPI } from '../services/api'
import type { LoginCredentials, User } from '../types/auth'

interface LoginProps {
  onLogin: (token: string, user: User) => void
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const credentials: LoginCredentials = { username, password }
      const response = await authAPI.login(credentials)
      
      // Lưu token và user info vào localStorage
      localStorage.setItem('token', response.token)
      localStorage.setItem('user', JSON.stringify(response.user))
      
      // Gọi callback để cập nhật state trong App
      onLogin(response.token, response.user)
    } catch (error: unknown) {
      console.error('Lỗi đăng nhập:', error)
      
      let errorMessage = 'Đã xảy ra lỗi khi đăng nhập. Vui lòng thử lại.'
      
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { message?: string } } }
        errorMessage = axiosError.response?.data?.message || errorMessage
      }
      
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen text-gray-800 antialiased flex-col justify-center overflow-hidden bg-gray-50 py-6 sm:py-12">
      <div className="relative py-3 sm:w-96 mx-auto text-center">
        <span className="text-2xl font-light">Đăng nhập vào tài khoản</span>
        <div className="mt-4 bg-white shadow-md rounded-lg text-left">
          <div className="h-2 bg-purple-400 rounded-t-md"></div>
          <div className="px-8 py-6">
            <form onSubmit={handleSubmit}>
              <label className="block font-semibold">Tên đăng nhập</label>
              <input
                type="text"
                placeholder="Tên đăng nhập"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="border w-full h-5 px-3 py-5 mt-2 hover:outline-none focus:outline-none focus:ring-indigo-500 focus:ring-1 rounded-md"
              />
              <label className="block mt-3 font-semibold">Mật khẩu</label>
              <input
                type="password"
                placeholder="Mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border w-full h-5 px-3 py-5 mt-2 hover:outline-none focus:outline-none focus:ring-indigo-500 focus:ring-1 rounded-md"
              />
              
              {error && (
                <div className="mt-3 text-red-600 text-sm text-center">
                  {error}
                </div>
              )}
              
              <div className="flex justify-between items-baseline">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="mt-4 bg-purple-500 text-white py-2 px-6 rounded-md hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
  