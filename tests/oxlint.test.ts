import { RuleTester } from 'oxlint/plugins-dev'
import { describe, it } from 'vitest'
import { requireTopLevelJsdoc } from '../scripts/oxlint'

RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
})

ruleTester.run('require-top-level-jsdoc', requireTopLevelJsdoc, {
  valid: [
    ...[
      '@sealed\nexport class Client {}',
      'export @sealed class Client {}',
      '@sealed\nexport default class Client {}',
      'export default @sealed class Client {}',
      '@first\n@second\nexport class Client {}',
    ].map(code => ({
      name: 'finds documentation before decorators: ' + code,
      code: '/**\n * Client.\n */\n' + code,
    })),
    ...[
      '{ enabled: true } as const',
      '{ enabled: true } satisfies { enabled: boolean }',
      '({ enabled: true } as const) satisfies { enabled: boolean }',
      '<{ enabled: boolean }>{ enabled: true }',
      '({ enabled: true } as const)!',
      '((input: string) => input) satisfies ((input: string) => string)',
      '(class Client {}) as unknown',
    ].map(expression => ({
      name: 'documented wrapped default export: ' + expression,
      code: '/**\n * Default export.\n */\nexport default ' + expression,
    })),
    {
      name: 'a type assertion around an exported reference is still a reference',
      code: 'import { options } from "./options"; export default options as Options',
    },
    {
      name: 'file metadata does not hide a separate declaration comment',
      code: '/** @file Options. */\n/** @license MIT */\n\n/**\n * Default options.\n */\nexport const options = {}',
    },
    {
      name: 'a declaration can mention file tags and include its own license',
      code: '/**\n * Explains the @file tag.\n * @license MIT\n */\nexport const options = {}',
    },
    {
      name: 'documented private declarations',
      code: `
        /**
         * Default timeout.
         */
        const timeout = 1000
        /**
         * Input options.
         */
        interface Options { timeout: number }
      `,
    },
    {
      name: 'documentation before export keywords',
      code: `
        /**
         * Default options.
         */
        export const options = { enabled: true }
        /**
         * Input options.
         */
        export interface Options { enabled: boolean }
        /**
         * Mode.
         */
        export type Mode = 'on' | 'off'
        /**
         * Available levels.
         */
        export enum Level { Low, High }
        /**
         * Client.
         */
        export class Client {}
        /**
         * Returns the input.
         */
        export function identity(input: string) { return input }
        /**
         * Returns the input.
         */
        export const arrow = (input: string) => input
      `,
    },
    {
      name: 'anonymous default exports',
      code: '/**\n * Default options.\n */\nexport default { enabled: true }',
    },
    {
      name: 'default function export',
      code: '/**\n * Creates an identifier.\n */\nexport default function () { return 1 }',
    },
    {
      name: 'default arrow export',
      code: '/**\n * Creates an identifier.\n */\nexport default () => 1',
    },
    {
      name: 'default class export',
      code: '/**\n * Client.\n */\nexport default class {}',
    },
    {
      name: 'ambient declarations and namespaces',
      code: `
        /**
         * Client factory.
         */
        declare function createClient(): void
        /**
         * Default timeout.
         */
        declare const timeout: number
        /**
         * Client types.
         */
        namespace Client { export interface Options {} }
      `,
    },
    {
      name: 'nested declarations and object members',
      code: `
        /**
         * Creates a client.
         */
        export function createClient() {
          /** Local options. */
          const options = {}
          function connect() { return options }
          return { connect }
        }
        /**
         * Client.
         */
        class Client { connect() {} }
        /**
         * Default options.
         */
        const options = { enabled: true, connect() {} }
      `,
    },
    {
      name: 'imports, re-exports, references and executable statements',
      code: `
        import { options } from './options'
        export { options }
        export type { Options } from './types'
        export * from './other'
        export default options
        console.log(options)
      `,
    },
    {
      name: 'a file header separated from imports does not affect documented declarations',
      code: `
        /** @license MIT */
        import { options } from './options'
        /**
         * Returns the default options.
         */
        export function getOptions() { return options }
      `,
    },
  ],
  invalid: [
    ...['expect-error', 'ignore', 'check', 'nocheck'].flatMap(directive => [
      {
        name: 'does not rewrite a block TypeScript directive: ' + directive,
        code:
          '/** @ts-' +
          directive +
          ' */\nexport const count: number = "invalid"',
        output: null,
        errors: [{ messageId: 'singleLineJsdoc' }],
      },
      {
        name:
          'does not displace a preceding TypeScript directive: ' + directive,
        code:
          '// @ts-' +
          directive +
          '\n/** Count. */ export const count: number = "invalid"',
        output: null,
        errors: [{ messageId: 'singleLineJsdoc' }],
      },
      {
        name:
          'does not displace a following TypeScript directive: ' + directive,
        code:
          '/** Count. */\n// @ts-' +
          directive +
          '\nexport const count: number = "invalid"',
        output: null,
        errors: [{ messageId: 'singleLineJsdoc' }],
      },
    ]),
    ...[
      '@sealed\nexport class Client {}',
      'export @sealed class Client {}',
      '@sealed\nexport default class Client {}',
      'export default @sealed class Client {}',
      '@first\n@second\nexport class Client {}',
    ].flatMap(code => [
      {
        name: 'undocumented decorated class: ' + code,
        code,
        output: null,
        errors: [{ messageId: 'missingJsdoc' }],
      },
      {
        name: 'fixes documentation before decorators: ' + code,
        code: '/** Client. */\n' + code,
        output: '/**\n * Client.\n */\n' + code,
        errors: [{ messageId: 'singleLineJsdoc' }],
      },
    ]),
    ...[
      '{ enabled: true } as const',
      '{ enabled: true } satisfies { enabled: boolean }',
      '({ enabled: true } as const) satisfies { enabled: boolean }',
      '<{ enabled: boolean }>{ enabled: true }',
      '({ enabled: true } as const)!',
      '((input: string) => input) satisfies ((input: string) => string)',
      '(class Client {}) as unknown',
    ].flatMap(expression => [
      {
        name: 'undocumented wrapped default export: ' + expression,
        code: 'export default ' + expression,
        output: null,
        errors: [{ messageId: 'missingJsdoc' }],
      },
      {
        name: 'fixes a comment on a wrapped default export: ' + expression,
        code: '/** Default export. */\nexport default ' + expression,
        output: '/**\n * Default export.\n */\nexport default ' + expression,
        errors: [{ messageId: 'singleLineJsdoc' }],
      },
    ]),
    ...[
      'file',
      'fileoverview',
      'overview',
      'license',
      'preserve',
      'copyright',
    ].flatMap(tag => [
      {
        name:
          'a single-line file header is not declaration documentation: ' + tag,
        code: '/** @' + tag + ' Options. */\n\nexport const options = {}',
        output: null,
        errors: [{ messageId: 'missingJsdoc' }],
      },
      {
        name:
          'a multiline file header is not declaration documentation: ' + tag,
        code: '/**\n * @' + tag + ' Options.\n */\n\nexport const options = {}',
        output: null,
        errors: [{ messageId: 'missingJsdoc' }],
      },
    ]),
    {
      name: 'an unrelated earlier directive does not prevent safe fixes',
      code: '// @ts-expect-error\n/**\n * Invalid input.\n */\nexport const wrong: number = "invalid"\n/** Default options. */\nexport const options = {}',
      output:
        '// @ts-expect-error\n/**\n * Invalid input.\n */\nexport const wrong: number = "invalid"\n/**\n * Default options.\n */\nexport const options = {}',
      errors: [{ messageId: 'singleLineJsdoc' }],
    },
    ...[
      'const options = {}',
      'export const options = {}',
      'export interface Options {}',
      'export type Mode = "on" | "off"',
      'export function createClient() {}',
      'export default { enabled: true }',
      'export default () => 1',
      'export default class {}',
    ].map(code => ({
      code: '/** Description. */\n' + code,
      output: '/**\n * Description.\n */\n' + code,
      errors: [{ messageId: 'singleLineJsdoc' }],
    })),
    {
      name: 'preserves space indentation',
      code: '  /** Default options. */\n  export const options = {}',
      output:
        '  /**\n   * Default options.\n   */\n  export const options = {}',
      errors: [{ messageId: 'singleLineJsdoc' }],
    },
    {
      name: 'preserves tab indentation',
      code: '\t/** Default options. */\n\texport const options = {}',
      output:
        '\t/**\n\t * Default options.\n\t */\n\texport const options = {}',
      errors: [{ messageId: 'singleLineJsdoc' }],
    },
    {
      name: 'preserves CRLF line endings',
      code: '/** Default options. */\r\nexport const options = {}\r\n',
      output:
        '/**\r\n * Default options.\r\n */\r\nexport const options = {}\r\n',
      errors: [{ messageId: 'singleLineJsdoc' }],
    },
    {
      name: 'preserves Unicode and JSDoc tags',
      code: '/** @returns 原始输入，包括 `@` 和 * 符号。 */\nexport function identity() {}',
      output:
        '/**\n * @returns 原始输入，包括 `@` 和 * 符号。\n */\nexport function identity() {}',
      errors: [{ messageId: 'singleLineJsdoc' }],
    },
    {
      name: 'moves same-line declarations below the closing delimiter',
      code: '/** Default options. */ export const options = {}',
      output: '/**\n * Default options.\n */\nexport const options = {}',
      errors: [{ messageId: 'singleLineJsdoc' }],
    },
    {
      name: 'moves same-line declarations without intervening whitespace',
      code: '/** Default options. */export const options = {}',
      output: '/**\n * Default options.\n */\nexport const options = {}',
      errors: [{ messageId: 'singleLineJsdoc' }],
    },
    {
      name: 'fixes empty comments without inventing documentation',
      code: '/** */\nexport const options = {}',
      output: '/**\n *\n */\nexport const options = {}',
      errors: [{ messageId: 'singleLineJsdoc' }],
    },
    {
      name: 'fixes multiple comments once each',
      code: '/** First. */\nexport const first = 1\n/** Second. */\nexport const second = 2',
      output:
        '/**\n * First.\n */\nexport const first = 1\n/**\n * Second.\n */\nexport const second = 2',
      errors: [
        { messageId: 'singleLineJsdoc' },
        { messageId: 'singleLineJsdoc' },
      ],
    },
    {
      name: 'checks the closest attached JSDoc comment',
      code: '/**\n * Earlier description.\n */\n/** Current description. */\nexport const options = {}',
      output:
        '/**\n * Earlier description.\n */\n/**\n * Current description.\n */\nexport const options = {}',
      errors: [{ messageId: 'singleLineJsdoc' }],
    },
    ...[
      'const options = { enabled: true }',
      'const timeout = 1000',
      'let timeout = 1000',
      'var timeout = 1000',
      'const { timeout } = options',
      'function identity(input: string) { return input }',
      'const identity = (input: string) => input',
      'class Client {}',
      'interface Options {}',
      "type Mode = 'on' | 'off'",
      'enum Level { Low, High }',
      'declare function createClient(): void',
      'namespace Client { export interface Options {} }',
      'export const options = { enabled: true }',
      'export function identity(input: string) { return input }',
      'export interface Options {}',
      'export default function () {}',
      'export default class {}',
      'export default () => 1',
      'export default { enabled: true }',
      '// Options.\nexport const options = {}',
      '/* Options. */\nexport const options = {}',
      '/**\n * First option.\n */\nconst first = 1\nconst second = 2',
      '/**\n * First option.\n */\nconst first = 1 /** Trailing comment. */\nconst second = 2',
      '/** @license MIT */\nimport { options } from "./options"\nexport const defaults = options',
    ].map(code => ({
      code,
      errors: [{ messageId: 'missingJsdoc' }],
    })),
    {
      name: 'reports each undocumented declaration once',
      code: 'export const options = {}; export function createClient() {}',
      errors: [{ messageId: 'missingJsdoc' }, { messageId: 'missingJsdoc' }],
    },
  ],
})
