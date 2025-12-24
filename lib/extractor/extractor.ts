import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { extractAuthProvider } from './auth-provider-extractor'
import { extractSessionStorage } from './session-storage-extractor'
import { extractTokenStrategy } from './token-strategy-extractor'
import { extractRoleModel } from './role-model-extractor'
import { extractPermissionChecks } from './permission-check-extractor'
import type { AuthMemory } from './types'

export async function extractAuthSystem(repoPath: string): Promise<AuthMemory> {
  if (!existsSync(repoPath)) {
    throw new Error(`Repository path does not exist: ${repoPath}`)
  }

  // Detect framework
  const packageJsonPath = join(repoPath, 'package.json')
  let framework = 'unknown'
  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
    if (packageJson.dependencies?.['next']) {
      framework = 'nextjs'
    } else if (packageJson.dependencies?.['react']) {
      framework = 'react'
    } else if (packageJson.dependencies?.['express']) {
      framework = 'express'
    }
  }

  // Extract project name
  const projectName = repoPath.split('/').pop() || 'unknown'

  // Extract all auth patterns
  const authProvider = extractAuthProvider(repoPath)
  const sessionStorage = extractSessionStorage(repoPath)
  const tokenStrategy = extractTokenStrategy(repoPath)
  const roleModel = extractRoleModel(repoPath)
  const permissionChecks = extractPermissionChecks(repoPath)

  // Build auth memory
  const authMemory: AuthMemory = {
    metadata: {
      projectName,
      extractedAt: new Date().toISOString(),
      framework,
      sourcePath: repoPath
    },
    authProvider,
    sessionStorage,
    tokenStrategy,
    roleModel,
    permissionChecks,
    utilities: {
      authHelpers: extractAuthHelpers(repoPath),
      commonHooks: extractCommonHooks(repoPath),
      authFunctions: extractAuthFunctions(repoPath)
    },
    instructions: {
      setup: generateSetupInstructions(authProvider, sessionStorage, tokenStrategy),
      usage: generateUsageInstructions(authProvider, sessionStorage, tokenStrategy),
      security: generateSecurityInstructions(sessionStorage, tokenStrategy)
    }
  }

  return authMemory
}

function extractAuthHelpers(repoPath: string): string[] {
  const helpers: string[] = []
  
  // Look for common auth helper files
  const helperFiles = [
    'libs/auth.ts',
    'lib/auth.ts',
    'utils/auth.ts',
    'helpers/auth.ts',
    'libs/middleware.ts',
    'lib/middleware.ts'
  ]

  for (const helperFile of helperFiles) {
    const fullPath = join(repoPath, helperFile)
    if (existsSync(fullPath)) {
      helpers.push(helperFile)
    }
  }

  return helpers
}

function extractCommonHooks(repoPath: string): string[] {
  const hooks: string[] = []
  
  // Look for auth hooks
  const hookFiles = [
    'hooks/useAuth.ts',
    'hooks/useAuth.tsx',
    'contexts/AuthContext.tsx',
    'context/AuthContext.tsx'
  ]

  for (const hookFile of hookFiles) {
    const fullPath = join(repoPath, hookFile)
    if (existsSync(fullPath)) {
      hooks.push(hookFile)
    }
  }

  return hooks
}

function extractAuthFunctions(repoPath: string): string[] {
  const functions: string[] = []
  
  // Look for auth-related functions in libs
  const libFiles = [
    'libs/next-auth.ts',
    'lib/next-auth.ts',
    'libs/firebase.ts',
    'lib/firebase.ts'
  ]

  for (const libFile of libFiles) {
    const fullPath = join(repoPath, libFile)
    if (existsSync(fullPath)) {
      functions.push(libFile)
    }
  }

  return functions
}

function generateSetupInstructions(
  authProvider: any,
  sessionStorage: any,
  tokenStrategy: any
): string[] {
  const instructions: string[] = []

  if (authProvider.type === 'next-auth') {
    instructions.push('1. Install NextAuth: npm install next-auth')
    instructions.push('2. Create auth configuration file')
    instructions.push('3. Set up environment variables (NEXTAUTH_SECRET, provider credentials)')
    if (authProvider.configuration.adapter) {
      instructions.push(`4. Install and configure ${authProvider.configuration.adapter} adapter`)
    }
  }

  if (sessionStorage.strategy === 'jwt') {
    instructions.push('5. Configure JWT session strategy')
  } else if (sessionStorage.strategy === 'database') {
    instructions.push('5. Set up database adapter for sessions')
  }

  if (tokenStrategy.refreshToken) {
    instructions.push('6. Implement refresh token strategy')
  }

  return instructions
}

function generateUsageInstructions(
  authProvider: any,
  sessionStorage: any,
  tokenStrategy: any
): string[] {
  const instructions: string[] = []

  if (authProvider.type === 'next-auth') {
    instructions.push('Use useSession() hook to access session data')
    instructions.push('Use signIn() and signOut() from next-auth/react')
  }

  if (sessionStorage.strategy === 'jwt') {
    instructions.push('Session is stored in JWT token (httpOnly cookie)')
  }

  if (tokenStrategy.refreshStrategy.type !== 'none') {
    instructions.push(`Token refresh strategy: ${tokenStrategy.refreshStrategy.type}`)
  }

  return instructions
}

function generateSecurityInstructions(
  sessionStorage: any,
  tokenStrategy: any
): string[] {
  const instructions: string[] = []

  instructions.push('Always use httpOnly cookies for tokens')
  instructions.push('Set secure flag in production')
  instructions.push('Use sameSite: "lax" or "strict" for cookies')
  
  if (tokenStrategy.accessToken.lifetime) {
    instructions.push(`Access token lifetime: ${tokenStrategy.accessToken.lifetime} seconds`)
  }

  if (tokenStrategy.refreshToken?.lifetime) {
    instructions.push(`Refresh token lifetime: ${tokenStrategy.refreshToken.lifetime} seconds`)
  }

  instructions.push('Never expose tokens in client-side code')
  instructions.push('Always verify tokens on the server side')

  return instructions
}

