import { NextRequest, NextResponse } from 'next/server'
import { extractAuthSystem } from '@/lib/extractor/extractor'
import { generateAuthMemoryFile } from '@/lib/extractor/generator'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import AdmZip from 'adm-zip'

const execAsync = promisify(exec)

interface ProcessStep {
  step: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  message: string
  timestamp: number
}

export async function POST(request: NextRequest) {
  let tempDir: string | null = null
  const processSteps: ProcessStep[] = []

  const addStep = (step: string, status: ProcessStep['status'], message: string) => {
    processSteps.push({
      step,
      status,
      message,
      timestamp: Date.now()
    })
  }

  try {
    const contentType = request.headers.get('content-type') || ''
    
    // Check if it's a file upload (multipart/form-data) or JSON
    let repoUrl: string | null = null
    let uploadedFile: File | null = null
    
    if (contentType.includes('multipart/form-data')) {
      addStep('file_upload', 'in_progress', 'Receiving uploaded file...')
      const formData = await request.formData()
      uploadedFile = formData.get('file') as File | null
      
      if (!uploadedFile) {
        addStep('file_upload', 'failed', 'No file uploaded')
        return NextResponse.json(
          { error: 'No file uploaded', processSteps },
          { status: 400 }
        )
      }
      addStep('file_upload', 'completed', `File received: ${uploadedFile.name} (${(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)`)
    } else {
      const body = await request.json()
      repoUrl = body.repoUrl
      
      if (!repoUrl || typeof repoUrl !== 'string') {
        addStep('url_validation', 'failed', 'Repository URL is required')
        return NextResponse.json(
          { error: 'Repository URL is required', processSteps },
          { status: 400 }
        )
      }
      addStep('url_validation', 'completed', `Repository URL validated: ${repoUrl}`)
    }

    // Create temporary directory
    addStep('temp_directory', 'in_progress', 'Creating temporary directory...')
    tempDir = path.join(os.tmpdir(), `auth-extract-${Date.now()}-${Math.random().toString(36).substring(7)}`)
    fs.mkdirSync(tempDir, { recursive: true })
    
    if (!tempDir) {
      addStep('temp_directory', 'failed', 'Failed to create temporary directory')
      throw new Error('Failed to create temporary directory')
    }
    addStep('temp_directory', 'completed', `Temporary directory created: ${tempDir}`)

    const workingDir: string = tempDir

    try {
      // Handle file upload
      if (uploadedFile) {
        addStep('extract_zip', 'in_progress', 'Extracting uploaded zip file...')
        const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer())
        const zipPath = path.join(workingDir, 'uploaded.zip')
        fs.writeFileSync(zipPath, fileBuffer)
        
        const zip = new AdmZip(zipPath)
        zip.extractAllTo(workingDir, true)
        
        fs.unlinkSync(zipPath)
        addStep('extract_zip', 'completed', 'Zip file extracted successfully')
        
        // Move contents from subdirectory to tempDir root
        const extractedDirs = fs.readdirSync(workingDir).filter(item => {
          const fullPath = path.join(workingDir, item)
          return fs.statSync(fullPath).isDirectory()
        })
        
        if (extractedDirs.length === 1) {
          const extractedPath = path.join(workingDir, extractedDirs[0])
          const files = fs.readdirSync(extractedPath)
          files.forEach(file => {
            fs.renameSync(
              path.join(extractedPath, file),
              path.join(workingDir, file)
            )
          })
          fs.rmSync(extractedPath, { recursive: true, force: true })
        }
      } else if (repoUrl) {
        // Handle GitHub URL
        const githubRegex = /^https:\/\/github\.com\/([\w\-\.]+)\/([\w\-\.]+)(?:\.git)?$/
        const match = repoUrl.match(githubRegex)
        
        if (!match) {
          return NextResponse.json(
            { error: 'Invalid GitHub repository URL. Format: https://github.com/owner/repo' },
            { status: 400 }
          )
        }

        const [, owner, repo] = match

        // Try git clone first
        addStep('git_clone', 'in_progress', `Attempting to clone repository: ${repoUrl}`)
        try {
          await execAsync(`git clone --depth 1 ${repoUrl} ${workingDir}`, {
            timeout: 60000,
            maxBuffer: 10 * 1024 * 1024
          })
          addStep('git_clone', 'completed', 'Repository cloned successfully via git')
        } catch (gitError: any) {
          addStep('git_clone', 'failed', 'Git clone failed, trying zip download...')
          
          // Fallback: Get default branch from GitHub API
          addStep('fetch_branch', 'in_progress', 'Fetching default branch from GitHub API...')
          let defaultBranch = 'main'
          
          try {
            const repoInfoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
              headers: {
                'Accept': 'application/vnd.github.v3+json',
                ...(process.env.GITHUB_TOKEN && { 'Authorization': `token ${process.env.GITHUB_TOKEN}` })
              }
            })
            
            if (repoInfoResponse.ok) {
              const repoInfo = await repoInfoResponse.json()
              defaultBranch = repoInfo.default_branch || 'main'
              addStep('fetch_branch', 'completed', `Default branch detected: ${defaultBranch}`)
            } else {
              addStep('fetch_branch', 'failed', 'Could not fetch branch info, using "main" as fallback')
            }
          } catch (apiError) {
            addStep('fetch_branch', 'failed', 'Could not fetch default branch, using "main" as fallback')
          }

          // Download zip
          addStep('download_repo', 'in_progress', `Attempting to download repository as zip...`)
          const branchesToTry = Array.from(new Set([defaultBranch, 'main', 'master']))
          let downloaded = false
          const errors: string[] = []
          
          for (const branch of branchesToTry) {
            addStep('download_repo', 'in_progress', `Trying branch: ${branch}`)
            const urlFormats = [
              `https://github.com/${owner}/${repo}/archive/${branch}.zip`,
              `https://api.github.com/repos/${owner}/${repo}/zipball/${branch}`,
              `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`,
            ]
            
            let branchDownloaded = false
            
            for (const zipUrl of urlFormats) {
              try {
                const response = await fetch(zipUrl, {
                  redirect: 'follow',
                  headers: {
                    'Accept': 'application/vnd.github.v3+json, application/zip, application/octet-stream, */*',
                    'User-Agent': 'AuthExtractor/1.0',
                    ...(process.env.GITHUB_TOKEN && { 'Authorization': `token ${process.env.GITHUB_TOKEN}` })
                  }
                })
                
                if (!response.ok) {
                  const errorText = await response.text().catch(() => 'Could not read error response')
                  errors.push(`Branch ${branch} (${zipUrl}): ${response.status} ${response.statusText}`)
                  continue
                }
              
                const arrayBuffer = await response.arrayBuffer()
                
                if (arrayBuffer.byteLength === 0) {
                  errors.push(`Branch ${branch} (${zipUrl}): Downloaded file is empty`)
                  continue
                }
                
                // Check if it's a zip file
                const firstBytes = new Uint8Array(arrayBuffer.slice(0, 4))
                const isZipFile = firstBytes[0] === 0x50 && firstBytes[1] === 0x4B
                
                if (!isZipFile) {
                  errors.push(`Branch ${branch} (${zipUrl}): Response is not a zip file`)
                  continue
                }
                
                // Extract the zip
                addStep('extract_zip', 'in_progress', `Extracting downloaded zip file from branch: ${branch}`)
                const zip = new AdmZip(Buffer.from(arrayBuffer))
                zip.extractAllTo(workingDir, true)
                downloaded = true
                branchDownloaded = true
                addStep('download_repo', 'completed', `Successfully downloaded and extracted branch ${branch}`)
                addStep('extract_zip', 'completed', 'Zip file extracted successfully')
                break
              } catch (urlError: any) {
                const errorMsg = urlError.message || String(urlError)
                errors.push(`Branch ${branch} (${zipUrl}): ${errorMsg}`)
                continue
              }
            }
            
            if (branchDownloaded) {
              break
            }
          }
          
          if (!downloaded) {
            const errorDetails = errors.join('; ')
            throw new Error(`Failed to download repository. Tried branches: ${branchesToTry.join(', ')}. Details: ${errorDetails}`)
          }
          
          // Move contents from subdirectory to tempDir root
          const extractedDir = fs.readdirSync(workingDir).find(item => {
            const fullPath = path.join(workingDir, item)
            return fs.statSync(fullPath).isDirectory() && item.includes(repo)
          })
          
          if (extractedDir) {
            const extractedPath = path.join(workingDir, extractedDir)
            const files = fs.readdirSync(extractedPath)
            files.forEach(file => {
              fs.renameSync(
                path.join(extractedPath, file),
                path.join(workingDir, file)
              )
            })
            fs.rmSync(extractedPath, { recursive: true, force: true })
          }
        }
      }

      // Extract auth patterns
      addStep('extract_auth', 'in_progress', 'Analyzing codebase and extracting auth patterns...')
      const authMemory = await extractAuthSystem(workingDir)
      addStep('extract_auth', 'completed', `Auth patterns extracted: ${authMemory.authProvider.name}, ${authMemory.sessionStorage.strategy} sessions, ${authMemory.roleModel.roles.length} roles, ${authMemory.permissionChecks.apiGuards.length} API guards`)

      // Generate auth memory file content
      addStep('generate_file', 'in_progress', 'Generating auth memory file...')
      // Use a temporary path for generation
      const tempOutputPath = path.join(os.tmpdir(), `auth-memory-${Date.now()}.ts`)
      generateAuthMemoryFile(authMemory, tempOutputPath)
      const fileContent = fs.readFileSync(tempOutputPath, 'utf-8')
      fs.unlinkSync(tempOutputPath) // Clean up temp file
      addStep('generate_file', 'completed', 'Auth memory file generated successfully')

      // Clean up temp directory
      addStep('cleanup', 'in_progress', 'Cleaning up temporary files...')
      if (fs.existsSync(workingDir)) {
        fs.rmSync(workingDir, { recursive: true, force: true })
      }
      addStep('cleanup', 'completed', 'Cleanup completed')

      return NextResponse.json({
        success: true,
        authMemory: fileContent,
        authMemoryData: authMemory,
        metadata: {
          authProvider: authMemory.authProvider.name,
          sessionStrategy: authMemory.sessionStorage.strategy,
          roles: authMemory.roleModel.roles.length,
          permissions: authMemory.roleModel.permissions.length,
          middleware: authMemory.permissionChecks.middleware.length,
          protectedRoutes: authMemory.permissionChecks.protectedRoutes.length,
          apiGuards: authMemory.permissionChecks.apiGuards.length
        },
        processSteps
      })
    } catch (error: any) {
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
      throw error
    }
  } catch (error: any) {
    console.error('Extraction error:', error)
    addStep('error', 'failed', error.message || 'Failed to extract auth patterns')
    return NextResponse.json(
      { error: error.message || 'Failed to extract auth patterns', processSteps },
      { status: 500 }
    )
  }
}


