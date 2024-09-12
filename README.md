# Bugadocker

These GitHub Actions ease the use of Docker on Windows runners.
Basically, this should have been a feature of GitHub Actions, but [it is not](https://github.com/actions/runner/issues/904).
To overcome GitHub's limitations, these actions uses provides tools that make it a bit easier to run commands in a Docker.

The repository contains 2 actions: `run` and `exec`.
The former is used to start a container, while the latter is used to run commands in a container.

## Usage

### Basic Example

This is a basic example of a GitHub Workflow that uses this action (this assumes the runner has docker installed. If not, you can use the
[a 3rd-party action](https://github.com/crazy-max/ghaction-setup-docker) to install it):

```yaml
steps:
  - uses: bugale/bugadocker/run@v1
    with:
      image: mcr.microsoft.com/powershell
  - uses: bugale/bugadocker/exec@v1
    with:
      run: Write-Output "Hello, World!"
```

### Run Action

This action starts a container and sets up the environment for the `exec` action to run commands in it.
The action also has a post action that removes the created container at the end of the job.
This action supports mounting the workspace and temporary directory (`GITHUB_WORKSPACE` and `RUNNER_TEMP` environment variables) into the container.
It does so by default.
It also sets by default an environment variable (`BUGADOCKER_ID`) with the container's ID, so that the `exec` action can use it to run commands in the container.

#### Run's Input Parameters

- `image`: _(required)_ The image to use for the container.

- `args`: Free form arguments that are passed to the `docker run` command.

- `mount-workspaces`: True by default - mounts the `GITHUB_WORKSPACE` and `RUNNER_TEMP` directories into the container.
  This is done even if those directories are on a drive that doesn't exist in the container (e.g. `D:`), by clever usage of junctions.

- `set-container-id-env`: `BUGADOCKER_ID` by default - the name of an environment variable that will be set with the container's ID.
  Leave empty to not set any environment variable.

- `volumes`: Multiline string with the volumes to mount into the container.
  Each line should be a volume in the format `host-path:container-path[:options]`.
  The options are the same as the ones used in the `-v` argument of `docker run` command.

- `env`: Multiline string with the environment variables to set in the container.
  Each line should be an environment variable in the format `name=value` or just `name`.
  The options are the same as the ones used in the `-e` argument of `docker run` command.

- `ports`: Multiline string with the ports to expose from the container.
  Each line should be a port in the format `host-port:container-port[:protocol]`.
  The options are the same as the ones used in the `-p` argument of `docker run` command.

- `registry-username`: The username to use to login to the registry. Leave empty to not login.

- `registry-password`: The password to use to login to the registry. Leave empty to not login.

#### Run's Outputs

- `container-id`: The ID of the created container.

### Exec Action

This action runs commands in a container that was started by the `run` action.
It uses the `BUGADOCKER_ID` environment variable, by default, to know which container to run the commands in.
The action passes by default all of the `GITHUB_*`, `RUNNER_*`, and `CI` environment variables to the container.
It does NOT pass any other variables set using an `env:` block in the workflow. Those can be passed manually using raw `args` to the `docker exec` command.

This action attempts to be as close as possible to the `run` action, but it is not perfect.
Like the `run` action, it supports a `shell` parameter to specify which shell to use to run the commands (which is set to `pwsh` by default).
Unlike the `run` action, it does NOT automatically fallback to `powershell` if `pwsh` is not available.

Similar to the `run` action, if the shell is `pwsh` or `powershell`, the action will surround the given script with:

```powershell
$ErrorActionPreference = 'stop'
$PSNativeCommandUseErrorActionPreference = $true
...
if ((Test-Path -LiteralPath variable:\\LASTEXITCODE)) { exit $LASTEXITCODE }
```

To avoid this, pass a full command line with `{0}` as a placeholder for the script to run in `shell` (e.g. `powershell -File "{0}"`).

The action will set the working directory in the container to the one set for this action (using `steps.<step_id>.working-directory`).

#### Exec's Input Parameters

- `run`: _(required)_ The command to run in the container.

- `args`: Free form arguments that are passed to the `docker exec` command.

- `container`: the name of the environment variable that contains the container's ID.

- `container-env`: `BUGADOCKER_ID` by default - the name of the environment variable that contains the container's ID.

- `shell`: `pwsh` by default - the shell to use to run the commands.
  Similar to the `run` action, this can be set to a full command line with `{0}` as a placeholder for the script to run (e.g. `powershell -File "{0}"`).

- `pass-gh-env`: True by default - pass all of the `GITHUB_*` and `RUNNER_*` environment variables to the container.
