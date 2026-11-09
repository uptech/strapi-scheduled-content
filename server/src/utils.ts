import type { Core, UID } from '@strapi/strapi';

export const isLocalized = (strapi: Core.Strapi, uid: string) =>
  Boolean((strapi.contentType(uid as UID.ContentType)?.pluginOptions as any)?.i18n?.localized);
