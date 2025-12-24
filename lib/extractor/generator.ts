import { writeFileSync } from 'fs'
import type { AuthMemory } from './types'

export function generateAuthMemoryFile(authMemory: AuthMemory, outputPath: string): void {
  const content = generateFileContent(authMemory)
  writeFileSync(outputPath, content, 'utf-8')
}

function generateFileContent(authMemory: AuthMemory): string {
  return `// Auth Memory File
// Extracted from: ${authMemory.metadata.sourcePath}
// Generated at: ${authMemory.metadata.extractedAt}
// Framework: ${authMemory.metadata.framework}

export const AuthMemory = ${JSON.stringify(authMemory, null, 2)} as const

// Type exports
export type AuthMemoryType = typeof AuthMemory

// Helper function to get auth provider config
export function getAuthProvider() {
  return AuthMemory.authProvider
}

// Helper function to get session storage config
export function getSessionStorage() {
  return AuthMemory.sessionStorage
}

// Helper function to get token strategy
export function getTokenStrategy() {
  return AuthMemory.tokenStrategy
}

// Helper function to get role model
export function getRoleModel() {
  return AuthMemory.roleModel
}

// Helper function to get permission checks
export function getPermissionChecks() {
  return AuthMemory.permissionChecks
}

// Helper function to check if route is protected
export function isProtectedRoute(path: string): boolean {
  return AuthMemory.permissionChecks.protectedRoutes.some(route => route.path === path)
}

// Helper function to get required role for route
export function getRequiredRole(path: string): string | undefined {
  const route = AuthMemory.permissionChecks.protectedRoutes.find(r => r.path === path)
  return route?.requiredRole
}

// Helper function to get required permission for route
export function getRequiredPermission(path: string): string | undefined {
  const route = AuthMemory.permissionChecks.protectedRoutes.find(r => r.path === path)
  return route?.requiredPermission
}
`
}

