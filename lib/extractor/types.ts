export interface AuthMemory {
  metadata: {
    projectName: string
    extractedAt: string
    framework: string
    sourcePath: string
  }
  
  authProvider: {
    type: 'next-auth' | 'firebase' | 'cognito' | 'custom' | 'oauth' | 'magic-link' | 'unknown'
    name: string
    configuration: AuthProviderConfig
    implementation: AuthProviderImplementation
    callbacks?: CallbackPattern[]
  }
  
  sessionStorage: {
    strategy: 'jwt' | 'database' | 'cookie' | 'localStorage' | 'hybrid'
    configuration: SessionStorageConfig
    lifetime: SessionLifetime
    implementation: SessionStorageImplementation
  }
  
  tokenStrategy: {
    accessToken: TokenConfig
    refreshToken?: TokenConfig
    refreshStrategy: RefreshStrategy
    implementation: TokenStrategyImplementation
  }
  
  roleModel: {
    roles: RoleDefinition[]
    permissions: PermissionDefinition[]
    implementation: RoleModelImplementation
    hierarchy?: RoleHierarchy
  }
  
  permissionChecks: {
    middleware: MiddlewarePattern[]
    protectedRoutes: ProtectedRoute[]
    apiGuards: APIGuard[]
    componentGuards?: ComponentGuard[]
  }
  
  utilities: {
    authHelpers?: string[]
    commonHooks?: string[]
    authFunctions?: string[]
  }
  
  instructions: {
    setup: string[]
    usage: string[]
    security: string[]
  }
}

export interface AuthProviderConfig {
  providers: string[]
  adapter?: string
  secret?: string
  callbacks?: string[]
  [key: string]: any
}

export interface AuthProviderImplementation {
  filePath: string
  template: string
  setup: string
  usage: string
}

export interface CallbackPattern {
  name: 'session' | 'jwt' | 'signIn' | 'redirect'
  implementation: string
  filePath: string
}

export interface SessionStorageConfig {
  type: string
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
  domain?: string
  path?: string
  maxAge?: number
}

export interface SessionLifetime {
  accessToken: number // seconds
  refreshToken?: number // seconds
  session?: number // seconds
  idleTimeout?: number // seconds
}

export interface SessionStorageImplementation {
  filePath: string
  template: string
  storageLocation: string
}

export interface TokenConfig {
  lifetime: number // seconds
  storage: 'cookie' | 'localStorage' | 'memory' | 'httpOnly'
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
}

export interface RefreshStrategy {
  type: 'automatic' | 'manual' | 'rotation' | 'none'
  trigger: 'before-expiry' | 'on-demand' | 'interval'
  interval?: number // seconds
  implementation: string
  filePath?: string
}

export interface TokenStrategyImplementation {
  filePath: string
  template: string
  refreshLogic?: string
}

export interface RoleDefinition {
  name: string
  permissions: string[]
  description?: string
  level?: number
}

export interface PermissionDefinition {
  name: string
  description?: string
  resource?: string
  action?: string
}

export interface RoleModelImplementation {
  filePath: string
  template: string
  checkPattern: string
}

export interface RoleHierarchy {
  levels: Record<string, number>
  inheritance?: Record<string, string[]>
}

export interface MiddlewarePattern {
  name: string
  type: 'route' | 'api' | 'global'
  filePath: string
  template: string
  location: string
  checks: string[]
}

export interface ProtectedRoute {
  path: string
  method?: string
  protection: 'auth' | 'role' | 'permission' | 'custom'
  requiredRole?: string
  requiredPermission?: string
  implementation: string
}

export interface APIGuard {
  endpoint: string
  method: string
  protection: 'auth' | 'role' | 'permission' | 'custom'
  middleware?: string
  filePath: string
  template: string
}

export interface ComponentGuard {
  component: string
  protection: 'auth' | 'role' | 'permission'
  requiredRole?: string
  requiredPermission?: string
  filePath: string
  template: string
}

