# ADR 0001: V1 Manual Upload Scope

## Status

Accepted

## Context

The first version of the app must let Shopify merchants manually upload videos, tag Shopify product variants, publish widgets, and collect basic analytics.

## Decision

V1 implements only `MANUAL_UPLOAD` as an active video source. Future social sources are represented in shared enums and interfaces so the data model and service boundaries can evolve without adding active social integrations.

The codebase must not include active Instagram, TikTok, Meta, Facebook, social OAuth, social API keys, social import buttons, Meta Pixel integration, or background social import jobs.

## Consequences

Manual upload can ship faster and with a narrower security surface. Future social import work will require a new ADR, explicit product approval, and separate implementation/tests.
