"use client";
// Challenges — the owner's list of what's holding the business back (screens 121–124).

import type { ScreenProps, ViewMap } from "../view-types";
import { ChallengesScreen } from "./challenges-page";
import { ChallengeDetailScreen } from "./challenge-detail";
import { ChallengeChatScreen } from "./challenge-chat";

// One screen per challenge: going from one challenge (or "new") to another starts fresh
// instead of carrying the previous one's chat or diagnosis request along.
function ChallengeDetailRoute(props: ScreenProps) {
  return <ChallengeDetailScreen key={props.params.id} {...props} />;
}
function ChallengeChatRoute(props: ScreenProps) {
  return <ChallengeChatScreen key={props.params.id ?? "new"} {...props} />;
}

export const views: ViewMap = {
  challenges: ChallengesScreen,
  // "new" is an exact route, so it wins over "challenges/:id".
  "challenges/new": ChallengeChatRoute,
  "challenges/:id": ChallengeDetailRoute,
  "challenges/:id/chat": ChallengeChatRoute,
};
