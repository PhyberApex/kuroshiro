import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * Regression guard for https://github.com/PhyberApex/kuroshiro/issues/1187
 *
 * Nest resolves an undecorated constructor parameter from the class the
 * compiler emits in `design:paramtypes`. A type-only import is erased, the
 * emitted type becomes `Object`, and the application crashes at boot with an
 * unresolvable dependency.
 *
 * Unit tests construct providers by hand, so the crash is invisible to them.
 * This spec statically scans the API source tree so a type-only import of an
 * injected provider fails CI instead of crashing the container.
 */

const SRC_ROOT = join(import.meta.dirname, '..')
const PROVIDER_DECORATORS = new Set(['Injectable', 'Controller'])

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry)
    if (statSync(fullPath).isDirectory())
      return entry === '__test__' || entry === 'node_modules' ? [] : collectSourceFiles(fullPath)
    return entry.endsWith('.ts') && !entry.endsWith('.spec.ts') ? [fullPath] : []
  })
}

function decoratorNames(node: ts.Node): string[] {
  if (!ts.canHaveDecorators(node))
    return []
  return (ts.getDecorators(node) ?? []).flatMap((decorator) => {
    const callee = ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression
    return ts.isIdentifier(callee) ? [callee.text] : []
  })
}

function typeOnlyImports(source: ts.SourceFile): Set<string> {
  const names = source.statements
    .filter(ts.isImportDeclaration)
    .flatMap((declaration) => {
      const clause = declaration.importClause
      const bindings = clause?.namedBindings
      if (!clause || !bindings || !ts.isNamedImports(bindings))
        return []
      return bindings.elements
        .filter(element => clause.isTypeOnly || element.isTypeOnly)
        .map(element => element.name.text)
    })
  return new Set(names)
}

function typeOnlyInjections(source: ts.SourceFile): string[] {
  const erased = typeOnlyImports(source)
  return source.statements
    .filter(ts.isClassDeclaration)
    .filter(declaration => decoratorNames(declaration).some(name => PROVIDER_DECORATORS.has(name)))
    .flatMap((declaration) => {
      const constructor = declaration.members.find(ts.isConstructorDeclaration)
      return (constructor?.parameters ?? [])
        // A parameter decorator such as `@InjectRepository` names its own token.
        .filter(parameter => decoratorNames(parameter).length === 0)
        .flatMap((parameter) => {
          const type = parameter.type
          if (!type || !ts.isTypeReferenceNode(type) || !ts.isIdentifier(type.typeName))
            return []
          return erased.has(type.typeName.text)
            ? [`${declaration.name?.text}(${parameter.name.getText(source)}: ${type.typeName.text})`]
            : []
        })
    })
}

function scan(fileName: string, text: string): string[] {
  return typeOnlyInjections(ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true))
}

describe('injected providers are value imports', () => {
  it('flags a provider whose constructor parameter is imported as a type', () => {
    const offenders = scan('fixture.ts', `
      import type { ErasedService } from './erased.service.js'
      import { type InlineErasedService } from './inline.service.js'
      import type { Repository } from 'typeorm'
      import { Injectable } from '@nestjs/common'
      import { KeptService } from './kept.service.js'

      @Injectable()
      export class FixtureService {
        constructor(
          @InjectRepository(Thing) private readonly things: Repository<Thing>,
          private readonly kept: KeptService,
          private readonly erased: ErasedService,
          private readonly inlineErased: InlineErasedService,
        ) {}
      }
    `)

    expect(offenders).toEqual([
      'FixtureService(erased: ErasedService)',
      'FixtureService(inlineErased: InlineErasedService)',
    ])
  })

  it('ignores a class Nest does not construct', () => {
    const offenders = scan('fixture.ts', `
      import type { ErasedService } from './erased.service.js'

      export class HandBuilt {
        constructor(private readonly erased: ErasedService) {}
      }
    `)

    expect(offenders).toEqual([])
  })

  it('has no type-only import of an injected provider in the API source tree', () => {
    const offenders = collectSourceFiles(SRC_ROOT).flatMap(file =>
      scan(file, readFileSync(file, 'utf8')).map(offender => `${relative(SRC_ROOT, file)}: ${offender}`),
    )

    expect(
      offenders,
      `A type-only import is erased, so Nest cannot inject it and the app crashes at boot (issue #1187). Import the provider as a value. Offenders:\n${offenders.join('\n')}`,
    ).toEqual([])
  })
})
