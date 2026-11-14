import ts from 'typescript'

/**
 * Message IDs used by the interface: the literal first argument of every
 * `t('…')` / `msg('…')` call in a file that imports them from `i18n/core`.
 * Used by the catalogue completeness test and `npm run i18n:extract`; never
 * bundled into the application.
 */
export function extractMessages(
  sources: Readonly<Record<string, string>>,
): Map<string, string[]> {
  const messages = new Map<string, string[]>()
  for (const [file, text] of Object.entries(sources)) {
    if (!/i18n\/core['"]/.test(text)) continue
    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )
    const names = new Set<string>()
    for (const statement of source.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        !/i18n\/core$/.test(statement.moduleSpecifier.text)
      )
        continue
      const bindings = statement.importClause?.namedBindings
      if (bindings && ts.isNamedImports(bindings))
        for (const element of bindings.elements) {
          const imported = (element.propertyName ?? element.name).text
          if (imported === 't' || imported === 'msg')
            names.add(element.name.text)
        }
    }
    // core.ts itself defines t/msg.
    if (/\/i18n\/core\.ts$/.test(file)) continue
    if (!names.size) continue
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        names.has(node.expression.text)
      ) {
        const first = node.arguments[0]
        if (
          first &&
          (ts.isStringLiteral(first) ||
            ts.isNoSubstitutionTemplateLiteral(first))
        ) {
          const line =
            source.getLineAndCharacterOfPosition(first.getStart(source)).line +
            1
          const where = `${file}:${line}`
          const list = messages.get(first.text)
          if (list) list.push(where)
          else messages.set(first.text, [where])
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return messages
}

/** `{name}` placeholders of a message, sorted and de-duplicated. */
export function placeholders(message: string): string[] {
  return [...new Set([...message.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!))]
    .filter(Boolean)
    .sort()
}
