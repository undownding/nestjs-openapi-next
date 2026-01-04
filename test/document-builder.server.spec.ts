import { DocumentBuilder } from '../lib/document-builder';

describe('DocumentBuilder.addServerWithName()', () => {
  it('adds a server entry with name/url/description', () => {
    const config = new DocumentBuilder()
      .addServerWithName('prod', 'https://api.example.com', 'Production')
      .build();

    expect(config.servers?.[0]).toEqual(
      expect.objectContaining({
        name: 'prod',
        url: 'https://api.example.com',
        description: 'Production'
      })
    );
  });

  it('adds server variables when provided', () => {
    const config = new DocumentBuilder()
      .addServerWithName('local', 'https://{host}', 'Local', {
        host: { default: 'localhost' }
      })
      .build();

    expect(config.servers?.[0]).toEqual(
      expect.objectContaining({
        name: 'local',
        url: 'https://{host}',
        description: 'Local',
        variables: {
          host: { default: 'localhost' }
        }
      })
    );
  });
});

