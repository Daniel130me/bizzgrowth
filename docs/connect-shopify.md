# Connect Shopify

Nellovia is a standalone Shopify app that uses the OAuth authorization-code flow. It requests only `read_orders` and deliberately excludes customer names, emails, phone numbers and addresses from its GraphQL queries.

## Create the app

1. Create the app in Shopify's Dev Dashboard and configure distribution for the stores that will install it.
2. Add the redirect URI `https://YOUR_DOMAIN/api/connect/shopify/callback`.
3. Request the `read_orders` access scope.
4. Configure:

```dotenv
SHOPIFY_CLIENT_ID=
SHOPIFY_CLIENT_SECRET=
SHOPIFY_REDIRECT_URI=https://YOUR_DOMAIN/api/connect/shopify/callback
SHOPIFY_API_VERSION=2026-10
```

The owner enters the store's permanent `myshopify.com` domain before authorization. The callback validates the state nonce, Shopify HMAC, returned shop domain and authenticated shop identity before saving anything.

## Data imported

For the most recent 60 days, Nellovia imports daily aggregate:

- order count
- item count
- gross sales
- current revenue after order changes
- refunded amount
- cancelled order count

The initial scope does not provide checkout-abandonment analytics or orders older than 60 days. Those require additional Shopify approval and are intentionally outside this version.

Shopify revokes the saved access token when the merchant uninstalls the app. Disconnecting inside Nellovia removes the encrypted local token and imported metrics; the merchant should also uninstall the app in Shopify to revoke Shopify-side access immediately.

## Database

Review and apply `prisma/sql/005_connector_credential_metadata.sql`. The connector stores the non-secret `myshopify.com` domain in credential metadata so expiring offline tokens can be refreshed against the correct store.
