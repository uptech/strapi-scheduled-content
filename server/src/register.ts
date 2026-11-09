import type { Core } from '@strapi/strapi';
import { PLUGIN_ID } from './pluginId';

export default ({ strapi }: { strapi: Core.Strapi }) => {
  if (!strapi.plugin(PLUGIN_ID).config('importPublisherActions')) return;

  // Runs after the DB connects but before schema sync drops tables of
  // uninstalled plugins — the last moment strapi-plugin-publisher's rows exist.
  strapi.hook('strapi::content-types.beforeSync').register(() =>
    strapi.plugin(PLUGIN_ID).service('publisher-import').stage()
  );
};
