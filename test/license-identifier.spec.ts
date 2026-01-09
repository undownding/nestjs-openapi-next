import { DocumentBuilder } from '../lib/document-builder';

describe('DocumentBuilder license methods', () => {
  describe('setLicense()', () => {
    it('sets license with name and url', () => {
      const config = new DocumentBuilder()
        .setTitle('Test API')
        .setVersion('1.0.0')
        .setLicense('Apache 2.0', 'https://www.apache.org/licenses/LICENSE-2.0.html')
        .build();

      expect(config.info.license).toEqual({
        name: 'Apache 2.0',
        url: 'https://www.apache.org/licenses/LICENSE-2.0.html'
      });
    });
  });

  describe('setLicenseWithIdentifier()', () => {
    it('sets license with name and identifier (SPDX)', () => {
      const config = new DocumentBuilder()
        .setTitle('Test API')
        .setVersion('1.0.0')
        .setLicenseWithIdentifier('Apache 2.0', 'Apache-2.0')
        .build();

      expect(config.info.license).toEqual({
        name: 'Apache 2.0',
        identifier: 'Apache-2.0'
      });
    });

    it('sets license with MIT identifier', () => {
      const config = new DocumentBuilder()
        .setTitle('Test API')
        .setVersion('1.0.0')
        .setLicenseWithIdentifier('MIT License', 'MIT')
        .build();

      expect(config.info.license).toEqual({
        name: 'MIT License',
        identifier: 'MIT'
      });
    });
  });
});
