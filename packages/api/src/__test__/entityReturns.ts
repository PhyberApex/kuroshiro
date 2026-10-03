import { dirname } from 'node:path'
import ts from 'typescript'

const ROUTE_DECORATORS = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete', 'All', 'Head', 'Options'])
const ENTITY_DECORATORS = new Set(['Entity', 'ViewEntity', 'ChildEntity'])

export interface EntityReturn {
  /** `ControllerClass.method` */
  handler: string
  entities: string[]
}

function hasDecorator(node: ts.Node, names: Set<string>): boolean {
  if (!ts.canHaveDecorators(node))
    return false
  return (ts.getDecorators(node) ?? []).some((decorator) => {
    const callee = ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression
    return ts.isIdentifier(callee) && names.has(callee.text)
  })
}

function isOwnSource(declaration: ts.Declaration, program: ts.Program): boolean {
  const file = declaration.getSourceFile()
  return !program.isSourceFileFromExternalLibrary(file) && !program.isSourceFileDefaultLibrary(file)
}

/** Every `@Entity` class reachable from `type`: through promises, arrays, unions, generics and the properties of our own types. */
function entitiesIn(type: ts.Type, checker: ts.TypeChecker, program: ts.Program, seen = new Set<ts.Type>()): string[] {
  if (seen.has(type))
    return []
  seen.add(type)

  const recurse = (inner: ts.Type): string[] => entitiesIn(inner, checker, program, seen)

  if (type.isUnionOrIntersection())
    return type.types.flatMap(recurse)

  const declarations = type.getSymbol()?.getDeclarations() ?? []
  if (declarations.some(declaration => hasDecorator(declaration, ENTITY_DECORATORS)))
    return [type.getSymbol()!.getName()]

  const typeArguments = [...(type.aliasTypeArguments ?? []), ...checker.getTypeArguments(type as ts.TypeReference)]
  const ownProperties = declarations.every(declaration => isOwnSource(declaration, program))
    ? type.getProperties().map(property => checker.getTypeOfSymbol(property))
    : []
  return [...typeArguments, ...ownProperties].flatMap(recurse)
}

function createProgram(rootNames: string[], tsconfigPath: string, virtualFiles: Record<string, string>): ts.Program {
  const { config } = ts.readConfigFile(tsconfigPath, ts.sys.readFile)
  const { options } = ts.parseJsonConfigFileContent(config, ts.sys, dirname(tsconfigPath))
  const host = ts.createCompilerHost({ ...options, noEmit: true, incremental: false })
  const readFile = host.readFile.bind(host)
  const fileExists = host.fileExists.bind(host)
  host.readFile = fileName => virtualFiles[fileName] ?? readFile(fileName)
  host.fileExists = fileName => fileName in virtualFiles || fileExists(fileName)
  return ts.createProgram({ rootNames, options: { ...options, noEmit: true, incremental: false }, host })
}

/**
 * The route handlers of the given controller files whose return type carries a TypeORM
 * entity (ADR-0033: a controller answers a read model from `kuroshiro-shared`, never an
 * entity). Works on the checker's resolved type, so an undeclared return type is judged
 * by what the method really returns. `virtualFiles` maps absolute paths to source text for
 * files that exist only in a test.
 */
export function findEntityReturns(controllerFiles: string[], tsconfigPath: string, virtualFiles: Record<string, string> = {}): EntityReturn[] {
  const program = createProgram(controllerFiles, tsconfigPath, virtualFiles)
  const checker = program.getTypeChecker()

  return controllerFiles.flatMap((fileName) => {
    const sourceFile = program.getSourceFile(fileName)
    if (!sourceFile)
      throw new Error(`Controller file not found: ${fileName}`)

    return sourceFile.statements
      .filter(ts.isClassDeclaration)
      .flatMap(controller => controller.members
        .filter(ts.isMethodDeclaration)
        .filter(method => hasDecorator(method, ROUTE_DECORATORS))
        .flatMap((method) => {
          const signature = checker.getSignatureFromDeclaration(method)
          const entities = signature ? [...new Set(entitiesIn(checker.getReturnTypeOfSignature(signature), checker, program))].sort() : []
          return entities.length > 0
            ? [{ handler: `${controller.name?.text}.${method.name.getText(sourceFile)}`, entities }]
            : []
        }))
  })
}
