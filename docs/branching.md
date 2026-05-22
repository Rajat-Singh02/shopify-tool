# Branching Model

This repository uses release lanes. The repository is split by folders and packages, not by branch-specific code ownership.

## Long-Lived Branches

### `prod`

Production release branch. Vercel Production should be connected to this branch.

Recommended protections:

- Require pull requests before merge.
- Require passing CI.
- Require review.
- Require linear history.
- Block force pushes.
- Block direct pushes where permissions allow.

### `main`

Default integration branch. Completed lane work lands here before promotion to `prod`.

Recommended protections:

- Require pull requests before merge.
- Require passing CI.
- Require linear history.

### `backend`

Backend integration lane for backend-heavy work before it is promoted to `main`.

Recommended protections:

- Require passing CI.
- Prefer squash merge.

### `frontend`

Frontend integration lane for frontend-heavy work before it is promoted to `main`.

Recommended protections:

- Require passing CI.
- Prefer squash merge.

### `dev`

Legacy integration branch. Do not target new PRs here.

Keep this branch temporarily for repository history and transition safety. It should not receive new feature, lane, or release-promotion work.

## Short-Lived Branches

All implementation work must happen on short-lived `feature/*` branches.

Preferred flow:

- Backend-heavy work: `feature/<small-task>` -> `backend` -> `main` -> `prod`
- Frontend-heavy work: `feature/<small-task>` -> `frontend` -> `main` -> `prod`
- Cross-cutting infrastructure, test, deployment, or full-stack slices: `feature/<small-task>` -> `main` -> `prod`

Do not create a long-lived branch named `feature`.

## Scope Discipline

Keep PRs small and reviewable. Do not combine infrastructure, backend feature work, frontend feature work, and deployment changes unless the PR is explicitly scoped as a full-stack slice.

The v1 product scope is manual video upload only. Do not add active Meta, Instagram, TikTok, Facebook, social OAuth, social API keys, social import buttons, or backend social fetch jobs.
