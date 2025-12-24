import { readFileSync } from 'fs'
import { glob } from 'glob'
import type { MiddlewarePattern, ProtectedRoute, APIGuard, ComponentGuard } from './types'

export function extractPermissionChecks(repoPath: string): {
  middleware: MiddlewarePattern[]
  protectedRoutes: ProtectedRoute[]
  apiGuards: APIGuard[]
  componentGuards?: ComponentGuard[]
} {
  const middleware: MiddlewarePattern[] = []
  const protectedRoutes: ProtectedRoute[] = []
  const apiGuards: APIGuard[] = []
  const componentGuards: ComponentGuard[] = []

  // Find middleware files
  const middlewareFiles = glob.sync('**/*middleware*.{ts,tsx,js}', { cwd: repoPath, absolute: true })
    .concat(glob.sync('**/middleware.{ts,tsx,js}', { cwd: repoPath, absolute: true }))

  for (const file of middlewareFiles) {
    const content = readFileSync(file, 'utf-8')
    const middlewarePattern = extractMiddlewarePattern(content, file, repoPath)
    if (middlewarePattern) {
      middleware.push(middlewarePattern)
    }
  }

  // Find API route files
  const apiRouteFiles = glob.sync('**/api/**/*.{ts,tsx,js}', { cwd: repoPath, absolute: true })
    .filter(path => !path.includes('node_modules'))

  for (const file of apiRouteFiles) {
    const content = readFileSync(file, 'utf-8')
    
    // Check if it's a protected route
    if (content.includes('authMiddleware') || 
        content.includes('requireAuth') ||
        content.includes('checkAuth') ||
        content.includes('verifyToken') ||
        content.includes('unauthorized') ||
        content.includes('Unauthorized')) {
      
      const apiGuard = extractAPIGuard(content, file, repoPath)
      if (apiGuard) {
        apiGuards.push(apiGuard)
      }

      const protectedRoute = extractProtectedRoute(content, file, repoPath)
      if (protectedRoute) {
        protectedRoutes.push(protectedRoute)
      }
    }
  }

  // Find component files with auth checks
  const componentFiles = glob.sync('**/*.{tsx,jsx}', { cwd: repoPath, absolute: true })
    .filter(path => {
      const content = readFileSync(path, 'utf-8')
      return content.includes('useAuth') ||
             content.includes('useSession') ||
             content.includes('isAuthenticated') ||
             content.includes('requireAuth')
    })

  for (const file of componentFiles.slice(0, 10)) { // Limit to first 10 to avoid too many
    const content = readFileSync(file, 'utf-8')
    const componentGuard = extractComponentGuard(content, file, repoPath)
    if (componentGuard) {
      componentGuards.push(componentGuard)
    }
  }

  return {
    middleware,
    protectedRoutes,
    apiGuards,
    componentGuards: componentGuards.length > 0 ? componentGuards : undefined
  }
}

function extractMiddlewarePattern(content: string, filePath: string, repoPath: string): MiddlewarePattern | null {
  // Look for middleware function
  const middlewareMatch = content.match(/(?:export\s+)?(?:async\s+)?(?:function\s+)?middleware\s*\([^)]*\)\s*\{([\s\S]*?)\}/)
  if (!middlewareMatch) {
    return null
  }

  const checks: string[] = []
  if (content.includes('authMiddleware')) checks.push('auth')
  if (content.includes('verifyToken')) checks.push('token')
  if (content.includes('checkRole')) checks.push('role')
  if (content.includes('checkPermission')) checks.push('permission')

  return {
    name: 'middleware',
    type: 'global',
    filePath: filePath.replace(repoPath, ''),
    template: middlewareMatch[1].trim(),
    location: 'middleware.ts',
    checks
  }
}

function extractAPIGuard(content: string, filePath: string, repoPath: string): APIGuard | null {
  // Extract route path from file path
  const pathMatch = filePath.match(/api\/([^/]+)\/route/)
  const endpoint = pathMatch ? `/api/${pathMatch[1]}` : filePath.replace(repoPath, '')

  // Extract HTTP method
  const method = content.includes('export async function GET') ? 'GET' :
                 content.includes('export async function POST') ? 'POST' :
                 content.includes('export async function PUT') ? 'PUT' :
                 content.includes('export async function PATCH') ? 'PATCH' :
                 content.includes('export async function DELETE') ? 'DELETE' : 'GET'

  // Determine protection type
  let protection: 'auth' | 'role' | 'permission' | 'custom' = 'auth'
  if (content.includes('checkRole') || content.includes('role')) {
    protection = 'role'
  } else if (content.includes('checkPermission') || content.includes('permission')) {
    protection = 'permission'
  } else if (content.includes('authMiddleware') || content.includes('verifyToken')) {
    protection = 'auth'
  } else {
    protection = 'custom'
  }

  // Extract middleware name
  const middlewareMatch = content.match(/(?:const|await)\s+(\w+)\s*=\s*(?:await\s+)?(\w+Middleware|authMiddleware|verifyToken)/)
  const middleware = middlewareMatch ? middlewareMatch[2] : undefined

  return {
    endpoint,
    method,
    protection,
    middleware,
    filePath: filePath.replace(repoPath, ''),
    template: content.substring(0, 500)
  }
}

function extractProtectedRoute(content: string, filePath: string, repoPath: string): ProtectedRoute | null {
  const pathMatch = filePath.match(/api\/([^/]+)\/route/)
  const path = pathMatch ? `/api/${pathMatch[1]}` : filePath.replace(repoPath, '')

  // Determine protection type
  let protection: 'auth' | 'role' | 'permission' | 'custom' = 'auth'
  let requiredRole: string | undefined
  let requiredPermission: string | undefined

  if (content.includes('checkRole') || content.includes('role')) {
    protection = 'role'
    const roleMatch = content.match(/role\s*[=!]==\s*["'](\w+)["']/)
    if (roleMatch) {
      requiredRole = roleMatch[1]
    }
  } else if (content.includes('checkPermission') || content.includes('permission')) {
    protection = 'permission'
    const permMatch = content.match(/permission\s*[=!]==\s*["'](\w+)["']/)
    if (permMatch) {
      requiredPermission = permMatch[1]
    }
  } else if (content.includes('authMiddleware') || content.includes('verifyToken')) {
    protection = 'auth'
  } else {
    protection = 'custom'
  }

  return {
    path,
    protection,
    requiredRole,
    requiredPermission,
    implementation: content.substring(0, 500)
  }
}

function extractComponentGuard(content: string, filePath: string, repoPath: string): ComponentGuard | null {
  // Extract component name
  const componentMatch = content.match(/(?:export\s+)?(?:default\s+)?(?:function|const)\s+(\w+)/)
  const component = componentMatch ? componentMatch[1] : 'Component'

  // Determine protection type
  let protection: 'auth' | 'role' | 'permission' = 'auth'
  let requiredRole: string | undefined
  let requiredPermission: string | undefined

  if (content.includes('role') && (content.includes('===') || content.includes('!=='))) {
    protection = 'role'
    const roleMatch = content.match(/role\s*[=!]==\s*["'](\w+)["']/)
    if (roleMatch) {
      requiredRole = roleMatch[1]
    }
  } else if (content.includes('permission') && (content.includes('===') || content.includes('!=='))) {
    protection = 'permission'
    const permMatch = content.match(/permission\s*[=!]==\s*["'](\w+)["']/)
    if (permMatch) {
      requiredPermission = permMatch[1]
    }
  } else {
    protection = 'auth'
  }

  return {
    component,
    protection,
    requiredRole,
    requiredPermission,
    filePath: filePath.replace(repoPath, ''),
    template: content.substring(0, 500)
  }
}

