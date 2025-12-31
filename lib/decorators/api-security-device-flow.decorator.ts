import { ApiSecurity } from './api-security.decorator';

/**
 * Convenience decorator for OAuth 2.0 Device Authorization Flow requirements (OAS 3.2).
 *
 * Note: this decorator sets the operation/class security requirement only.
 * The security scheme itself should be configured via `DocumentBuilder.addOAuth2()`
 * (with `flows.deviceAuthorization`).
 *
 * @publicApi
 */
export function ApiSecurityDeviceFlow(name: string, scopes: string[]) {
  return ApiSecurity(name, scopes);
}
