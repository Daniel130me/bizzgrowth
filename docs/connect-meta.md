# Connect Meta Ads, Facebook Pages and Instagram

Nellovia uses one Meta OAuth sign-in for three read-only sources:

- Meta Ads performance
- Facebook Page insights
- Insights for a professional Instagram account linked to a Facebook Page

User and Page access tokens remain server-side and encrypted. Page tokens are used only while listing or synchronizing Pages and are never returned to the browser.

## 1. Create the Meta app

Create a Meta business app, add Facebook Login, and associate it with the business portfolio used for the Pages and ad accounts. Configure the app's privacy policy, data-deletion instructions and contact details before App Review.

Add this exact valid OAuth redirect URI:

- Local: `http://localhost:3007/api/connect/meta/callback`
- Production: `https://YOUR_DOMAIN/api/connect/meta/callback`

In Development mode, only app roles and permitted test users can connect. Public users require the relevant permissions to receive Advanced Access through App Review.

## 2. Request permissions

The connector requests:

- `ads_read`
- `pages_show_list`
- `pages_read_engagement`
- `read_insights`
- `instagram_basic`
- `instagram_manage_insights`

The signed-in person must be able to access the chosen ad account or manage the chosen Page. Instagram insights require a professional Instagram account connected to a Facebook Page.

## 3. Configure Nellovia

```dotenv
META_APP_ID=your-app-id
META_APP_SECRET=your-app-secret
META_REDIRECT_URI=http://localhost:3007/api/connect/meta/callback
META_GRAPH_VERSION=v27.0
CONNECTIONS_ENCRYPTION_KEY=base64-encoded-32-byte-key
```

Keep the Graph version explicit and review upgrades deliberately. The server exchanges the initial user token for a long-lived token. Meta does not provide this connector a conventional refresh token, so owners must reconnect when authorization expires or is revoked.

## 4. Apply the database changes

Follow `docs/connect-google.md` and apply the reviewed additive `003_connections.sql` and `004_connection_config.sql` files in order. Do not use `prisma db push` against the shared Neon database.

## 5. Test each source

1. Open **Data → Sources** and choose a Meta source.
2. Complete Meta consent with a permitted tester account.
3. Select an ad account, Facebook Page and/or linked professional Instagram account.
4. Save and wait for synchronization.
5. Confirm measured results appear in each connection's settings page.
6. Ask an evidence-based question and verify that Meta, Facebook or Instagram is named as the measured source.

For production approval, test both granted and declined permissions and provide Meta with reproducible reviewer instructions and test assets.
