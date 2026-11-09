# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-09

Initial release, extracted from the KQED custom content CMS.

### Added

- Schedule side panel in the Content Manager edit view for draft & publish
  content types, with "Publish at" / "Unpublish at" date pickers and 12-hour
  time pickers (15-minute steps). Failed runs show their error in the panel.
- Interval-based poller (default 60s) that publishes/unpublishes due documents
  and catches up on anything missed while the server was down. Uses a plain
  interval instead of `strapi.cron` so it works on Strapi Cloud.
- Atomic claiming of each action, so multiple instances never execute the same
  action twice. Actions stuck in `processing` for 10 minutes are retried.
- `scheduled-action` content type (table `scheduled_actions`, hidden) recording
  each action's status (`pending` / `done` / `failed` / `skipped`) and error.
- Admin API `GET` / `PUT /scheduled-content/actions`, requiring an authenticated
  admin with the Content Manager publish permission on the target type. Rejects
  past dates and an unpublish scheduled before the publish.
- Per-locale scheduling for i18n-localized content types.
- One-time import of pending schedules from `strapi-plugin-publisher`; overdue
  ones are recorded as `skipped` instead of executed.
- Plugin config: `enabled`, `intervalMs` (min 5000), `importPublisherActions`.

[Unreleased]: https://github.com/uptech/strapi-scheduled-content/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/uptech/strapi-scheduled-content/releases/tag/v0.1.0
