import { existsSync, mkdirSync, rmSync, mkdtempSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { exec, type ExecOptions } from '@actions/exec'
import { getInput, getMultilineInput, getBooleanInput, setOutput, exportVariable, setFailed, saveState } from '@actions/core'

async function setupMount(path: string): Promise<string[]> {
  if (path.startsWith('C:\\')) {
    return [`-v ${path}:${path}`]
  }
  if (process.env.RUNNER_TEMP === undefined) {
    throw new Error('RUNNER_TEMP is not defined')
  }
  const drive = path[0]
  const drivePath = `${process.env.RUNNER_TEMP}\\bugadocker\\${drive}`
  const linkPath = `${drivePath}\\${path.substring(3)}`
  const linkTarget = mkdtempSync(join(tmpdir(), 'bugadocker-'))
  if (!existsSync(linkPath)) {
    mkdirSync(linkPath, { recursive: true })
    rmSync(linkPath, { recursive: true, force: true })
    await exec('cmd', ['/c', `mklink /J ${linkPath} ${linkTarget}`])
  }
  return [`-v ${drivePath}:${drive}:`, `-v ${path}:${linkTarget}`]
}

export async function run(): Promise<void> {
  try {
    const image: string = getInput('image', { required: true })
    const options: string[] = getMultilineInput('options')
    const mountWorkspaces: boolean = getBooleanInput('mount-workspaces')
    const setContainerIdEnv: string = getInput('set-container-id-env')
    const volumes: string[] = getMultilineInput('volumes')
    const env: string[] = getMultilineInput('env')
    const ports: string[] = getMultilineInput('ports')
    const registryUsername: string = getInput('registry-username')
    const registryPassword: string = getInput('registry-password')

    let stdout = ''

    if (registryUsername !== '' && registryPassword !== '') {
      const server = image.split('/')[0]
      await exec('docker', ['login', server, '--username', registryUsername, '--password-stdin'], { input: Buffer.from(registryPassword) })
    }

    const execOptions: ExecOptions = {}
    execOptions.listeners = {
      stdout: (data: Buffer) => {
        stdout += data.toString()
      }
    }

    if (mountWorkspaces) {
      const workspace = process.env.GITHUB_WORKSPACE
      const workspaceTemp = process.env.RUNNER_TEMP
      if (workspace === undefined || workspaceTemp === undefined) {
        throw new Error('GITHUB_WORKSPACE and/or RUNNER_TEMP are not defined')
      }
      for (const mount of new Set<string>([...(await setupMount(workspace)), ...(await setupMount(workspaceTemp))])) {
        options.push(mount)
      }
    }
    for (const volume of volumes) {
      options.push(`-v ${volume}`)
    }
    for (const e of env) {
      options.push(`-e ${e}`)
    }
    for (const port of ports) {
      options.push(`-p ${port}`)
    }

    await exec(`docker run --rm -td ${options.join(' ')} ${image} cmd`, [], execOptions)
    saveState('container-id', stdout.trim())
    if (setContainerIdEnv !== '') {
      exportVariable(setContainerIdEnv, stdout.trim())
    }
    setOutput('container-id', stdout.trim())
  } catch (err) {
    if (err instanceof Error) {
      setFailed(err.message)
    }
  }
}

void run().finally((): void => {})
