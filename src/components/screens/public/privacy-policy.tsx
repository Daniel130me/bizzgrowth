"use client";
// Screen 9 — Privacy Policy.

import React from "react";
import { LegalLayout, type LegalSection } from "./legal-shared";

const SECTIONS: LegalSection[] = [
  {
    id: "collection",
    title: "Information we collect",
    body: (
      <>
        <p>
          Nellovia collects the minimum information needed to understand your business and operate your workspace.
          We collect three kinds of information:
        </p>
        <ul>
          <li>
            <strong>Account details.</strong> Your name, email address, business name and role when you create an
            account or accept a team invitation.
          </li>
          <li>
            <strong>Early-access requests.</strong> Your name, email address and the business or specialist details
            you submit for the waiting list. A request does not create an account.
          </li>
          <li>
            <strong>Business data you provide.</strong> Aggregate figures you enter yourself — monthly marketing
            spend, enquiries, customers, revenue and similar totals — plus notes from your onboarding conversation.
          </li>
          <li>
            <strong>Connected source data.</strong> If you connect ad platforms, store accounts or analytics tools, we
            read performance data through their official APIs. Connections are read-only; Nellovia never changes
            anything in your accounts.
          </li>
        </ul>
        <p>
          During the private beta we also collect product usage data — which screens you use and the feedback you
          send — to improve the product.
        </p>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use your information",
    body: (
      <>
        <p>Your information is used to run the service and nothing else:</p>
        <ul>
          <li>To produce your business understanding, diagnoses, recommendations and weekly or monthly briefs.</li>
          <li>To show how your results change over time and measure the outcome of actions you take.</li>
          <li>To communicate with you — briefs, alerts, team invitations and account notices.</li>
          <li>To manage the early-access list and share relevant updates about getting started.</li>
          <li>To improve diagnosis quality during the private beta.</li>
        </ul>
        <p>
          We do not sell your data, and we do not use it for advertising. We do not share your business data with
          other customers; industry comparisons are anonymised and aggregated before they are ever shown to anyone.
        </p>
      </>
    ),
  },
  {
    id: "ai",
    title: "AI processing",
    body: (
      <>
        <p>
          Diagnoses, root-cause explanations, recommendations and summaries are produced by AI reasoning over the data
          you supply and connect. Three commitments apply:
        </p>
        <ul>
          <li>
            <strong>Labelling.</strong> AI conclusions are always marked as AI interpretation, shown with a confidence
            level and the evidence behind them. They are decision support, not measured fact.
          </li>
          <li>
            <strong>No training on your data.</strong> During the private beta, your business data is not used to
            train models without your explicit permission.
          </li>
          <li>
            <strong>Review.</strong> Anonymised diagnoses may be inspected by the team to improve quality. You can opt
            out of this review at any time by contacting us.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "provenance",
    title: "Data provenance",
    body: (
      <>
        <p>
          Every important figure in Nellovia carries a provenance label so you can always tell what is known from
          what is interpreted:
        </p>
        <ul>
          <li>
            <strong>Measured</strong> — retrieved directly from a connected source.
          </li>
          <li>
            <strong>User supplied</strong> — entered manually by you or your team.
          </li>
          <li>
            <strong>Estimated</strong> — approximate, or calculated from other values.
          </li>
          <li>
            <strong>AI interpretation</strong> — a conclusion produced by reasoning, never presented as raw data.
          </li>
        </ul>
        <p>
          This exists so you can challenge any conclusion. If a diagnosis doesn&apos;t match what you see on the
          ground, the provenance trail shows you exactly which facts it was built on.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "Retention",
    body: (
      <>
        <ul>
          <li>
            We keep your workspace data while your account is active so your history, briefs and timeline stay intact.
          </li>
          <li>
            If you delete your workspace or close your account, we delete your business data within 30 days. Backup
            copies are removed within 90 days.
          </li>
          <li>
            Disconnecting an integration stops new data immediately; previously read data is deleted on request.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "rights",
    title: "Your rights: export and delete",
    body: (
      <>
        <p>You stay in control of your data. Specifically:</p>
        <ul>
          <li>
            <strong>Export.</strong> Download your entered data, briefs and reports as CSV or PDF from Settings →
            Export / delete.
          </li>
          <li>
            <strong>Delete.</strong> Remove your workspace data or close your account entirely. Deletion is permanent
            once the confirmation window passes.
          </li>
          <li>
            <strong>Access and correction.</strong> View or correct anything we hold about your account from Settings,
            or by contacting us.
          </li>
          <li>
            <strong>Revocation.</strong> Disconnect any integration at any time; read-only access ends immediately.
          </li>
        </ul>
        <p>
          Nigerian residents may also exercise rights under the Nigeria Data Protection Act 2023 by writing to us; we
          will acknowledge within 72 hours and respond substantively within 30 days.
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
          Questions, requests or complaints about this policy or your data: <strong>privacy@bizzgrowth.ng</strong>. We
          respond within five working days.
        </p>
        <p>Nellovia · Victoria Island, Lagos, Nigeria.</p>
      </>
    ),
  },
];

export default function PrivacyPolicyScreen() {
  return (
    <LegalLayout
      kicker="Legal"
      title="Privacy Policy"
      updated="30 September 2026"
      intro="This policy explains what information Nellovia collects, how it is used and the controls you have. It is written for the private beta; a full data protection agreement will accompany general availability. The plain language below is the version that governs this prototype."
      sections={SECTIONS}
    />
  );
}
