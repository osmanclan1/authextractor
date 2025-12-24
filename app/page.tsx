"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Download, Loader2, Github, Upload, Shield, Lock, Key, Users, Eye } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"

export default function Home() {
  const router = useRouter()
  const [inputMethod, setInputMethod] = useState<"url" | "file">("url")
  const [repoUrl, setRepoUrl] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [authMemory, setAuthMemory] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<any>(null)
  const [processSteps, setProcessSteps] = useState<any[]>([])
  const [storageKey, setStorageKey] = useState<string | null>(null)

  const handleExtract = async () => {
    if (inputMethod === "url" && !repoUrl.trim()) {
      setError("Please enter a repository URL")
      return
    }

    if (inputMethod === "file" && !selectedFile) {
      setError("Please select a zip file")
      return
    }

    setLoading(true)
    setError("")
    setSuccess(false)
    setAuthMemory(null)
    setMetadata(null)
    setProcessSteps([])
    setStorageKey(null)

    try {
      let response: Response
      
      if (inputMethod === "file" && selectedFile) {
        const formData = new FormData()
        formData.append("file", selectedFile)
        
        response = await fetch("/api/extract", {
          method: "POST",
          body: formData,
        })
      } else {
        response = await fetch("/api/extract", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ repoUrl: repoUrl.trim() }),
        })
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to extract auth patterns")
      }

      // Store data in sessionStorage
      const key = `extraction_${Date.now()}`
      sessionStorage.setItem(key, JSON.stringify({
        processSteps: data.processSteps || [],
        authMemory: data.authMemory || '',
        authMemoryData: data.authMemoryData || null,
        metadata: data.metadata || {}
      }))

      setAuthMemory(data.authMemory || '')
      setMetadata(data.metadata || {})
      setProcessSteps(data.processSteps || [])
      setStorageKey(key)
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.name.endsWith('.zip') && !file.type.includes('zip')) {
        setError("Please select a zip file")
        return
      }
      setSelectedFile(file)
      setError("")
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-background via-background to-muted/20 pb-8">
      <ModeToggle />
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute bg-primary/5 rounded-full"
            style={{
              width: `${Math.random() * 400 + 100}px`,
              height: `${Math.random() * 400 + 100}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              x: [0, Math.random() * 100 - 50],
              y: [0, Math.random() * 100 - 50],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: Math.random() * 10 + 10,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <div className="container relative z-10 px-4 py-6 flex items-center justify-center min-h-screen">
        <div className="max-w-3xl mx-auto w-full">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-center mb-6"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="flex items-center justify-center gap-3 mb-4"
            >
              <div className="p-3 rounded-xl bg-primary/10">
                <Shield className="w-8 h-8 text-primary" />
              </div>
            </motion.div>
            <h1 className="text-6xl md:text-7xl font-bold tracking-tight mb-4 leading-[1.1]">
              <span className="inline-block bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary to-primary text-primary">
                Auth Pattern
              </span>
              <br />
              <span className="inline-block bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary to-primary text-primary">
                Extractor
              </span>
            </h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
            >
              Extract authentication and authorization patterns from any GitHub repository into a reusable auth memory file.
              Security patterns cannot be improvised.
            </motion.p>
          </motion.div>

          {/* Input Card */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="relative"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-primary/50 blur-2xl opacity-50" />
            <div className="relative bg-card/90 backdrop-blur-xl rounded-2xl border border-primary/10 shadow-xl p-8">
              <div className="space-y-6">
                {/* Method Toggle */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setInputMethod("url")
                      setError("")
                      setSelectedFile(null)
                    }}
                    className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                      inputMethod === "url"
                        ? "bg-primary text-primary-foreground shadow-lg"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    <Github className="w-4 h-4 inline mr-2" />
                    GitHub URL
                  </button>
                  <button
                    onClick={() => {
                      setInputMethod("file")
                      setError("")
                      setRepoUrl("")
                    }}
                    className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                      inputMethod === "file"
                        ? "bg-primary text-primary-foreground shadow-lg"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    <Upload className="w-4 h-4 inline mr-2" />
                    Upload Zip
                  </button>
                </div>

                {/* URL Input */}
                {inputMethod === "url" && (
                  <div>
                    <label htmlFor="repo-url" className="block text-sm font-medium text-foreground mb-2">
                      GitHub Repository URL
                    </label>
                    <div className="flex gap-3">
                      <div className="flex-1 relative">
                        <Github className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <input
                          id="repo-url"
                          type="text"
                          value={repoUrl}
                          onChange={(e) => setRepoUrl(e.target.value)}
                          placeholder="https://github.com/username/repo.git"
                          className="w-full pl-10 pr-4 py-3 border border-input bg-background rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                          disabled={loading}
                          onKeyDown={(e) => e.key === 'Enter' && !loading && repoUrl.trim() && handleExtract()}
                        />
                      </div>
                      <button
                        onClick={handleExtract}
                        disabled={loading || !repoUrl.trim()}
                        className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Extracting...
                          </>
                        ) : (
                          <>
                            <Shield className="w-5 h-5" />
                            Extract
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* File Upload */}
                {inputMethod === "file" && (
                  <div>
                    <label htmlFor="file-upload" className="block text-sm font-medium text-foreground mb-2">
                      Upload Repository Zip File
                    </label>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label
                          htmlFor="file-upload"
                          className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-input rounded-lg cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                            <p className="mb-2 text-sm text-muted-foreground">
                              <span className="font-semibold">Click to upload</span> or drag and drop
                            </p>
                            <p className="text-xs text-muted-foreground">ZIP file only</p>
                          </div>
                          <input
                            id="file-upload"
                            type="file"
                            className="hidden"
                            accept=".zip,application/zip"
                            onChange={handleFileChange}
                            disabled={loading}
                          />
                        </label>
                        {selectedFile && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            Selected: <span className="font-medium text-foreground">{selectedFile.name}</span> ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                          </p>
                        )}
                      </div>
                      <button
                        onClick={handleExtract}
                        disabled={loading || !selectedFile}
                        className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 self-start shadow-lg"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Extracting...
                          </>
                        ) : (
                          <>
                            <Shield className="w-5 h-5" />
                            Extract
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg"
                  >
                    <p className="text-sm text-destructive">{error}</p>
                  </motion.div>
                )}

                {success && metadata && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-5 h-5 text-green-500" />
                      <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                        Auth patterns extracted successfully!
                      </p>
                    </div>
                    <div className="text-sm text-green-600 dark:text-green-400 space-y-1 mb-3">
                      <p>• Auth Provider: {metadata.authProvider}</p>
                      <p>• Session Strategy: {metadata.sessionStrategy}</p>
                      <p>• Roles: {metadata.roles}</p>
                      <p>• Permissions: {metadata.permissions}</p>
                      <p>• Protected Routes: {metadata.protectedRoutes}</p>
                      <p>• API Guards: {metadata.apiGuards}</p>
                    </div>
                    {storageKey && (
                      <button
                        onClick={() => router.push(`/process?key=${storageKey}`)}
                        className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium transition-all hover:bg-primary/90 flex items-center justify-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        View Extraction Process
                      </button>
                    )}
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Download Section */}
          {success && authMemory && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="relative mb-6"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-primary/50 blur-2xl opacity-50" />
              <div className="relative bg-card/90 backdrop-blur-xl rounded-2xl border border-primary/10 shadow-xl p-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-foreground">
                    Auth Memory File
                  </h2>
                  <button
                    onClick={() => {
                      if (!authMemory) return
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
                    className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold transition-all hover:bg-primary/90 flex items-center gap-2 shadow-lg"
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
              </div>
            </motion.div>
          )}

          {/* Features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3"
          >
            <div className="bg-card/50 backdrop-blur-sm rounded-lg p-4 border border-border">
              <Lock className="w-6 h-6 text-primary mb-2" />
              <h3 className="font-semibold mb-1">Auth Providers</h3>
              <p className="text-sm text-muted-foreground">Extract NextAuth, Firebase, Cognito & more</p>
            </div>
            <div className="bg-card/50 backdrop-blur-sm rounded-lg p-4 border border-border">
              <Key className="w-6 h-6 text-primary mb-2" />
              <h3 className="font-semibold mb-1">Token Strategy</h3>
              <p className="text-sm text-muted-foreground">Capture token lifetime & refresh patterns</p>
            </div>
            <div className="bg-card/50 backdrop-blur-sm rounded-lg p-4 border border-border">
              <Users className="w-6 h-6 text-primary mb-2" />
              <h3 className="font-semibold mb-1">Roles & Permissions</h3>
              <p className="text-sm text-muted-foreground">Detect RBAC/ABAC patterns</p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

