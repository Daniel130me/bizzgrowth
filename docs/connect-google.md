# Connect Google data

Nellovia uses one Google OAuth sign-in for four independent, read-only sources:

- Search Console: clicks, impressions, average position, top searches and top pages.
- Google Analytics 4: sessions, users, new users, key events and acquisition channels.
- Google Ads: impressions, clicks, spend, conversions, conversion value and top search terms.
- Google Sheets: daily revenue, expenses and customer counts from one spreadsheet and tab the owner explicitly selects.

OAuth tokens stay on the server and are encrypted with AES-256-GCM before storage. The browser receives account labels and measured results, never credentials.

## 1. Create and configure Google Cloud

Create or select a Google Cloud project dedicated to Nellovia. In **APIs & Services → Library**, enable:

1. Google Search Console API
2. Google Analytics Data API
3. Google Analytics Admin API
4. Google Sheets API
5. Google Ads API

The Analytics Admin API lists properties; the Data API reads the selected property. Google Ads also requires a developer token from the Google Ads API Center. Its access level determines which production accounts may be queried.

## 2. Configure OAuth consent

Use an External audience unless every user belongs to one Workspace organization. During development, keep the app in Testing and add the accounts that will test it.

Add these scopes:

- `https://www.googleapis.com/auth/webmasters.readonly`
- `https://www.googleapis.com/auth/analytics.readonly`
- `https://www.googleapis.com/auth/spreadsheets.readonly`
- `https://www.googleapis.com/auth/adwords`

Sheets deliberately does not request Google Drive permission. Owners paste one spreadsheet URL and map the tab and columns they want Nellovia to read. Public production use may require Google's OAuth verification.

## 3. Create the web OAuth client

Create an OAuth client ID with application type **Web application**, then add the exact redirect URI:

- Local: `http://localhost:3007/api/connect/google/callback`
- Production: `https://YOUR_DOMAIN/api/connect/google/callback`

Do not commit the client secret or developer token.

## 4. Configure Nellovia

```dotenv
APP_URL=http://localhost:3007
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3007/api/connect/google/callback
GOOGLE_ADS_DEVELOPER_TOKEN=your-approved-developer-token
GOOGLE_ADS_API_VERSION=v26
CONNECTIONS_ENCRYPTION_KEY=base64-encoded-32-byte-key
CRON_SECRET=long-random-value
```

Generate the encryption key once and retain it across releases:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Changing `CONNECTIONS_ENCRYPTION_KEY` makes saved tokens unreadable.

## 5. Apply the additive database changes

Review both SQL files. Apply `003` first, then `004`, against the direct Neon connection:

```bash
bunx prisma db execute --file prisma/sql/003_connections.sql --schema prisma/schema.prisma
bunx prisma db execute --file prisma/sql/004_connection_config.sql --schema prisma/schema.prisma
```

Both files are additive and idempotent. Do not use `db push` against this database: the Prisma schema intentionally represents only part of the existing Neon schema.

## 6. Test each source

1. Sign in and open **Data → Sources**.
2. Select a Google source, review the permissions and complete consent.
3. Choose any accessible Search Console site, GA4 property and directly accessible Ads customer.
4. For Sheets, paste a spreadsheet URL, choose a tab, and map the date plus at least one numeric column.
5. Save and wait for the sync screen to finish.
6. Confirm each settings page shows measured dates and values.
7. Ask an evidence-based question in **Ask Your Business** and verify that the relevant source is identified as measured data.

Google Ads currently lists customers directly accessible to the signed-in identity. Manager-account child selection and `login-customer-id` are intentionally not included in this first version.

## Scheduled sync

Call this endpoint at least daily from DigitalOcean cron or another scheduler:

```bash
curl -fsS -X POST \
  -H "x-cron-secret: $CRON_SECRET" \
  https://YOUR_DOMAIN/api/connect/sync
```

Only connections older than 24 hours are synchronized. Database claims prevent overlapping work for one connection.
