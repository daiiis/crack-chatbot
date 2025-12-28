"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useUser } from "@/context/user-context"
import { BookOpen, Brain, MessageSquare, Users, Zap, Shield, ArrowRight } from "lucide-react"

export default function LandingPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useUser()
  const [email, setEmail] = useState("")

  const handleGetStarted = () => {
    if (isAuthenticated) {
      router.push("/chat")
    } else {
      router.push("/login")
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Brain className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">EduBot AI</span>
            </div>
            <div className="flex items-center space-x-4">
              {!isLoading && (
                isAuthenticated ? (
                  <Link href="/chat">
                    <Button variant="outline">Go to Chat</Button>
                  </Link>
                ) : (
                  <Link href="/login">
                    <Button>Login</Button>
                  </Link>
                )
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center space-y-8">
          <div className="inline-flex items-center space-x-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium">
            <Zap className="h-4 w-4" />
            <span>AI-Powered Knowledge Management</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight">
            Intelligent Chatbot for
            <span className="text-blue-600"> Education Staff</span>
          </h1>

          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Harness the power of knowledge graphs and AI to deliver instant, accurate answers to your educational team. Built for efficiency, designed for excellence.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full"
            />
            <Button onClick={handleGetStarted} size="lg" className="w-full sm:w-auto">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <p className="text-sm text-gray-500">Free 14-day trial • No credit card required</p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Powerful Features for Modern Education
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Everything you need to streamline communication and knowledge sharing across your institution.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card className="border-2 hover:border-blue-200 transition-all hover:shadow-lg">
            <CardHeader>
              <Brain className="h-12 w-12 text-blue-600 mb-4" />
              <CardTitle>Knowledge Graph Integration</CardTitle>
              <CardDescription>
                Structured data relationships ensure contextual and accurate responses every time.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-purple-200 transition-all hover:shadow-lg">
            <CardHeader>
              <MessageSquare className="h-12 w-12 text-purple-600 mb-4" />
              <CardTitle>Natural Conversations</CardTitle>
              <CardDescription>
                AI-powered chat interface that understands context and provides human-like responses.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-green-200 transition-all hover:shadow-lg">
            <CardHeader>
              <Users className="h-12 w-12 text-green-600 mb-4" />
              <CardTitle>Multi-User Support</CardTitle>
              <CardDescription>
                Designed for teams with role-based access and collaborative features.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-orange-200 transition-all hover:shadow-lg">
            <CardHeader>
              <BookOpen className="h-12 w-12 text-orange-600 mb-4" />
              <CardTitle>Custom Knowledge Base</CardTitle>
              <CardDescription>
                Import your institutional data and let the AI learn from your unique content.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-red-200 transition-all hover:shadow-lg">
            <CardHeader>
              <Zap className="h-12 w-12 text-red-600 mb-4" />
              <CardTitle>Instant Responses</CardTitle>
              <CardDescription>
                Lightning-fast answers powered by optimized AI models and efficient data retrieval.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-indigo-200 transition-all hover:shadow-lg">
            <CardHeader>
              <Shield className="h-12 w-12 text-indigo-600 mb-4" />
              <CardTitle>Secure & Private</CardTitle>
              <CardDescription>
                Enterprise-grade security with data encryption and privacy compliance.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-gray-50 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-gray-600">
            <p>© 2025 EduBot AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
