import type { Core } from '@strapi/strapi';
import { PLUGIN_ID } from './pluginId';

export default ({ strapi }: { strapi: Core.Strapi }) => {
  strapi.plugin(PLUGIN_ID).service('runner').stop();
};
