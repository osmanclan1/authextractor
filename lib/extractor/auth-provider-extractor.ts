import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { glob } from 'glob'
import type { AuthProviderConfig, AuthProviderImplementation, CallbackPattern } from './types'

export function extractAuthProvider(repoPath: string): {
  type: 'next-auth' | 'firebase' | 'cognito' | 'custom' | 'oauth' | 'magic-link' | 'unknown'
  name: string
  configuration: AuthProviderConfig
  implementation: AuthProviderImplementation
  callbacks?: CallbackPattern[]
} {
  // Detect NextAuth
  const nextAuthPath = glob.sync('**/next-auth.{ts,tsx,js}', { cwd: repoPath, absolute: true })[0] ||
                       glob.sync('**/[...nextauth]/**/*.{ts,tsx,js}', { cwd: repoPath, absolute: true })[0]
  
  if (nextAuthPath && existsSync(nextAuthPath)) {
    return extractNextAuth(nextAuthPath, repoPath)
  }

  // Detect Firebase Auth
  const firebaseAuthPath = glob.sync('**/firebase*.{ts,tsx,js}', { cwd: repoPath, absolute: true })
    .find(path => {
      const content = readFileSync(path, 'utf-8')
      return content.includes('firebase/auth') || content.includes('signInWith')
    })
  
  if (firebaseAuthPath) {
    return extractFirebaseAuth(firebaseAuthPath, repoPath)
  }

  // Detect AWS Cognito
  const cognitoPath = glob.sync('**/*.{ts,tsx,js}', { cwd: repoPath, absolute: true })
    .find(path => {
      const content = readFileSync(path, 'utf-8')
      return content.includes('cognito') || content.includes('COGNITO')
    })
  
  if (cognitoPath) {
    return extractCognito(cognitoPath, repoPath)
  }

  // Default to unknown
  return {
    type: 'unknown' as const,
    name: 'Unknown',
    configuration: {
      providers: []
    },
    implementation: {
      filePath: '',
      template: '',
      setup: '',
      usage: ''
    }
  }
}

function extractNextAuth(filePath: string, repoPath: string): {
  type: 'next-auth'
  name: string
  configuration: AuthProviderConfig
  implementation: AuthProviderImplementation
  callbacks: CallbackPattern[]
} {
  const content = readFileSync(filePath, 'utf-8')
  
  // Extract providers
  const providers: string[] = []
  if (content.includes('GoogleProvider')) providers.push('google')
  if (content.includes('EmailProvider')) providers.push('email')
  if (content.includes('GitHubProvider')) providers.push('github')
  if (content.includes('CredentialsProvider')) providers.push('credentials')

  // Extract adapter
  let adapter: string | undefined
  if (content.includes('MongoDBAdapter')) adapter = 'mongodb'
  if (content.includes('FirestoreAdapter')) adapter = 'firestore'
  if (content.includes('PrismaAdapter')) adapter = 'prisma'

  // Extract session strategy
  const sessionStrategy = content.match(/strategy:\s*["'](\w+)["']/)?.[1] || 'jwt'

  // Extract callbacks
  const callbacks: CallbackPattern[] = []
  const sessionCallback = extractCallback(content, 'session')
  const jwtCallback = extractCallback(content, 'jwt')
  
  if (sessionCallback) callbacks.push({ name: 'session', implementation: sessionCallback, filePath })
  if (jwtCallback) callbacks.push({ name: 'jwt', implementation: jwtCallback, filePath })

  // Extract template
  const template = extractCodeBlock(content, 'authOptions', 'export')

  return {
    type: 'next-auth' as const,
    name: 'NextAuth.js',
    configuration: {
      providers,
      adapter,
      strategy: sessionStrategy,
      secret: 'process.env.NEXTAUTH_SECRET'
    },
    implementation: {
      filePath: filePath.replace(repoPath, ''),
      template: template || content,
      setup: `import NextAuth from "next-auth"
import { authOptions } from "@/libs/next-auth"

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }`,
      usage: `import { useSession } from "next-auth/react"
const { data: session, status } = useSession()`
    },
    callbacks
  }
}

function extractFirebaseAuth(filePath: string, repoPath: string): {
  type: 'firebase'
  name: string
  configuration: AuthProviderConfig
  implementation: AuthProviderImplementation
} {
  const content = readFileSync(filePath, 'utf-8')
  
  return {
    type: 'firebase' as const,
    name: 'Firebase Authentication',
    configuration: {
      providers: ['firebase'],
      projectId: 'process.env.FIREBASE_PROJECT_ID'
    },
    implementation: {
      filePath: filePath.replace(repoPath, ''),
      template: content,
      setup: `import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"

const firebaseConfig = { /* config */ }
const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)`,
      usage: `import { signInWithEmailAndPassword } from "firebase/auth"
import { auth } from "@/libs/firebase"`
    }
  }
}

function extractCognito(filePath: string, repoPath: string): {
  type: 'cognito'
  name: string
  configuration: AuthProviderConfig
  implementation: AuthProviderImplementation
} {
  const content = readFileSync(filePath, 'utf-8')
  
  return {
    type: 'cognito' as const,
    name: 'AWS Cognito',
    configuration: {
      providers: ['cognito'],
      domain: 'process.env.COGNITO_DOMAIN',
      clientId: 'process.env.COGNITO_CLIENT_ID'
    },
    implementation: {
      filePath: filePath.replace(repoPath, ''),
      template: content,
      setup: `// AWS Cognito configuration
const COGNITO_DOMAIN = process.env.COGNITO_DOMAIN
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID`,
      usage: `// Cognito authentication via API routes`
    }
  }
}

function extractCallback(content: string, callbackName: string): string | null {
  const regex = new RegExp(`${callbackName}:\\s*async?\\s*\\([^)]*\\)\\s*=>\\s*\\{([^}]+(?:\\{[^}]*\\}[^}]*)*)\\}`, 's')
  const match = content.match(regex)
  return match ? match[1].trim() : null
}

function extractCodeBlock(content: string, startPattern: string, endPattern?: string): string | null {
  const startIndex = content.indexOf(startPattern)
  if (startIndex === -1) return null
  
  let braceCount = 0
  let inBlock = false
  let endIndex = startIndex
  
  for (let i = startIndex; i < content.length; i++) {
    if (content[i] === '{') {
      braceCount++
      inBlock = true
    } else if (content[i] === '}') {
      braceCount--
      if (inBlock && braceCount === 0) {
        endIndex = i + 1
        break
      }
    }
  }
  
  return content.substring(startIndex, endIndex)
}

