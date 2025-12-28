"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { useRouter } from "next/navigation"

// Define the User type
export interface User {
  id: string
  email: string
  name?: string
  picture?: string
}

// Define the context type
interface UserContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  loginWithGoogle: () => void
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

// Create the context with default values
const UserContext = createContext<UserContextType | undefined>(undefined)

// Provider props
interface UserProviderProps {
  children: ReactNode
}

// UserProvider component
export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // Check authentication status on mount
  useEffect(() => {
    checkAuth()
  }, [])

  // Function to check if user is authenticated
  const checkAuth = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('http://localhost:8000/me', {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data.user || null)
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error('Error checking auth:', error)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  // Login function (Note: Google OAuth is the primary method now)
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('http://localhost:8000/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          username: email,
          password: password,
        }),
        credentials: 'include',
      })

      if (response.ok) {
        await refreshUser()
        return { success: true }
      } else {
        const result = await response.json()
        return { success: false, error: result.detail || 'Login failed' }
      }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, error: 'An error occurred during login' }
    }
  }

  // Google login redirect
  const loginWithGoogle = () => {
    window.location.href = 'http://localhost:8000/login'
  }

  // Logout function
  const logout = async () => {
    try {
      await fetch('http://localhost:8000/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setUser(null)
      router.push('/login')
    }
  }

  // Refresh user data
  const refreshUser = async () => {
    await checkAuth()
  }

  const value: UserContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    loginWithGoogle,
    logout,
    refreshUser,
  }

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}

// Custom hook to use the user context
export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}
