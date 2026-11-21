# Connect TikTok Ads and TikTok account analytics

TikTok uses two separate authorization systems. Nellovia therefore stores two isolated encrypted credentials:

- **TikTok Ads** uses a TikTok For Business developer app and imports daily advertiser reporting.
- **TikTok business account** uses TikTok Login Kit and imports profile statistics plus engagement on public videos.

Neither connector can publish content or change campaigns.

## TikTok Ads setup

1. Create and verify an app in the TikTok For Business developer portal.
2. Request only the reporting permission needed for the consolidated report endpoint.
3. Add `https://YOUR_DOMAIN/api/connect/tiktok-ads/callback` as an advertiser redirect URL.
4. Copy the generated **Advertiser authorization URL** from the app's Basic Information page.
5. Configure:

```dotenv
TIKTOK_ADS_APP_ID=
TIKTOK_ADS_SECRET=
TIKTOK_ADS_AUTH_URL=
TIKTOK_ADS_REDIRECT_URI=https://YOUR_DOMAIN/api/connect/tiktok-ads/callback
```

The connector exchanges the authorization code for a long-term token, stores the returned advertiser IDs as non-secret credential metadata, and lets the owner select one advertiser.

## TikTok business or creator account setup

1. Create an app in TikTok for Developers and add Login Kit plus the TikTok API product.
2. Request `user.info.basic`, `user.info.profile`, `user.info.stats`, and `video.list`.
3. Register `https://YOUR_DOMAIN/api/connect/tiktok-business/callback` as the web redirect URI.
4. Configure:

```dotenv
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_REDIRECT_URI=https://YOUR_DOMAIN/api/connect/tiktok-business/callback
```

Access and refresh tokens remain server-side. Refresh tokens are rotated whenever TikTok returns a replacement.

## Data imported

- TikTok Ads: spend, impressions, reach, clicks and conversions by day.
- TikTok account: current followers, following, accumulated likes and video count.
- Recent public videos: views, likes, comments and shares, grouped by publication date.

Profile totals are snapshots, not historical daily series. Video engagement is TikTok's current count for each video, attributed to the publication date.

## Database

Review and apply `prisma/sql/005_connector_credential_metadata.sql` after `003` and `004`. It adds one nullable JSONB column containing only non-secret provider identifiers.
