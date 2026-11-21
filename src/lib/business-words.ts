// The everyday words for THIS business — so ready-made wording fits a bakery,
// a shop or an online store as well as a tailor or a web studio: "order" or
// "job", "what you sell" or "your work", "price" or "quote".
// Pure; read from the owner's own answers (never from the workspace name).

import type { BusinessFacts } from "./checkup";
import { businessKind, type BusinessKind } from "./challenges";

export interface BusinessWords {
  kind: BusinessKind;
  /** Sells goods (food, products, a shop) rather than doing work for people. */
  goods: boolean;
  /** One sale: "order" or "job". */
  sale: string;
  /** What people buy, as said to the owner: "what you sell" or "your work". */
  offer: string;
  /** What new people can be shown: "photos of what you sell" or "your past work". */
  examples: string;
  /** Where the price is given: "price" or "quote". */
  quote: string;
}

type FactsLike = Partial<Pick<BusinessFacts, "businessType" | "whatTheySell" | "customers" | "channels">> | null | undefined;

export function businessWords(f: FactsLike): BusinessWords {
  const kind = businessKind({
    businessType: f?.businessType === "ecommerce" ? "I sell products" : f?.businessType === "service" ? "I offer a service" : undefined,
    sells: f?.whatTheySell,
    targetMarket: f?.customers,
    channels: f?.channels,
  });
  const goods = kind === "food" || kind === "retail" || kind === "online" || kind === "product" || (kind === "b2b" && f?.businessType === "ecommerce");
  return goods
    ? { kind, goods, sale: "order", offer: kind === "food" ? "your food" : "what you sell", examples: "photos of what you sell", quote: "price" }
    : { kind, goods, sale: "job", offer: "your work", examples: "your past work", quote: "quote" };
}
