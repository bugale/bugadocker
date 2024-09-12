import { writeFileSync } from 'fs'
import { v4 } from 'uuid'
import { exec } from '@actions/exec'
import { getInput, getMultilineInput, getBooleanInput, setFailed } from '@actions/core'

export async function run(): Promise<void> {
  try {
    const run_: string[] = getMultilineInput('run', { required: true })
    const options: string[] = getMultilineInput('options')
    let container: string = getInput('container')
    const containerEnv: string = getInput('container-env')
    let shell: string = getInput('shell')
    const passGhEnv: boolean = getBooleanInput('pass-gh-env')

    if (container === '') {
      container = process.env[containerEnv] ?? ''
    }
    if (container === '') {
      throw new Error('container is not defined')
    }

    if (shell === 'powershell' || shell === 'pwsh') {
      run_.unshift("$ErrorActionPreference = 'stop'")
      run_.unshift('$PSNativeCommandUseErrorActionPreference = $true')
      run_.push('if ((Test-Path -LiteralPath variable:\\LASTEXITCODE)) { exit $LASTEXITCODE }')
    }

    const shellInvocations: Record<string, string> = {
      powershell: 'powershell -command ". \'{0}\'"',
      pwsh: 'pwsh -command ". \'{0}\'"',
      cmd: 'cmd /D /E:ON /V:OFF /S /C "CALL "{0}""',
      python: 'python {0}'
    }
    shell = shellInvocations[shell] ?? shell

    const extensions: Record<string, string> = { powershell: '.ps1', pwsh: '.ps1', cmd: '.cmd', python: '.py' }
    const extension = extensions[shell.split(' ')[0]] ?? ''
    const scriptPath = `${process.env.RUNNER_TEMP}\\bugadocker-${v4()}${extension}`
    writeFileSync(scriptPath, run_.join('\n'))

    options.push(`-w "${process.cwd()}"`)
    if (passGhEnv) {
      for (const key in process.env) {
        if (key.startsWith('GITHUB_') || key.startsWith('RUNNER_') || key === 'CI') {
          options.push(`-e ${key}`)
        }
      }
    }

    await exec(`docker exec ${options.join(' ')} ${container === '' ? process.env[containerEnv] : container} ${shell.replace('{0}', scriptPath)}`)
  } catch (err) {
    if (err instanceof Error) {
      setFailed(err.message)
    }
  }
}

void run().finally((): void => {})
