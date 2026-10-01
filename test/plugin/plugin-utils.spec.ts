import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { replaceImportPath } from '../../lib/plugin/utils/plugin-utils.js';

describe('plugin-utils', () => {
  describe('replaceImportPath', () => {
    describe('a package subpath under esm', () => {
      // A fixture rather than an installed dependency, so the cases stay put:
      // "plain-pkg" ships no "exports" map and "mapped-pkg" publishes its
      // subpaths through one.
      const packagesDir = fileURLToPath(
        new URL('./fixtures/esm-packages', import.meta.url)
      );
      const fileName = join(packagesDir, 'src', 'test.dto.ts');
      const declarationOf = (pkg: string, file: string) =>
        join(packagesDir, 'node_modules', pkg, 'out', file);

      const importPathOf = (specifier: string, declarationFileName: string) =>
        replaceImportPath(
          `import("${specifier}").Status`,
          fileName,
          { esmCompatible: true } as any,
          undefined,
          declarationFileName
        ).importPath;

      it('should get the extension the runtime needs to find it', () => {
        const specifier = join(
          packagesDir,
          'node_modules/plain-pkg/out/status'
        );

        expect(
          importPathOf(specifier, declarationOf('plain-pkg', 'status.d.ts'))
        ).toBe('plain-pkg/out/status.js');
      });

      it('should keep the one an "exports" map already publishes', () => {
        const specifier = join(
          packagesDir,
          'node_modules/mapped-pkg/out/status'
        );

        expect(
          importPathOf(specifier, declarationOf('mapped-pkg', 'status.d.mts'))
        ).toBe('mapped-pkg/out/status');
      });

      it('should get past a directory to the file beside it', () => {
        // "dir-pkg" holds both "out/" and "out.js". The subpath as written
        // names the directory, which ESM cannot import, while the file that
        // carries the extension is the one it can.
        const specifier = join(packagesDir, 'node_modules/dir-pkg/out');

        expect(
          importPathOf(specifier, declarationOf('dir-pkg', 'main.d.ts'))
        ).toBe('dir-pkg/out.js');
      });

      it('should not take a directory for a resolved file', () => {
        // "/index" is dropped upstream, so the subpath names the directory
        // that holds it. ESM cannot import a directory, and no extension turns
        // it into a file either.
        const specifier = join(packagesDir, 'node_modules/plain-pkg/out');

        expect(
          importPathOf(specifier, declarationOf('plain-pkg', 'main.d.ts'))
        ).toBe('plain-pkg/out');
      });

      it('should keep one the package publishes both ways', () => {
        // "both-pkg" exports the subpath and the same subpath with its
        // extension. The "exports" map decides what is reachable, so the
        // subpath is left as written.
        const specifier = join(packagesDir, 'node_modules/both-pkg/out/status');

        expect(
          importPathOf(specifier, declarationOf('both-pkg', 'status.d.ts'))
        ).toBe('both-pkg/out/status');
      });

      it('should keep one whose extension resolves no better', () => {
        // "typings-only" ships the declaration without a runtime file
        // beside it, so neither form reaches a file and appending an
        // extension would not make the specifier any more correct.
        const specifier = join(
          packagesDir,
          'node_modules/typings-only/out/status'
        );

        expect(
          importPathOf(specifier, declarationOf('typings-only', 'status.d.ts'))
        ).toBe('typings-only/out/status');
      });

      it('should keep the one that already carries its extension', () => {
        const specifier = join(
          packagesDir,
          'node_modules/plain-pkg/out/status.js'
        );

        expect(
          importPathOf(specifier, declarationOf('plain-pkg', 'status.d.ts'))
        ).toBe('plain-pkg/out/status.js');
      });

      it('should keep a package root extensionless', () => {
        // "/index" is dropped upstream, leaving the bare package name, which
        // resolves through "main".
        const specifier = join(packagesDir, 'node_modules/index-pkg/index');

        expect(
          importPathOf(
            specifier,
            join(packagesDir, 'node_modules/index-pkg/index.d.ts')
          )
        ).toBe('index-pkg');
      });
    });
  });
});
