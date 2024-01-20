import * as core from '@actions/core'
import fs from 'node:fs'
import { parse } from 'jsonc-parser'

interface ManifestJSONC {
  packages: Map<string, ManifestPackage>
}

interface ManifestPackage {
  files: string[]
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

try {
  const manifestFileList = fs
    .readdirSync('.', { recursive: true })
    .filter(file => file.includes('manifest.x86_64.jsonc'))

  const allFiles = new Map<string, string[]>()
  const conflicts = new Map<string, string[]>()

  manifestFileList.forEach(manifestFile => {
    const manifestContent = fs.readFileSync(manifestFile)
    const manifestContentParsed: ManifestJSONC = parse(
      manifestContent.toString()
    )

    // well it's a map already, but node says
    // pkgs.forEach is not a function
    const pkgs = new Map<string, ManifestPackage>(
      Object.entries(manifestContentParsed.packages)
    )

    // const pkgs = manifestContentParsed.packages
    pkgs.forEach((value, key) => {
      value.files.forEach(filepath => {
        const tempPkgs = allFiles.get(filepath)
        if (tempPkgs === undefined) {
          allFiles.set(filepath, [key])
        } else {
          tempPkgs.push(key)
          allFiles.set(filepath, tempPkgs)
        }
      })
    })
  })

  allFiles.forEach((value, key) => {
    if (value.length > 1) {
      conflicts.set(key, value)
    }
  })

  let output: string
  if (conflicts.size > 1) {
    output = `${conflicts.size} duplicates detected:`
    conflicts.forEach((value, key) => {
      output = output.concat('\n', `  - File: ${key}\n    Packages:`)
      value.forEach(value => {
        output = output.concat('\n', `      - ${value}`)
      })
    })
    // console.log(output)
    core.setOutput('packages', output)
    core.setFailed(output)
  } else {
    console.log('No conflicts detected!')
  }
} catch (error) {
  core.setFailed(getErrorMessage(error))
}
