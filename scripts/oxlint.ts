import type { RuleTester } from 'oxlint/plugins-dev'

type OxlintRule = Parameters<RuleTester['run']>[1]

const DECLARATION_TYPES = new Set([
  'VariableDeclaration',
  'FunctionDeclaration',
  'ClassDeclaration',
  'TSInterfaceDeclaration',
  'TSTypeAliasDeclaration',
  'TSEnumDeclaration',
  'TSDeclareFunction',
  'TSModuleDeclaration',
])

const DEFAULT_EXPORT_TYPES = new Set([
  'ArrowFunctionExpression',
  'FunctionExpression',
  'ClassExpression',
  'ObjectExpression',
])

/**
 * Distinguishes file headers from documentation belonging to a declaration.
 */
function isFileJsdoc(value: string): boolean {
  const content = value
    .slice(1)
    .replace(/^[\t ]*\* ?/gmu, '')
    .trim()

  return (
    /^@(?:file|fileoverview|overview)\b/imu.test(content) ||
    (/^@(?:license|copyright|preserve)\b/iu.test(content) &&
      !/^@(?!(?:license|copyright|preserve)\b)[\w-]+/imu.test(content))
  )
}

/**
 * Requires multiline JSDoc on module-level declarations, including private declarations.
 * File selection belongs to the Oxlint configuration.
 */
export const requireTopLevelJsdoc: OxlintRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require multiline JSDoc comments on top-level declarations.',
    },
    fixable: 'whitespace',
    schema: [],
    messages: {
      missingJsdoc: 'Top-level declarations must have a JSDoc comment.',
      singleLineJsdoc:
        'JSDoc comments on top-level declarations must use multiline format.',
    },
  },
  create(context) {
    const { sourceCode } = context

    return {
      Program(program) {
        for (const statement of program.body) {
          const isDefaultExport = statement.type === 'ExportDefaultDeclaration'
          const originalDeclaration =
            statement.type === 'ExportNamedDeclaration' || isDefaultExport
              ? statement.declaration
              : statement

          if (!originalDeclaration) {
            continue
          }

          let declaration = originalDeclaration
          while (
            declaration.type === 'TSAsExpression' ||
            declaration.type === 'TSSatisfiesExpression' ||
            declaration.type === 'TSTypeAssertion' ||
            declaration.type === 'TSNonNullExpression' ||
            declaration.type === 'TSInstantiationExpression' ||
            declaration.type === 'ParenthesizedExpression'
          ) {
            declaration = declaration.expression
          }

          if (
            !DECLARATION_TYPES.has(declaration.type) &&
            !(isDefaultExport && DEFAULT_EXPORT_TYPES.has(declaration.type))
          ) {
            continue
          }

          // Decorators can precede the export keyword and own the leading comments.
          const decorators =
            'decorators' in declaration ? declaration.decorators : []
          const comments = [
            ...decorators,
            statement,
            originalDeclaration,
            declaration,
          ]
            .flatMap(node => sourceCode.getCommentsBefore(node))
            .toSorted((left, right) => left.range[0] - right.range[0])
          const jsdoc = comments.findLast(comment => {
            if (
              comment.type !== 'Block' ||
              !comment.value.startsWith('*') ||
              isFileJsdoc(comment.value)
            ) {
              return false
            }

            // A trailing comment on the preceding statement documents that statement.
            const previousToken = sourceCode.getTokenBefore(comment)
            return (
              !previousToken ||
              previousToken.loc.end.line < comment.loc.start.line
            )
          })

          if (!jsdoc) {
            context.report({ node: declaration, messageId: 'missingJsdoc' })
            continue
          }

          if (jsdoc.loc.start.line === jsdoc.loc.end.line) {
            context.report({
              loc: jsdoc.loc,
              messageId: 'singleLineJsdoc',
              fix(fixer) {
                // Adding line breaks can invalidate TypeScript's line-sensitive directives.
                if (
                  comments.some(comment =>
                    /@ts-(?:expect-error|ignore|check|nocheck)\b/u.test(
                      comment.value,
                    ),
                  )
                ) {
                  return null
                }

                const lineStart =
                  sourceCode.text.lastIndexOf('\n', jsdoc.range[0] - 1) + 1
                const indentation =
                  sourceCode.text
                    .slice(lineStart, jsdoc.range[0])
                    .match(/^[\t ]*/u)?.[0] ?? ''
                const newline = sourceCode.text.match(/\r\n|\n/u)?.[0] ?? '\n'
                const content = jsdoc.value.slice(1).trim()
                let replacement = [
                  '/**',
                  indentation + ' *' + (content ? ' ' + content : ''),
                  indentation + ' */',
                ].join(newline)
                let end = jsdoc.range[1]

                // Move same-line code after the comment onto its own line.
                const inlineWhitespace = sourceCode.text
                  .slice(end)
                  .match(/^[\t ]*(?=\S)/u)?.[0]
                if (inlineWhitespace !== undefined) {
                  end += inlineWhitespace.length
                  replacement += newline + indentation
                }

                return fixer.replaceTextRange(
                  [jsdoc.range[0], end],
                  replacement,
                )
              },
            })
          }
        }
      },
    }
  },
}

const plugin: {
  meta: { name: string }
  rules: Record<string, OxlintRule>
} = {
  meta: { name: 'local' },
  rules: {
    'require-top-level-jsdoc': requireTopLevelJsdoc,
  },
}

export default plugin
