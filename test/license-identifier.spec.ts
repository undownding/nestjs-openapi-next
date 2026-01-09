import { DocumentBuilder } from '../lib/document-builder';

describe('DocumentBuilder.setLicense() with identifier', () => {
  it('sets license with name, url, and identifier', () => {
    const config = new DocumentBuilder()
      .setTitle('Test API')
      .setVersion('1.0.0')
      .setLicense('Apache 2.0', 'https://www.apache.org/licenses/LICENSE-2.0.html', 'Apache-2.0')
      .build();

    expect(config.info.license).toEqual({
      name: 'Apache 2.0',
      url: 'https://www.apache.org/licenses/LICENSE-2.0.html',
      identifier: 'Apache-2.0'
    });
  });

  it('sets license with name and identifier only', () => {
    const config = new DocumentBuilder()
      .setTitle('Test API')
      .setVersion('1.0.0')
      .setLicense('MIT License', undefined, 'MIT')
      .build();

    expect(config.info.license).toEqual({
      name: 'MIT License',
      identifier: 'MIT'
    });
  });

  it('sets license with name and url only (backward compatibility)', () => {
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

  it('sets license with name only', () => {
    const config = new DocumentBuilder()
      .setTitle('Test API')
      .setVersion('1.0.0')
      .setLicense('Proprietary')
      .build();

    expect(config.info.license).toEqual({
      name: 'Proprietary'
    });
  });
});
