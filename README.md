# Preflight

> A Sitecore Marketplace app that audits Experience Health across pages, components, and site-wide. Answers three questions before you publish:
>
> 1. **Will this page render the same for a visitor as in the editor?**
> 2. **Will this personalization actually work?**
> 3. **Will analytics track what happened?**

Built on the Sitecore Marketplace SDK, Authoring GraphQL, and Pages context.

---

## What it does

Preflight runs five checks against the page you're currently editing in Sitecore Pages. It surfaces blockers, warnings, and information in a verdict-first panel that a marketer can read in two seconds, with drill-down detail for developers.

### The five checks

| Check | Question it answers |
|---|---|
| **Dynamic placeholders** | Are all placeholders configured for personalization? |
| **Page personalization** | Which components are personalized, and what does each audience see? |
| **Analytics tracking** | Will visitor activity be captured on this page? |
| **Publish status** | Is the live version in sync with edits? |
| **Personalization safety** | Are there blank-space risks for visitors who match no rule? |

### Extension points

Preflight registers in three Sitecore extension points:

- **Pages Context Panel** — the primary surface. Per-page checks in the sidebar of Pages.
- **Dashboard Widget** — site-wide health summary.
- **Custom Field** — inline status indicator on linked content items.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  Preflight (single deployment)              │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │  UI Layer (React + Tailwind)         │   │
│  │  - Verdict banner                    │   │
│  │  - Check rows with drill-down        │   │
│  │  - Variant breakdown per component   │   │
│  └──────────────┬───────────────────────┘   │
│                 │                           │
│  ┌──────────────▼───────────────────────┐   │
│  │  Preflight engine                    │   │
│  │  - Parser (presentationDetails)      │   │
│  │  - 5 checks                          │   │
│  │  - Context resolver                  │   │
│  └──────────────┬───────────────────────┘   │
│                 │                           │
│  ┌──────────────▼───────────────────────┐   │
│  │  Data sources                        │   │
│  │  - pages.context (SDK subscription)  │   │
│  │  - xmc.authoring.graphql (SDK)       │   │
│  │  - CDP flowDefinitions (proxy)       │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### Data sources

| Source | What it provides | Auth |
|---|---|---|
| `pages.context` | Page metadata, `presentationDetails` JSON with personalization rules | Marketplace SDK built-in |
| `xmc.authoring.graphql` | Item fields (`__Tracking`, `__Updated`, `__Published`) | Marketplace SDK built-in |
| CDP `flowDefinitions` | Human-readable variant names and targeting rules | Server-side proxy (dev) |

### Where each check gets its data

| Check | Source |
|---|---|
| Dynamic placeholders | `pages.context.presentationDetails` |
| Page personalization | `pages.context.presentationDetails` + CDP (optional) |
| Analytics tracking | `xmc.authoring.graphql` (`__Tracking`) |
| Publish status | `xmc.authoring.graphql` (`__Updated`, `__Published`) |
| Personalization safety | `pages.context.presentationDetails` |

---

## Getting started

### Prerequisites

- Node.js 20+
- A Sitecore Cloud Portal account with an XM Cloud tenant
- Preflight app registered in App Studio

### Installation

```bash
git clone https://github.com/your-org/preflight-sitecore.git
cd preflight-sitecore
npm install
```

### Environment

Create `.env` at the project root:

```bash
VITE_SITECORE_APP_ID=your-app-id-from-cloud-portal
VITE_APP_BASE_URL=http://localhost:3000
VITE_PREFLIGHT_DEBUG=1

# Dev-only. Never shipped to browser bundle.
CDP_TOKEN=your-cdp-api-token
```

- `VITE_PREFLIGHT_DEBUG=1` — enables diagnostic console logs. Remove for production.
- `CDP_TOKEN` — no `VITE_` prefix, so it stays on the dev server. Used by the Vite proxy.

### Local development

```bash
npm run dev
```

The app runs at `http://localhost:3000`.

### Registering the app

In Cloud Portal → App Studio → Create App → Custom:

1. Set the **Deployment URL** to `http://localhost:3000`
2. Enable three extension points with these routes:

| Extension Point | Route |
|---|---|
| Dashboard Widget | `/dashboard-widget` |
| Pages Context Panel | `/pages-context-panel` |
| Custom Field | `/custom-field` |

3. Grant **XM Cloud API** access (Authoring, Sites, Pages)
4. Activate → Install into your tenant

### Testing

1. Open XM Cloud Pages
2. Open any page
3. Click the Preflight icon in the right sidebar
4. The five checks run against the current page

---

## Configuration

### Debug logging

Set `VITE_PREFLIGHT_DEBUG=1` to enable console diagnostics. Preflight logs:

- Full `pages.context` payload (page metadata, renderings, personalization rules)
- Every GUID resolution attempt
- Every check result before it hits the UI

Useful for diagnosing why a check returns `UNKNOWN` or `INFO`.

### CDP proxy (development)

The Vite dev server proxies `/api-sitecore/*` to `api-sg-cdpp.sitecorecloud.io`. This bypasses CORS in development and keeps the CDP token server-side.

Configured in `vite.config.ts`. Requires `CDP_TOKEN` in `.env`.

### CDP proxy (production)

**Production deployments need a server-side proxy.** Vite's dev proxy does not run in production.

For Vercel, add `api/cdp/[...path].ts` as a serverless function. For Netlify, use a redirect rule with a headers rewrite. The client code calls `/api-sitecore/*` regardless of environment.

If the proxy is unavailable at runtime, the personalization check falls back to generic labels (`Variant A`, `Audience 1`) and the app continues to work. The **Edit →** link on each component opens the Sitecore Personalize panel, where real variant names are visible.

---

## Project structure

```
preflight/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── lib/
│   │   ├── utils.ts
│   │   ├── sitecore/
│   │   │   ├── client.ts
│   │   │   └── queries.ts
│   │   └── preflight/
│   │       ├── types.ts
│   │       ├── constants.ts
│   │       ├── parser.ts
│   │       ├── checks.ts
│   │       ├── engine.ts
│   │       ├── context.ts
│   │       ├── diagnostics.ts
│   │       ├── personalize-url.ts
│   │       └── personalize-resolver.ts
│   ├── hooks/
│   │   ├── useMarketplaceClient.ts
│   │   ├── useAppContext.ts
│   │   ├── usePagesContext.ts
│   │   └── usePreflight.ts
│   ├── components/
│   │   ├── providers/
│   │   │   ├── MarketplaceContext.ts
│   │   │   └── MarketplaceClientProvider.tsx
│   │   ├── preflight/
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── SeverityBadge.tsx
│   │   │   ├── CheckCard.tsx
│   │   │   ├── CheckRow.tsx
│   │   │   ├── CheckList.tsx
│   │   │   ├── VariantRow.tsx
│   │   │   ├── VerdictBanner.tsx
│   │   │   ├── PagePreflightPanel.tsx
│   │   │   ├── SiteHealthSummary.tsx
│   │   │   └── CustomFieldIndicator.tsx
│   │   └── ui/
│   │       ├── alert.tsx
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── separator.tsx
│   │       └── skeleton.tsx
│   └── routes/
│       ├── PagesContextPanel.tsx
│       ├── DashboardWidget.tsx
│       └── CustomField.tsx
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── components.json
├── index.html
└── package.json
```

---

## Known limitations

| Limitation | Impact | Workaround |
|---|---|---|
| CDP variant names require a proxy | In production without a proxy, variants show as `Variant A`, `Audience 1` | Click **Edit →** to open Sitecore Personalize where names are visible |
| Dashboard widget shows single-page data | Site-wide aggregation requires a scan API | Coming in a future release |
| Custom field indicator is a placeholder | Not yet wired to actual content checks | Coming in a future release |
| Personalization audience names come from CDP | If CDP is unavailable, audiences are numbered | Same as first row |

---

## Roadmap

- [x] Five core checks
- [x] Verdict-first UI
- [x] Variant breakdown with deep links to Personalize
- [x] CDP resolver via dev proxy
- [ ] Production CDP proxy (serverless)
- [ ] Site-wide scan for Dashboard Widget
- [ ] Custom Field wired to content item checks
- [ ] Exportable health report (PDF / JSON)
- [ ] Multi-language support

---

## Tech stack

- **React 19** — UI
- **Vite 6** — build tool
- **TypeScript 5.7** — type safety
- **Tailwind CSS 4** — styling
- **shadcn/ui** — component primitives
- **Sitecore Marketplace SDK** — platform integration
- **Sitecore Authoring GraphQL** — content queries

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes
4. Open a pull request

### Code style

- TypeScript strict mode
- Two-space indentation
- Prefer composition over inheritance
- All new checks follow the `PreflightResult` shape in `src/lib/preflight/types.ts`

### Adding a new check

1. Define the check function in `src/lib/preflight/checks.ts`
2. Return a `PreflightResult` with one of the five severity levels
3. Register it in `runPageChecks()` in `src/lib/preflight/engine.ts`
4. Add a friendly label to `CHECK_LABELS` in `src/components/preflight/CheckRow.tsx`

---

## License

MIT

---

## Support

- Report bugs: [GitHub Issues](https://github.com/your-org/preflight-sitecore/issues)
- Sitecore Marketplace docs: https://doc.sitecore.com/mp/
- Marketplace SDK reference: https://doc.sitecore.com/mp/en/developers/marketplace-sdk/

---
