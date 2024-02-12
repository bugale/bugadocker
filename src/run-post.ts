import { exec } from '@actions/exec'
import { setFailed, getState } from '@actions/core'

export async function run(): Promise<void> {
  try {
    const containerId: string = getState('container-id')
    if (containerId === '') {
      return
    }
    await exec(`docker rm -f ${containerId}`)
  } catch (err) {
    if (err instanceof Error) {
      setFailed(err.message)
    }
  }
}

void run().finally((): void => {})
