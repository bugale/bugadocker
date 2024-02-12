import { existsSync, mkdirSync, rmSync, mkdtempSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { exec, type ExecOptions } from '@actions/exec'
import { getInput, getMultilineInput, getBooleanInput, setOutput, exportVariable, setFailed, saveState } from '@actions/core'

async function setupMount(path: string): Promise<string[]> {
  if (path.startsWith('C:\\')) {
    return [`--mount type=bind,src=${path},dst=${path}`]
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
  return [`--mount type=bind,src=${drivePath},dst=${drive}:`, `--mount type=bind,src=${path},dst=${linkTarget}`]
}

export async function run(): Promise<void> {
  try {
    const image: string = getInput('image', { required: true })
    const options: string[] = getMultilineInput('options')
    const mountWorkspaces: boolean = getBooleanInput('mount-workspaces')
    const setContainerIdEnv: string = getInput('set-container-id-env')

    let stdout = ''

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
