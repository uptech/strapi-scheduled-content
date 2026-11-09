import type { Core, UID } from '@strapi/strapi';
import { PLUGIN_ID } from '../pluginId';
import type { Action, Target } from '../services/schedule';
import { isLocalized } from '../utils';

const ACTIONS: Action[] = ['publish', 'unpublish'];
// Allows for clock skew and the time it takes to click "Save".
const PAST_GRACE_MS = 60 * 1000;

const resolveTarget = (strapi: Core.Strapi, ctx: any, source: Record<string, any>): Target | null => {
  const { contentType, documentId, locale } = source ?? {};
  const schema = contentType && strapi.contentType(contentType as UID.ContentType);

  if (!schema || !documentId) {
    ctx.badRequest('contentType and documentId are required');
    return null;
  }
  if (!schema.options?.draftAndPublish) {
    ctx.badRequest(`${contentType} does not have draft & publish enabled`);
    return null;
  }
  if (!ctx.state.userAbility?.can('plugin::content-manager.explorer.publish', contentType)) {
    ctx.forbidden();
    return null;
  }

  return {
    contentType: contentType as string,
    targetDocumentId: String(documentId),
    targetLocale: isLocalized(strapi, contentType) && locale ? String(locale) : null,
  };
};

export default ({ strapi }: { strapi: Core.Strapi }) => {
  const schedule = () => strapi.plugin(PLUGIN_ID).service('schedule');

  return {
    async list(ctx) {
      const target = resolveTarget(strapi, ctx, ctx.query);
      if (!target) return;
      ctx.body = { data: await schedule().list(target) };
    },

    async update(ctx) {
      const body = ctx.request.body ?? {};
      const target = resolveTarget(strapi, ctx, body);
      if (!target) return;

      const dates: Partial<Record<Action, Date | null>> = {};
      for (const action of ACTIONS) {
        const value = body[`${action}At`];
        if (value === undefined) continue;
        if (value === null) {
          dates[action] = null;
          continue;
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          return ctx.badRequest(`${action}At is not a valid date`);
        }
        if (date.getTime() < Date.now() - PAST_GRACE_MS) {
          return ctx.badRequest(`${action}At must be in the future`);
        }
        dates[action] = date;
      }
      if (dates.publish && dates.unpublish && dates.unpublish <= dates.publish) {
        return ctx.badRequest('Unpublish time must be after publish time');
      }

      ctx.body = { data: await schedule().set(target, dates) };
    },
  };
};
