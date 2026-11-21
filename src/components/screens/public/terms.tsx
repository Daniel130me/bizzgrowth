"use client";
// Screen 10 — Terms of Service.

import React from "react";
import { LegalLayout, type LegalSection } from "./legal-shared";

const SECTIONS: LegalSection[] = [
  {
    id: "acceptance",
    title: "Agreement to these terms",
    body: (
      <>
        <p>
          By creating an account or using Nellovia you agree to these terms. If you use Nellovia on behalf of a
          business, you confirm that you are authorised to bind that business to them.
        </p>
        <p>
          These terms are intentionally readable. For this prototype, the plain-language version below is the actual
          agreement — a full legal agreement will accompany general availability.
        </p>
      </>
    ),
  },
  {
    id: "service",
    title: "What Nellovia provides",
    body: (
      <>
        <p>
          Nellovia is an AI business growth operating system. It combines information you provide with data you
          connect to produce an understanding of your business, diagnoses of what is driving results, recommended
          actions and measurement tools.
        </p>
        <p>
          During the private beta, features are incomplete and may change without notice. What the product does and
          does not support will always be stated in the product itself — we will not market capabilities that are not
          available.
        </p>
      </>
    ),
  },
  {
    id: "account",
    title: "Your account",
    body: (
      <>
        <ul>
          <li>You must be at least 18 years old and provide accurate registration information.</li>
          <li>Keep your password confidential. You are responsible for activity that happens under your account.</li>
          <li>
            Notify us immediately at <strong>security@bizzgrowth.ng</strong> if you suspect unauthorised access.
          </li>
          <li>
            If you accept a team invitation, you join that workspace with the role the owner granted — and the access
            limits that come with it.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "data",
    title: "Your business data",
    body: (
      <>
        <p>
          You own your business data. You grant Nellovia a limited licence to process it for one purpose: operating
          the service for your workspace — producing diagnoses, briefs, reports and outcome measurements.
        </p>
        <ul>
          <li>You can export your data as CSV or PDF, or delete it entirely, at any time from Settings.</li>
          <li>
            If you connect third-party accounts, you confirm you have the right to grant read-only access to that
            data.
          </li>
          <li>
            We never sell your data or use it for advertising, and other customers never see your business
            information.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>Upload content or data you have no right to use, or that is unlawful.</li>
          <li>Attempt to access other workspaces, probe or disrupt the service, or circumvent access controls.</li>
          <li>Misuse the private beta — for example automated scraping, reselling access, or sharing pilot invitations publicly.</li>
        </ul>
        <p>We may suspend accounts that break these rules, with notice where practicable.</p>
      </>
    ),
  },
  {
    id: "ai-outputs",
    title: "AI outputs and business decisions",
    body: (
      <>
        <p>
          Diagnoses, recommendations and summaries are decision support generated from the information available. They
          may be incomplete or wrong. They are not financial, legal or professional advice, and they are not a
          guarantee of results.
        </p>
        <p>
          You remain responsible for the decisions you take. Nellovia reports the outcome of actions with
          attribution confidence and never presents a result as guaranteed cause and effect — we ask that you apply
          the same discipline to major decisions, validating with your own judgement and advisors.
        </p>
      </>
    ),
  },
  {
    id: "availability",
    title: "Availability and changes",
    body: (
      <>
        <p>
          The service is provided as-is during the private beta. There is no uptime commitment. We may change, suspend
          or discontinue features at any time and will try to give reasonable notice for material changes.
        </p>
        <p>
          If we discontinue the beta, we will give you at least 30 days to export your data before anything is
          deleted.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    title: "Disclaimers and liability",
    body: (
      <>
        <p>
          To the fullest extent permitted by law, Nellovia is provided without warranties of any kind, express or
          implied, including fitness for a particular purpose.
        </p>
        <p>
          To the extent permitted by law, our total liability arising from the service is limited to the amount you
          paid us in the 12 months before the claim — during the free beta, that is typically zero. Nothing in these
          terms limits liability that cannot be limited by law.
        </p>
      </>
    ),
  },
  {
    id: "law",
    title: "Governing law and changes",
    body: (
      <>
        <p>
          These terms are governed by the laws of the Federal Republic of Nigeria, with the courts of Lagos State
          having jurisdiction.
        </p>
        <p>
          We may update these terms as the product evolves. Material changes will be communicated in-product or by
          email before they take effect. Continuing to use Nellovia after changes take effect means you accept the
          updated terms.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <>
        <p>
          Questions about these terms: <strong>legal@bizzgrowth.ng</strong> · Nellovia, Victoria Island, Lagos,
          Nigeria.
        </p>
        <p>
          Related documents: our <strong>Privacy Policy</strong> explains how your data is handled, and the{" "}
          <strong>Pricing</strong> page explains what the beta includes.
        </p>
      </>
    ),
  },
];

export default function TermsScreen() {
  return (
    <LegalLayout
      kicker="Legal"
      title="Terms of Service"
      updated="30 September 2026"
      intro="These terms govern your use of Nellovia during the private beta. They cover what the service does, what happens to your data, and where the limits of our responsibility sit."
      sections={SECTIONS}
    />
  );
}
