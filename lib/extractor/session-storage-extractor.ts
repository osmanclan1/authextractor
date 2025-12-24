import { readFileSync } from 'fs'
import { glob } from 'glob'
import type { SessionStorageConfig, SessionLifetime, SessionStorageImplementation } from './types'

export function extractSessionStorage(repoPath: string): {
  strategy: 'jwt' | 'database' | 'cookie' | 'localStorage' | 'hybrid'
  configuration: SessionStorageConfig
  lifetime: SessionLifetime
  implementation: SessionStorageImplementation
} {
  // Check for NextAuth session strategy
  const nextAuthFiles = glob.sync('**/*next-auth*.{ts,tsx,js}', { cwd: repoPath, absolute: true })
  
  for (const file of nextAuthFiles) {
    const content = readFileSync(file, 'utf-8')
    
    // Check for JWT strategy
    if (content.includes('strategy: "jwt"') || content.includes("strategy: 'jwt'")) {
      return extractJWTStrategy(content, file, repoPath)
    }
    
    // Check for database strategy
    if (content.includes('strategy: "database"') || content.includes("strategy: 'database'")) {
      return extractDatabaseStrategy(content, file, repoPath)
    }
  }

  // Check for cookie-based storage
  const cookieFiles = glob.sync('**/*.{ts,tsx,js}', { cwd: repoPath, absolute: true })
    .filter(path => {
      const content = readFileSync(path, 'utf-8')
      return content.includes('Set-Cookie') || content.includes('cookies.set') || content.includes('serialize')
    })
  
  if (cookieFiles.length > 0) {
    return extractCookieStorage(cookieFiles[0], repoPath)
  }

  // Check for localStorage
  const localStorageFiles = glob.sync('**/*.{ts,tsx,js}', { cwd: repoPath, absolute: true })
    .filter(path => {
      const content = readFileSync(path, 'utf-8')
      return content.includes('localStorage.setItem') && 
             (content.includes('token') || content.includes('session') || content.includes('user'))
    })
  
  if (localStorageFiles.length > 0) {
    return extractLocalStorage(localStorageFiles[0], repoPath)
  }

  // Default to JWT
  return {
    strategy: 'jwt' as const,
    configuration: {
      type: 'jwt',
      httpOnly: true,
      secure: true,
      sameSite: 'lax'
    },
    lifetime: {
      accessToken: 3600, // 1 hour default
      session: 86400 // 24 hours default
    },
    implementation: {
      filePath: '',
      template: '',
      storageLocation: 'httpOnly cookie'
    }
  }
}

function extractJWTStrategy(content: string, filePath: string, repoPath: string) {
  // Extract maxAge from cookies if present
  const maxAgeMatch = content.match(/maxAge:\s*(\d+)/)
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1]) : 3600

  // Extract cookie settings
  const httpOnly = content.includes('httpOnly: true')
  const secure = content.includes('secure:') ? content.match(/secure:\s*(true|false)/)?.[1] === 'true' : true
  const sameSite = content.match(/sameSite:\s*["'](\w+)["']/)?.[1] || 'lax'

  return {
    strategy: 'jwt' as const,
    configuration: {
      type: 'jwt',
      httpOnly,
      secure,
      sameSite: sameSite as 'strict' | 'lax' | 'none'
    },
    lifetime: {
      accessToken: maxAge,
      session: maxAge * 24 // Assume session lasts 24x token lifetime
    },
    implementation: {
      filePath: filePath.replace(repoPath, ''),
      template: extractSessionTemplate(content),
      storageLocation: 'httpOnly cookie'
    }
  }
}

function extractDatabaseStrategy(content: string, filePath: string, repoPath: string) {
  return {
    strategy: 'database' as const,
    configuration: {
      type: 'database',
      adapter: content.includes('MongoDBAdapter') ? 'mongodb' : 
               content.includes('FirestoreAdapter') ? 'firestore' :
               content.includes('PrismaAdapter') ? 'prisma' : 'unknown'
    },
    lifetime: {
      accessToken: 3600,
      session: 86400
    },
    implementation: {
      filePath: filePath.replace(repoPath, ''),
      template: extractSessionTemplate(content),
      storageLocation: 'database'
    }
  }
}

function extractCookieStorage(filePath: string, repoPath: string) {
  const content = readFileSync(filePath, 'utf-8')
  
  const maxAgeMatch = content.match(/maxAge:\s*(\d+)/)
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1]) : 3600
  
  const httpOnly = content.includes('httpOnly: true')
  const secure = content.includes('secure:') ? content.match(/secure:\s*(true|false)/)?.[1] === 'true' : true
  const sameSite = content.match(/sameSite:\s*["'](\w+)["']/)?.[1] || 'lax'

  return {
    strategy: 'cookie' as const,
    configuration: {
      type: 'cookie',
      httpOnly,
      secure,
      sameSite: sameSite as 'strict' | 'lax' | 'none',
      maxAge
    },
    lifetime: {
      accessToken: maxAge,
      session: maxAge
    },
    implementation: {
      filePath: filePath.replace(repoPath, ''),
      template: content,
      storageLocation: 'httpOnly cookie'
    }
  }
}

function extractLocalStorage(filePath: string, repoPath: string) {
  const content = readFileSync(filePath, 'utf-8')
  
  return {
    strategy: 'localStorage' as const,
    configuration: {
      type: 'localStorage'
    },
    lifetime: {
      accessToken: 3600,
      session: 86400
    },
    implementation: {
      filePath: filePath.replace(repoPath, ''),
      template: content,
      storageLocation: 'localStorage'
    }
  }
}

function extractSessionTemplate(content: string): string {
  // Try to extract session callback
  const sessionMatch = content.match(/session:\s*async?\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\}/)
  if (sessionMatch) {
    return sessionMatch[1].trim()
  }
  
  // Fallback to full content
  return content.substring(0, 500)
}

