# Additive production SQL

This repository intentionally models only part of the shared PostgreSQL database. Do not use `prisma db push` or `prisma migrate` against production because either command can remove tables that are outside `prisma/schema.prisma`.

Apply the numbered SQL files in ascending order through the controlled database release process. Each file is written to be additive and safe to re-run where PostgreSQL supports `IF NOT EXISTS`.

For the specialist marketplace journey, apply `006_marketplace_v2.sql` before deploying the application code. It adds specialist-account linkage, onboarding and review state, invitations, engagements, messages, reviews, notifications, constraints, and query indexes. Take a database backup and run the file in a staging environment first.

After applying a file, record it in the deployment log used by the hosting environment. Do not place database credentials or query output in this directory.
