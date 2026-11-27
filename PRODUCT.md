# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Business owners seeking clearer ways to understand and improve growth, and specialists who want to offer expertise to businesses through Nellovia.

## Product Purpose

Nellovia helps businesses turn scattered business signals into clearer decisions about what changed, why it may have happened, and what to do next. Specialists can offer expertise through the platform.

## Positioning

A continuous loop of understanding, measuring, diagnosing, recommending, acting, and measuring again — not another isolated dashboard.

## North Star: the feeling we want owners to have

> **Everyone working on Nellovia, people and AI agents alike, reads this before building or changing
> anything.** Every feature, prompt, screen and notification must serve it, and must earn it through
> genuine value. If a change doesn't move an owner closer to this feeling, rethink it.

### 1. The fear of missing valuable discoveries

Owners should naturally feel that something important, interesting or useful could have happened
since their last visit. They open Nellovia because they expect to discover something they didn't
know before.

### 2. The confidence that Nellovia will find answers

When owners bring a challenge, they trust that Nellovia will:

- investigate beyond the obvious;
- discover underlying problems they might have overlooked;
- identify opportunities they haven't considered;
- challenge incorrect assumptions, including their own explanation, when their own figures say otherwise;
- recommend practical, evidence-based solutions;
- follow through until meaningful progress is achieved.

### 3. A living business intelligence experience

Nellovia shouldn't feel like a tool that waits for instructions. It should feel like a consultant
who is always thinking, investigating, discovering and connecting what matters to this business.

### 4. Every visit has potential value

When owners return, they should have the chance to discover:

- something new about their business;
- an emerging risk;
- an overlooked opportunity;
- progress on an existing challenge;
- an important market development;
- a recommendation worth considering.

### 5. It remembers, so owners never start over

Everything an owner has told Nellovia carries into every feature: their figures, their challenges,
what they tried and what happened. Owners never have to repeat themselves, and Nellovia never asks
again for something it already knows or claims not to know it.

### 6. Every discovery can be checked

Figures come from the owner's own numbers or a named source, and the working is shown. Maths is
done in code, not guessed by a model. Nellovia says what it doesn't know and what would confirm it.
Owners trust it because they can check it, not because it sounds sure.

### 7. It cares about the person, not just the numbers

When an owner is under pressure (money running out, a payment they can't make, harassment,
exhaustion), Nellovia deals with the urgent thing first. It responds humanely and points to the
right help. It never chases growth tips while the business is in crisis.

### 8. Progress is visible

Owners can see what has changed since they started: challenges solved, numbers that moved, and
what each step taught. Real momentum is part of the value.

### One important distinction: earned, never manufactured

We earn this feeling through genuine value, never artificial engagement. We never use:

- fabricated or recycled "discoveries", or anything presented as new that isn't;
- notifications without new, specific information worth the owner's attention;
- manufactured urgency, countdowns, streaks or guilt;
- generic advice dressed up as personal insight;
- hidden uncertainty to seem impressive.

Quiet is fine: when nothing new has happened, say so plainly.

### How every feature earns it

- Before building or changing anything, ask: after this, what does the owner know that they didn't,
  or what can they now do that they couldn't?
- Ground every claim in their figures or a named source, and compute the maths in code.
- Look beyond the obvious: test assumptions (including the owner's) against their own numbers, and
  connect what they said in one place with what they said in another.
- Close the loop: every recommendation leads to a next step, a check-in and a lesson that shapes
  the next diagnosis.
- Respect attention: speak up when there is something worth saying.
- If a screen or flow misleads or underwhelms, change it.

### How we'll know

- Owners say "it told me something I didn't know", and "it was right".
- A return visit surfaces something new and specific whenever there is something, and says so
  honestly when there isn't.
- Recommendations get acted on, and challenges move.
- The AI quality test (`docs/ai-quality-test-plan.md`) finds no fabricated figures or discoveries.

### The ultimate ambition

Nellovia becomes an indispensable business companion that owners don't want to be disconnected
from, because they genuinely believe staying connected makes them better informed, better prepared
and better equipped to succeed.

## Operating Context

The public website serves prospective business users and specialists. Early-access requests are reviewed by platform administrators.

## Capabilities and Constraints

- The application is a Next.js and TypeScript web app backed by Neon PostgreSQL.
- Waiting-list submissions are early-access requests only; they do not create user accounts.
- Business requests collect a name, email, business name, and industry. Specialist requests collect a name, email, specialty, and experience.
- Submission details are used to manage the early-access list and are visible to platform administrators.

## Brand Commitments

Preserve the Nellovia name and the existing public brand and interface patterns.

## Product Principles

- Make business decisions clearer by grounding interpretation in available evidence.
- Keep user control and privacy explicit.
- Distinguish requests for early access from registered accounts.
