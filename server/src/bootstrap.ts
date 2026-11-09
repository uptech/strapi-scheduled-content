import type { Core } from '@strapi/strapi';
import { LOG_PREFIX, PLUGIN_ID } from './pluginId';

export default async ({ strapi }: { strapi: Core.Strapi }) => {
  const plugin = strapi.plugin(PLUGIN_ID);

  await plugin.service('publisher-import').importStaged();

  if (!plugin.config('enabled')) {
    strapi.log.info(`${LOG_PREFIX} poller disabled by config`);
    return;
  }
  plugin.service('runner').start(plugin.config('intervalMs'));
};
