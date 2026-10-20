import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { $ } from 'execa'

import { precheck } from './precheck'
import { splitShares } from './split-shares'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const workdir = path.resolve(__dirname, '..')

async function main() {
  await precheck()
  // Pull photos tagged `share:...` out of the public manifest before the site is built.
  splitShares()
  await $({ cwd: workdir, stdio: 'inherit' })`vite build`
}

main()
