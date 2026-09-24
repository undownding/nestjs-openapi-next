import * as ts from 'typescript';
import { PluginOptions } from '../merge-options.js';
import { pluginDebugLogger } from '../plugin-debug-logger.js';
import {
  convertPath,
  extractTypeArgumentIfArray,
  replaceImportPath
} from './plugin-utils.js';

export function typeReferenceToIdentifier(
  typeReferenceDescriptor: {
    typeName: string;
    isArray?: boolean;
    arrayDepth?: number;
  },
  hostFilename: string,
  options: PluginOptions,
  factory: ts.NodeFactory,
  type: ts.Type,
  typeImports: Record<string, string>,
  sourceImportSpecifiers?: Map<ts.Symbol, string>
) {
  if (options.readonly) {
    assertReferenceableType(
      type,
      typeReferenceDescriptor.typeName,
      hostFilename,
      options
    );
  }

  const { typeReference, importPath, typeName } = replaceImportPath(
    typeReferenceDescriptor.typeName,
    hostFilename,
    options,
    resolveSourceSpecifier(
      type,
      typeReferenceDescriptor.arrayDepth,
      sourceImportSpecifiers
    ),
    resolveDeclarationFileName(
      type,
      typeReferenceDescriptor.arrayDepth,
      typeReferenceDescriptor.typeName
    )
  );

  let identifier: ts.Identifier;
  if (options.readonly && typeReference?.includes('import')) {
    if (!typeImports[importPath]) {
      typeImports[importPath] = typeReference;
    }

    let ref = `t["${importPath}"].${typeName}`;
    if (typeReferenceDescriptor.isArray) {
      ref = wrapTypeInArray(ref, typeReferenceDescriptor.arrayDepth);
    }
    identifier = factory.createIdentifier(ref);
  } else {
    let ref = typeReference;
    if (typeReferenceDescriptor.isArray) {
      ref = wrapTypeInArray(ref, typeReferenceDescriptor.arrayDepth);
    }
    identifier = factory.createIdentifier(ref);
  }
  return identifier;
}

/**
 * Returns the specifier the visited file imports `type` through, if any. Array
 * types are unwrapped first, so `Status[]` is matched on `Status`.
 */
function resolveSourceSpecifier(
  type: ts.Type,
  arrayDepth: number | undefined,
  sourceImportSpecifiers: Map<ts.Symbol, string> | undefined
): string | undefined {
  if (!sourceImportSpecifiers?.size || !type) {
    return undefined;
  }
  const symbol = elementSymbol(type, arrayDepth);
  return symbol ? sourceImportSpecifiers.get(symbol) : undefined;
}

/**
 * Returns the file declaring the type `typeName` imports. A merged declaration
 * or a module augmentation spreads a symbol over several files, so the one
 * whose path matches the `import("...")` in `typeName` is preferred.
 */
function resolveDeclarationFileName(
  type: ts.Type,
  arrayDepth: number | undefined,
  typeName: string
): string | undefined {
  const declarations = elementSymbol(type, arrayDepth)?.declarations;
  if (!declarations?.length) {
    return undefined;
  }
  const importPath = /import\("([^"]+)"/.exec(typeName)?.[1];
  const fileNames = declarations.map((decl) => decl.getSourceFile().fileName);
  const matching =
    importPath &&
    fileNames.find(
      (fileName) =>
        convertPath(fileName).replace(/(\.d)?\.[mc]?tsx?$/, '') ===
        convertPath(importPath).replace(/\.[mc]?jsx?$/, '')
    );
  return matching || fileNames[0];
}

/**
 * An array property carries the `Array<T>` type, whose declaration every
 * array in the program shares through lib.es5.d.ts. The element is the type
 * the import speaks about.
 */
function elementSymbol(
  type: ts.Type,
  arrayDepth: number | undefined
): ts.Symbol | undefined {
  let elementType = type;
  for (let depth = arrayDepth ?? 0; depth > 0; depth--) {
    const arrayTuple = extractTypeArgumentIfArray(elementType);
    if (!arrayTuple) {
      break;
    }
    elementType = arrayTuple.type;
  }
  return elementType?.aliasSymbol ?? elementType?.symbol;
}

function wrapTypeInArray(typeRef: string, arrayDepth: number) {
  for (let i = 0; i < arrayDepth; i++) {
    typeRef = `[${typeRef}]`;
  }
  return typeRef;
}

function assertReferenceableType(
  type: ts.Type,
  parsedTypeName: string,
  hostFilename: string,
  options: PluginOptions
) {
  if (!type.symbol) {
    return true;
  }
  if (!(type.symbol as any).isReferenced) {
    return true;
  }
  if (parsedTypeName.includes('import')) {
    return true;
  }
  const errorMessage = `Type "${parsedTypeName}" is not referenceable ("${hostFilename}"). To fix this, make sure to export this type.`;
  if (options.debug) {
    pluginDebugLogger.debug(errorMessage);
  }
  throw new Error(errorMessage);
}
