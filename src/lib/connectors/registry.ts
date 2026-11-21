import type { Connector } from "./types";
import { googleConnector } from "./google";
import { metaConnector } from "./meta";
import { shopifyConnector } from "./shopify";
import { tiktokAdsConnector, tiktokProfileConnector } from "./tiktok";

const connectorList: Connector[] = [googleConnector, metaConnector, tiktokAdsConnector, tiktokProfileConnector, shopifyConnector];
const connectors = new Map<string, Connector>(connectorList.map((connector) => [connector.id, connector]));

export function connectorById(id: string): Connector | null {
  return connectors.get(id) ?? null;
}

export function configuredProviders(): Record<string, { configured: boolean; missing: string[] }> {
  return Object.fromEntries(
    [...connectors].map(([id, connector]) => {
      const missing = connector.missingConfig();
      return [id, { configured: missing.length === 0, missing }];
    }),
  );
}
