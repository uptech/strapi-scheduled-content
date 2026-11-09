# @uptechworks/strapi-scheduled-content

Schedule publish and unpublish times for Strapi 5 content. Works locally and on
Strapi Cloud, and is safe to run on multiple instances.

A drop-in replacement for [strapi-plugin-publisher](https://github.com/pluginpal/strapi-plugin-publisher),
including a one-time import of its pending schedules.

## Features

- **Schedule panel** in the Content Manager edit view of every draft & publish
  content type: "Publish at" / "Unpublish at" with a date picker and a 12-hour
  time picker (15-minute steps). Failed runs show their error in the panel.
- **Poller** checks for due actions every 60s (configurable) and catches up on
  anything that came due while the server was down.
- **Multi-instance safe**: each action is claimed with a conditional `UPDATE`,
  so only one instance executes it.
- **History**: actions are kept with status `pending` / `done` / `failed` /
  `skipped` and the error message.
- **Permissions**: scheduling requires the Content Manager *publish* permission
  on the content type. Past dates and an unpublish before the publish are
  rejected.
- **i18n aware**: localized content types are scheduled per locale.

### Why not `strapi.cron`?

Strapi Cloud replaces the cron service with its own runner, which crashes on
one-off `Date` jobs and did not fire recurring jobs registered at runtime. A
plain interval behaves identically locally and on Cloud.

## Requirements

- Strapi `^5.0.0` (developed and tested on 5.61.1)
- Content types must have **Draft & Publish** enabled to show the panel

## Install

```bash
npm install @uptechworks/strapi-scheduled-content
```

Or, while developing locally:

```bash
# in this repo
npm run build && npx yalc publish
# in the Strapi project
npx yalc add @uptechworks/strapi-scheduled-content && npm install
```

The plugin is enabled automatically once installed. Rebuild the admin
(`npm run build` / `npm run develop`) to see the panel.

## Configuration

Optional, in `config/plugins.ts`:

```ts
export default ({ env }) => ({
  'scheduled-content': {
    config: {
      enabled: env.bool('SCHEDULER_ENABLED', true), // run the poller on this instance
      intervalMs: env.int('SCHEDULER_INTERVAL_MS', 60000), // min 5000
      importPublisherActions: true, // one-time import from strapi-plugin-publisher
    },
  },
});
```

## Migrating from strapi-plugin-publisher

1. Uninstall `strapi-plugin-publisher` and remove its entry from `config/plugins.ts`.
2. Install this plugin and deploy.

On the first boot, before Strapi drops the publisher's `actions` table, the
plugin copies its rows and imports them. Future schedules become `pending`;
overdue ones are recorded as `skipped` rather than executed. The import runs
once per database and is skipped while the publisher is still installed.

## How it works

| Piece | Where |
| --- | --- |
| Content type `plugin::scheduled-content.scheduled-action` (table `scheduled_actions`, hidden) | `server/src/content-types` |
| Poller, claim + execute | `server/src/services/runner.ts` |
| Admin API `GET`/`PUT /scheduled-content/actions` | `server/src/controllers`, `server/src/routes` |
| Publisher import (`beforeSync` hook + bootstrap) | `server/src/services/publisher-import.ts` |
| Schedule side panel | `admin/src/components/SchedulePanel.tsx` |

Logs are prefixed `[scheduled-content]`: `polling every 60s` on boot,
`done: publish <uid> <documentId>` per action, `failed: …` on errors.

## Limits

- Actions run up to one interval late.
- A scheduled publish publishes the draft as it is at that moment.
- Times are entered in the editor's browser timezone and stored in UTC.

## Development

```bash
npm install
npm run build          # build dist/
npm run verify         # check the package before publishing
npm run test:ts:back   # type-check server
npm run test:ts:front  # type-check admin
npm run watch:link     # rebuild + yalc push on change
```

## License

MIT

Made with 💜 by Uptech Studio © 2026