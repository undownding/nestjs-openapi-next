import { filter, groupBy, keyBy, mapValues, omit } from 'lodash';
import { OpenAPIObject } from './interfaces';
import { isOas31OrAbove } from './utils/is-oas31-or-above';
import { sortObjectLexicographically } from './utils/sort-object-lexicographically';

export class SwaggerTransformer {
  public normalizePaths(
    denormalizedDoc: (Partial<OpenAPIObject> & Record<'root', any>)[],
    options?: { openapiVersion?: string }
  ): Pick<OpenAPIObject, 'paths' | 'webhooks'> {
    const roots = filter(denormalizedDoc, (r) => r.root);

    const emitWebhooks = isOas31OrAbove(options?.openapiVersion);
    const webhookRoots = emitWebhooks
      ? roots.filter(({ root }: Record<'root', any>) => Boolean(root?.isWebhook))
      : [];
    const pathRoots = emitWebhooks
      ? roots.filter(({ root }: Record<'root', any>) => !root?.isWebhook)
      : // OAS 3.0: webhooks is not a top-level field; emit as normal paths
        roots;

    const groupedByPath = groupBy(
      pathRoots,
      ({ root }: Record<'root', any>) => root.path
    );
    const paths = mapValues(groupedByPath, (routes) => {
      const keyByMethod = keyBy(
        routes,
        ({ root }: Record<'root', any>) => root.method
      );
      return mapValues(keyByMethod, (route: any) => {
        const mergedDefinition = {
          ...omit(route, 'root'),
          ...omit(route.root, ['method', 'path', 'isWebhook', 'webhookName'])
        };
        return sortObjectLexicographically(mergedDefinition);
      });
    });

    const groupedByWebhookName = groupBy(
      webhookRoots,
      ({ root }: Record<'root', any>) => root.webhookName || root.path
    );
    const webhooks = mapValues(groupedByWebhookName, (routes) => {
      const keyByMethod = keyBy(
        routes,
        ({ root }: Record<'root', any>) => root.method
      );
      return mapValues(keyByMethod, (route: any) => {
        const mergedDefinition = {
          ...omit(route, 'root'),
          ...omit(route.root, ['method', 'path', 'isWebhook', 'webhookName'])
        };
        return sortObjectLexicographically(mergedDefinition);
      });
    });

    return {
      paths,
      ...(Object.keys(webhooks).length > 0 ? { webhooks } : {})
    };
  }
}
