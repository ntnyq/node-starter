import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const oxlintPath = fileURLToPath(
  new URL('../node_modules/oxlint/bin/oxlint', import.meta.url),
)
const tscPath = fileURLToPath(
  new URL('../node_modules/typescript/bin/tsc', import.meta.url),
)
const pluginPath = fileURLToPath(
  new URL('../scripts/oxlint.ts', import.meta.url),
)

it.each([
  {
    name: 'a block @ts-expect-error directive',
    source: '/** @ts-expect-error */\nexport const count: number = "invalid"\n',
  },
  {
    name: 'a block @ts-ignore directive',
    source: '/** @ts-ignore */\nexport const count: number = "invalid"\n',
  },
  {
    name: 'a preceding @ts-expect-error directive',
    source:
      '// @ts-expect-error\n/** Count. */ export const count: number = "invalid"\n',
  },
  {
    name: 'a preceding @ts-ignore directive',
    source:
      '// @ts-ignore\n/** Count. */ export const count: number = "invalid"\n',
  },
])('preserves type checking with $name during --fix', ({ source }) => {
  const directory = mkdtempSync(join(tmpdir(), 'node-starter-oxlint-'))
  const sourcePath = join(directory, 'constants.ts')
  const lintConfigPath = join(directory, 'oxlint.json')
  const tsconfigPath = join(directory, 'tsconfig.json')

  try {
    writeFileSync(sourcePath, source)
    writeFileSync(
      lintConfigPath,
      JSON.stringify({
        plugins: [],
        jsPlugins: [pluginPath],
        categories: { correctness: 'off' },
        rules: { 'local/require-top-level-jsdoc': 'error' },
      }),
    )
    writeFileSync(
      tsconfigPath,
      JSON.stringify({
        compilerOptions: {
          noEmit: true,
          skipLibCheck: true,
          strict: true,
          types: [],
          target: 'ESNext',
        },
        files: [sourcePath],
      }),
    )

    const before = spawnSync(process.execPath, [tscPath, '-p', tsconfigPath], {
      encoding: 'utf8',
    })
    expect({
      status: before.status,
      output: before.stdout + before.stderr,
    }).toEqual({
      status: 0,
      output: '',
    })

    const lint = spawnSync(
      process.execPath,
      [oxlintPath, '-c', lintConfigPath, '--fix', '--format=json', sourcePath],
      { encoding: 'utf8' },
    )
    expect(lint.status).toBe(1)
    expect(JSON.parse(lint.stdout)).toMatchObject({
      diagnostics: [
        {
          code: 'local(require-top-level-jsdoc)',
          message:
            'JSDoc comments on top-level declarations must use multiline format.',
        },
      ],
    })
    expect(readFileSync(sourcePath, 'utf8')).toBe(source)

    const after = spawnSync(process.execPath, [tscPath, '-p', tsconfigPath], {
      encoding: 'utf8',
    })
    expect({
      status: after.status,
      output: after.stdout + after.stderr,
    }).toEqual({
      status: 0,
      output: '',
    })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
