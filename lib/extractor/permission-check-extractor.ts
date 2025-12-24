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
    
    // Check if it's a protected route - expanded patterns
    if (content.includes('authMiddleware') || 
        content.includes('requireAuth') ||
        content.includes('checkAuth') ||
        content.includes('verifyToken') ||
        content.includes('unauthorized') ||
        content.includes('Unauthorized') ||
        content.includes('cookies.get') && (content.includes('it') || content.includes('idToken') || content.includes('access_token') || content.includes('at')) ||
        content.includes('status: 401') ||
        content.includes('status:401') ||
        content.includes('statusCode: 401') ||
        content.includes('No authentication token') ||
        content.includes('Authentication required') ||
        content.includes('JWT') ||
        content.includes('jwt') ||
        content.includes('idToken') ||
        content.includes('id_token')) {
      
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
             content.includes('requireAuth') ||
             content.includes('checkAuth') ||
             (content.includes('router.push') && (content.includes('signin') || content.includes('login'))) ||
             (content.includes('useRouter') && content.includes('push'))
    })

  for (const file of componentFiles.slice(0, 20)) { // Increased limit
    const content = readFileSync(file, 'utf-8')
    const componentGuard = extractComponentGuard(content, file, repoPath)
    if (componentGuard) {
      componentGuards.push(componentGuard)
    }
  }

  // Find page files with client-side protection
  const pageFiles = glob.sync('**/app/**/page.{tsx,jsx}', { cwd: repoPath, absolute: true })
    .concat(glob.sync('**/pages/**/*.{tsx,jsx}', { cwd: repoPath, absolute: true }))
    .filter(path => {
      const content = readFileSync(path, 'utf-8')
      return content.includes('useAuth') ||
             content.includes('isAuthenticated') ||
             (content.includes('router') && content.includes('push') && (content.includes('signin') || content.includes('login')))
    })

  for (const file of pageFiles.slice(0, 10)) {
    const content = readFileSync(file, 'utf-8')
    const pageRoute = extractPageRouteProtection(content, file, repoPath)
    if (pageRoute) {
      protectedRoutes.push(pageRoute)
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
  const pathMatch = filePath.match(/api\/([^/]+(?:\/[^/]+)*)\/route/)
  let endpoint = pathMatch ? `/api/${pathMatch[1]}` : filePath.replace(repoPath, '')
  
  // Handle nested routes
  if (!endpoint.startsWith('/api/')) {
    const apiMatch = filePath.match(/api\/(.+?)(?:\/route|$)/)
    if (apiMatch) {
      endpoint = `/api/${apiMatch[1]}`
    }
  }

  // Extract HTTP method
  const method = content.includes('export async function GET') ? 'GET' :
                 content.includes('export async function POST') ? 'POST' :
                 content.includes('export async function PUT') ? 'PUT' :
                 content.includes('export async function PATCH') ? 'PATCH' :
                 content.includes('export async function DELETE') ? 'DELETE' : 'GET'

  // Determine protection type - expanded detection
  let protection: 'auth' | 'role' | 'permission' | 'custom' = 'auth'
  if (content.includes('checkRole') || content.includes('role') || content.includes('admin')) {
    protection = 'role'
  } else if (content.includes('checkPermission') || content.includes('permission')) {
    protection = 'permission'
  } else if (content.includes('authMiddleware') || 
             content.includes('verifyToken') ||
             content.includes('cookies.get') && (content.includes('it') || content.includes('idToken') || content.includes('at')) ||
             content.includes('No authentication token') ||
             content.includes('Authentication required') ||
             content.includes('status: 401')) {
    protection = 'auth'
  } else {
    protection = 'custom'
  }

  // Extract middleware name or protection pattern
  let middleware: string | undefined
  const middlewareMatch = content.match(/(?:const|await)\s+(\w+)\s*=\s*(?:await\s+)?(\w+Middleware|authMiddleware|verifyToken)/)
  if (middlewareMatch) {
    middleware = middlewareMatch[2]
  } else if (content.includes('cookies.get')) {
    middleware = 'cookie-based-auth'
  } else if (content.includes('JWT') || content.includes('jwt')) {
    middleware = 'jwt-verification'
  }

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
  const pathMatch = filePath.match(/api\/([^/]+(?:\/[^/]+)*)\/route/)
  let path = pathMatch ? `/api/${pathMatch[1]}` : filePath.replace(repoPath, '')
  
  // Handle nested routes
  if (!path.startsWith('/api/')) {
    const apiMatch = filePath.match(/api\/(.+?)(?:\/route|$)/)
    if (apiMatch) {
      path = `/api/${apiMatch[1]}`
    }
  }

  // Determine protection type - expanded detection
  let protection: 'auth' | 'role' | 'permission' | 'custom' = 'auth'
  let requiredRole: string | undefined
  let requiredPermission: string | undefined

  if (content.includes('checkRole') || content.includes('role') || content.includes('admin')) {
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
  } else if (content.includes('authMiddleware') || 
             content.includes('verifyToken') ||
             content.includes('cookies.get') && (content.includes('it') || content.includes('idToken') || content.includes('at')) ||
             content.includes('No authentication token') ||
             content.includes('Authentication required') ||
             content.includes('status: 401')) {
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

  // Determine protection type - expanded detection
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
  } else if (content.includes('useAuth') || 
             content.includes('isAuthenticated') ||
             content.includes('checkAuth') ||
             (content.includes('router') && content.includes('push') && (content.includes('signin') || content.includes('login')))) {
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

function extractPageRouteProtection(content: string, filePath: string, repoPath: string): ProtectedRoute | null {
  // Extract route path from file path
  let path = filePath.replace(repoPath, '')
  
  // Convert file path to route path
  if (path.includes('/app/')) {
    const appMatch = path.match(/app\/(.+?)(?:\/page|$)/)
    if (appMatch) {
      path = `/${appMatch[1]}`
    }
  } else if (path.includes('/pages/')) {
    const pagesMatch = path.match(/pages\/(.+?)(?:\/index|$)/)
    if (pagesMatch) {
      path = `/${pagesMatch[1]}`
    }
  }

  // Determine protection type
  let protection: 'auth' | 'role' | 'permission' | 'custom' = 'auth'
  let requiredRole: string | undefined
  let requiredPermission: string | undefined

  if (content.includes('useAuth') || 
      content.includes('isAuthenticated') ||
      (content.includes('router') && content.includes('push') && (content.includes('signin') || content.includes('login')))) {
    protection = 'auth'
  } else if (content.includes('role')) {
    protection = 'role'
    const roleMatch = content.match(/role\s*[=!]==\s*["'](\w+)["']/)
    if (roleMatch) {
      requiredRole = roleMatch[1]
    }
  } else if (content.includes('permission')) {
    protection = 'permission'
    const permMatch = content.match(/permission\s*[=!]==\s*["'](\w+)["']/)
    if (permMatch) {
      requiredPermission = permMatch[1]
    }
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

