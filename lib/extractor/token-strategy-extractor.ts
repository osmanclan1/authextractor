import { readFileSync } from 'fs'
import { glob } from 'glob'
import type { TokenConfig, RefreshStrategy, TokenStrategyImplementation } from './types'

export function extractTokenStrategy(repoPath: string): {
  accessToken: TokenConfig
  refreshToken?: TokenConfig
  refreshStrategy: RefreshStrategy
  implementation: TokenStrategyImplementation
} {
  // Find token-related files
  const tokenFiles = glob.sync('**/*.{ts,tsx,js}', { cwd: repoPath, absolute: true })
    .filter(path => {
      const content = readFileSync(path, 'utf-8')
      return content.includes('access_token') || 
             content.includes('accessToken') ||
             content.includes('refresh_token') ||
             content.includes('refreshToken') ||
             content.includes('idToken') ||
             content.includes('id_token')
    })

  let accessToken: TokenConfig = {
    lifetime: 3600, // 1 hour default
    storage: 'httpOnly'
  }

  let refreshToken: TokenConfig | undefined
  let refreshStrategy: RefreshStrategy = {
    type: 'none',
    trigger: 'on-demand',
    implementation: ''
  }

  let implementation: TokenStrategyImplementation = {
    filePath: '',
    template: ''
  }

  for (const file of tokenFiles) {
    const content = readFileSync(file, 'utf-8')
    
    // Extract access token lifetime
    const accessTokenLifetime = extractTokenLifetime(content, 'access_token', 'accessToken', 'idToken', 'id_token')
    if (accessTokenLifetime) {
      accessToken.lifetime = accessTokenLifetime
    }

    // Extract refresh token
    if (content.includes('refresh_token') || content.includes('refreshToken')) {
      const refreshTokenLifetime = extractTokenLifetime(content, 'refresh_token', 'refreshToken')
      refreshToken = {
        lifetime: refreshTokenLifetime || 604800, // 7 days default
        storage: 'httpOnly'
      }

      // Detect refresh strategy
      if (content.includes('refresh') || content.includes('refreshToken')) {
        refreshStrategy = extractRefreshStrategy(content, file, repoPath)
      }
    }

    // Extract token storage
    if (content.includes('httpOnly')) {
      accessToken.httpOnly = true
      accessToken.storage = 'httpOnly'
    }
    if (content.includes('secure:')) {
      accessToken.secure = content.match(/secure:\s*(true|false)/)?.[1] === 'true'
    }
    if (content.includes('sameSite')) {
      const sameSite = content.match(/sameSite:\s*["'](\w+)["']/)?.[1]
      if (sameSite) {
        accessToken.sameSite = sameSite as 'strict' | 'lax' | 'none'
      }
    }

    // Store implementation
    if (!implementation.filePath || content.length < implementation.template.length) {
      implementation = {
        filePath: file.replace(repoPath, ''),
        template: content.substring(0, 1000),
        refreshLogic: extractRefreshLogic(content)
      }
    }
  }

  return {
    accessToken,
    refreshToken,
    refreshStrategy,
    implementation
  }
}

function extractTokenLifetime(content: string, ...tokenNames: string[]): number | null {
  for (const tokenName of tokenNames) {
    // Look for maxAge patterns
    const maxAgePattern = new RegExp(`${tokenName}[^}]*maxAge:\\s*(\\d+)`, 's')
    const maxAgeMatch = content.match(maxAgePattern)
    if (maxAgeMatch) {
      return parseInt(maxAgeMatch[1])
    }

    // Look for expires_in
    const expiresPattern = new RegExp(`${tokenName}[^}]*expires_in[^:]*:\\s*(\\d+)`, 's')
    const expiresMatch = content.match(expiresPattern)
    if (expiresMatch) {
      return parseInt(expiresMatch[1])
    }

    // Look for expiresIn
    const expiresInPattern = new RegExp(`${tokenName}[^}]*expiresIn[^:]*:\\s*(\\d+)`, 's')
    const expiresInMatch = content.match(expiresInPattern)
    if (expiresInMatch) {
      return parseInt(expiresInMatch[1])
    }
  }

  return null
}

function extractRefreshStrategy(content: string, filePath: string, repoPath: string): RefreshStrategy {
  // Check for automatic refresh
  if (content.includes('setInterval') || content.includes('useEffect') && content.includes('refresh')) {
    const intervalMatch = content.match(/setInterval[^,]*,\s*(\d+)/)
    return {
      type: 'automatic',
      trigger: 'interval',
      interval: intervalMatch ? parseInt(intervalMatch[1]) : 300000, // 5 minutes default
      implementation: extractRefreshLogic(content) || '',
      filePath: filePath.replace(repoPath, '')
    }
  }

  // Check for before-expiry refresh
  if (content.includes('expires') && content.includes('refresh')) {
    return {
      type: 'automatic',
      trigger: 'before-expiry',
      implementation: extractRefreshLogic(content) || '',
      filePath: filePath.replace(repoPath, '')
    }
  }

  // Check for manual refresh
  if (content.includes('refresh') && (content.includes('function') || content.includes('const') || content.includes('async'))) {
    return {
      type: 'manual',
      trigger: 'on-demand',
      implementation: extractRefreshLogic(content) || '',
      filePath: filePath.replace(repoPath, '')
    }
  }

  // Default to manual
  return {
    type: 'manual',
    trigger: 'on-demand',
    implementation: ''
  }
}

function extractRefreshLogic(content: string): string | null {
  // Try to extract refresh function
  const refreshFunctionPattern = /(?:async\s+)?(?:function\s+)?refresh[^{]*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s
  const match = content.match(refreshFunctionPattern)
  if (match) {
    return match[1].trim()
  }

  // Try to extract refresh logic from useEffect or similar
  const useEffectPattern = /useEffect\s*\([^)]*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s
  const useEffectMatch = content.match(useEffectPattern)
  if (useEffectMatch && useEffectMatch[1].includes('refresh')) {
    return useEffectMatch[1].trim()
  }

  return null
}

