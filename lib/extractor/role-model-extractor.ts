import { readFileSync } from 'fs'
import { glob } from 'glob'
import type { RoleDefinition, PermissionDefinition, RoleModelImplementation, RoleHierarchy } from './types'

export function extractRoleModel(repoPath: string): {
  roles: RoleDefinition[]
  permissions: PermissionDefinition[]
  implementation: RoleModelImplementation
  hierarchy?: RoleHierarchy
} {
  const roles: RoleDefinition[] = []
  const permissions: PermissionDefinition[] = []
  
  // Find files that might contain role definitions
  const roleFiles = glob.sync('**/*.{ts,tsx,js}', { cwd: repoPath, absolute: true })
    .filter(path => {
      const content = readFileSync(path, 'utf-8')
      return content.includes('role') || 
             content.includes('Role') ||
             content.includes('permission') ||
             content.includes('Permission') ||
             content.includes('admin') ||
             content.includes('user') ||
             content.includes('RBAC') ||
             content.includes('ABAC')
    })

  let implementation: RoleModelImplementation = {
    filePath: '',
    template: '',
    checkPattern: ''
  }

  for (const file of roleFiles) {
    const content = readFileSync(file, 'utf-8')
    
    // Extract role definitions
    const extractedRoles = extractRoles(content)
    roles.push(...extractedRoles)
    
    // Extract permissions
    const extractedPermissions = extractPermissions(content)
    permissions.push(...extractedPermissions)
    
    // Extract role check patterns
    const roleCheckPattern = extractRoleCheckPattern(content)
    if (roleCheckPattern && !implementation.checkPattern) {
      implementation.checkPattern = roleCheckPattern
      implementation.filePath = file.replace(repoPath, '')
      implementation.template = content.substring(0, 1000)
    }
  }

  // Deduplicate roles and permissions
  const uniqueRoles = Array.from(new Map(roles.map(r => [r.name, r])).values())
  const uniquePermissions = Array.from(new Map(permissions.map(p => [p.name, p])).values())

  // Extract hierarchy if present
  const hierarchy = extractHierarchy(uniqueRoles)

  return {
    roles: uniqueRoles,
    permissions: uniquePermissions,
    implementation,
    hierarchy
  }
}

function extractRoles(content: string): RoleDefinition[] {
  const roles: RoleDefinition[] = []
  
  // Look for role arrays or objects
  const roleArrayPattern = /(?:const|let|var)\s+roles?\s*=\s*\[([^\]]+)\]/s
  const roleArrayMatch = content.match(roleArrayPattern)
  if (roleArrayMatch) {
    const roleStrings = roleArrayMatch[1].split(',').map(s => s.trim().replace(/["']/g, ''))
    roleStrings.forEach(roleName => {
      if (roleName) {
        roles.push({
          name: roleName,
          permissions: []
        })
      }
    })
  }

  // Look for role objects
  const roleObjectPattern = /(?:const|let|var)\s+roles?\s*=\s*\{([^}]+)\}/s
  const roleObjectMatch = content.match(roleObjectPattern)
  if (roleObjectMatch) {
    const roleEntries = roleObjectMatch[1].split(',').map(s => s.trim())
    roleEntries.forEach(entry => {
      const match = entry.match(/(\w+):\s*\[([^\]]+)\]/)
      if (match) {
        const roleName = match[1]
        const permissions = match[2].split(',').map(p => p.trim().replace(/["']/g, ''))
        roles.push({
          name: roleName,
          permissions
        })
      }
    })
  }

  // Look for common role patterns in code
  const commonRoles = ['admin', 'user', 'viewer', 'editor', 'moderator', 'guest']
  commonRoles.forEach(roleName => {
    if (content.includes(`role === "${roleName}"`) || 
        content.includes(`role === '${roleName}'`) ||
        content.includes(`role: "${roleName}"`) ||
        content.includes(`role: '${roleName}'`)) {
      if (!roles.find(r => r.name === roleName)) {
        roles.push({
          name: roleName,
          permissions: []
        })
      }
    }
  })

  // Look for role in user objects
  const userRolePattern = /user\.role\s*[=:]\s*["'](\w+)["']/g
  let match
  while ((match = userRolePattern.exec(content)) !== null) {
    const roleName = match[1]
    if (!roles.find(r => r.name === roleName)) {
      roles.push({
        name: roleName,
        permissions: []
      })
    }
  }

  return roles
}

function extractPermissions(content: string): PermissionDefinition[] {
  const permissions: PermissionDefinition[] = []
  
  // Look for permission arrays
  const permissionArrayPattern = /(?:const|let|var)\s+permissions?\s*=\s*\[([^\]]+)\]/s
  const permissionArrayMatch = content.match(permissionArrayPattern)
  if (permissionArrayMatch) {
    const permissionStrings = permissionArrayMatch[1].split(',').map(s => s.trim().replace(/["']/g, ''))
    permissionStrings.forEach(permName => {
      if (permName) {
        permissions.push({
          name: permName
        })
      }
    })
  }

  // Look for permission checks in code
  const permissionCheckPattern = /(?:hasPermission|can|checkPermission)\s*\([^,]+,\s*["'](\w+)["']/g
  let match
  while ((match = permissionCheckPattern.exec(content)) !== null) {
    const permName = match[1]
    if (!permissions.find(p => p.name === permName)) {
      permissions.push({
        name: permName
      })
    }
  }

  // Look for common permissions
  const commonPermissions = ['read', 'write', 'delete', 'update', 'create', 'view', 'edit', 'admin']
  commonPermissions.forEach(permName => {
    if (content.includes(`permission === "${permName}"`) || 
        content.includes(`permission === '${permName}'`)) {
      if (!permissions.find(p => p.name === permName)) {
        permissions.push({
          name: permName
        })
      }
    }
  })

  return permissions
}

function extractRoleCheckPattern(content: string): string | null {
  // Look for role check functions
  const roleCheckPattern = /(?:function|const)\s+\w*[Rr]ole\w*\s*[=\(].*?\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s
  const match = content.match(roleCheckPattern)
  if (match) {
    return match[1].trim()
  }

  // Look for inline role checks
  const inlineCheck = content.match(/(?:user\.role|role)\s*[=!]==\s*["'](\w+)["']/)
  if (inlineCheck) {
    return `role === "${inlineCheck[1]}"`
  }

  // Look for role in conditions
  const conditionCheck = content.match(/if\s*\([^)]*role[^)]*\)\s*\{([^}]+)\}/s)
  if (conditionCheck) {
    return conditionCheck[1].trim()
  }

  return null
}

function extractHierarchy(roles: RoleDefinition[]): RoleHierarchy | undefined {
  // Try to infer hierarchy from role names
  const hierarchy: Record<string, number> = {}
  
  // Common hierarchy patterns
  const levelMap: Record<string, number> = {
    'admin': 3,
    'moderator': 2,
    'editor': 2,
    'user': 1,
    'viewer': 1,
    'guest': 0
  }

  roles.forEach(role => {
    if (levelMap[role.name.toLowerCase()]) {
      hierarchy[role.name] = levelMap[role.name.toLowerCase()]
    }
  })

  if (Object.keys(hierarchy).length === 0) {
    return undefined
  }

  return {
    levels: hierarchy
  }
}

