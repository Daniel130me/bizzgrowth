"use client";
// Public group — Screens 1-10: landing, pricing, auth, legal.
import type { ViewMap } from "../view-types";
import LandingScreen from "./landing";
import PricingScreen from "./pricing";
import SignupScreen from "./signup";
import VerifyEmailScreen from "./verify-email";
import SigninScreen from "./signin";
import ForgotPasswordScreen from "./forgot-password";
import ResetPasswordScreen from "./reset-password";
import AcceptInviteScreen from "./accept-invite";
import PrivacyPolicyScreen from "./privacy-policy";
import TermsScreen from "./terms";
import WaitingListScreen from "./waiting-list";

export const views: ViewMap = {
  landing: LandingScreen,
  pricing: PricingScreen,
  signup: SignupScreen,
  "verify-email": VerifyEmailScreen,
  signin: SigninScreen,
  "forgot-password": ForgotPasswordScreen,
  "reset-password": ResetPasswordScreen,
  "accept-invite": AcceptInviteScreen,
  "privacy-policy": PrivacyPolicyScreen,
  terms: TermsScreen,
  "waiting-list": WaitingListScreen,
};
