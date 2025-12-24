"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { CheckCircle2, XCircle, Loader2, ArrowLeft, Download, Shield } from "lucide-react"
import Link from "next/link"

interface ProcessStep {
  step: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  message: string
  timestamp: number
}

function ProcessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const key = searchParams.get('key')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!key) {
      router.push('/')
      return
    }

    const stored = sessionStorage.getItem(key)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setData(parsed)
      } catch (e) {
        console.error('Failed to parse stored data:', e)
        router.push('/')
      }
    } else {
      router.push('/')
    }
    setLoading(false)
  }, [key, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!data) {
    return null
  }

  const { processSteps, authMemory, authMemoryData, metadata } = data

  const getStatusIcon = (status: ProcessStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'in_progress':
        return <Loader2 className="w-5 h-5 animate-spin text-primary" />
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
    }
  }

  const getStatusColor = (status: ProcessStep['status']) => {
    switch (status) {
      case 'completed':
        return 'border-green-500/20 bg-green-500/5'
      case 'failed':
        return 'border-red-500/20 bg-red-500/5'
      case 'in_progress':
        return 'border-primary/20 bg-primary/5'
      default:
        return 'border-muted-foreground/20 bg-muted/5'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-4xl font-bold">Extraction Process</h1>
          </div>
          <p className="text-muted-foreground">
            Step-by-step breakdown of the authentication pattern extraction
          </p>
        </div>

        {/* Summary Card */}
        {metadata && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card/90 backdrop-blur-xl rounded-2xl border border-primary/10 shadow-xl p-6 mb-8"
          >
            <h2 className="text-xl font-semibold mb-4">Extraction Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Auth Provider</p>
                <p className="text-lg font-semibold">{metadata.authProvider}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Session Strategy</p>
                <p className="text-lg font-semibold">{metadata.sessionStrategy}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Roles</p>
                <p className="text-lg font-semibold">{metadata.roles}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Permissions</p>
                <p className="text-lg font-semibold">{metadata.permissions}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Protected Routes</p>
                <p className="text-lg font-semibold">{metadata.protectedRoutes}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">API Guards</p>
                <p className="text-lg font-semibold">{metadata.apiGuards}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Process Steps */}
        <div className="bg-card/90 backdrop-blur-xl rounded-2xl border border-primary/10 shadow-xl p-6">
          <h2 className="text-xl font-semibold mb-6">Process Steps</h2>
          <div className="space-y-4">
            {processSteps.map((step: ProcessStep, index: number) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-start gap-4 p-4 rounded-lg border ${getStatusColor(step.status)}`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getStatusIcon(step.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm">{step.step}</h3>
                    <span className="text-xs text-muted-foreground">
                      {new Date(step.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{step.message}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Download Section */}
        {authMemory && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8 bg-card/90 backdrop-blur-xl rounded-2xl border border-primary/10 shadow-xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Auth Memory File</h2>
              <button
                onClick={() => {
                  const blob = new Blob([authMemory], { type: "text/typescript" })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a")
                  a.href = url
                  a.download = "auth-memory.ts"
                  document.body.appendChild(a)
                  a.click()
                  document.body.removeChild(a)
                  URL.revokeObjectURL(url)
                }}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold transition-all hover:bg-primary/90 flex items-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download
              </button>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 border border-border">
              <p className="text-sm text-muted-foreground mb-2">
                File ready: <code className="bg-background px-2 py-1 rounded text-foreground">auth-memory.ts</code>
              </p>
              <p className="text-xs text-muted-foreground">
                This file contains all authentication patterns, session storage, token strategies, roles, and permission checks extracted from the repository.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default function ProcessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <ProcessContent />
    </Suspense>
  )
}

