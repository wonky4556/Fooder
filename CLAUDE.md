# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Fooder is a food ordering app (admin portal + customer site) built as a pnpm monorepo on AWS (DynamoDB, Lambda, API Gateway, Cognito, S3+CloudFront, KMS). Node 22 required.

## Monorepo Layout

- `packages/shared-types/` — Domain types (user, menu, schedule, order, cart, API responses)
- `packages/shared-ui/` — Shared React components (not yet scaffolded)
- `apps/admin/` — Admin management portal (not yet scaffolded)
- `apps/customer/` — Customer ordering site (not yet scaffolded)
- `api/` — Lambda handlers (not yet scaffolded)
- `infra/` — AWS CDK infrastructure (Phase 1 complete: DynamoDB tables, KMS key)

## Commands

```bash
# Install dependencies
pnpm install

# Build all packages (must build shared-types first for downstream consumers)
pnpm -w run build
pnpm -w run build:types          # build shared-types only

# Run all tests
pnpm -w run test

# Run tests for a specific workspace
pnpm -w run test:infra           # CDK infrastructure tests
pnpm -w run test:api
pnpm -w run test:admin
pnpm -w run test:customer
pnpm -w run test:shared-ui

# Run a single test file directly
cd infra && pnpm vitest run test/database.test.ts

# Watch mode for infra tests
cd infra && pnpm test:watch

# Dev servers (when scaffolded)
pnpm -w run dev:admin
pnpm -w run dev:customer
```

## Key Architecture Decisions

**CDK**: Uses `tsx` (not `ts-node`) for Node 22 ESM compatibility. Entry point: `infra/bin/fooder.ts`. Two stacks per stage:
- `Fooder-{Stage}-InfraStack` — DynamoDB tables, KMS key, SSM parameter exports (manual deploy via `workflow_dispatch`)
- `Fooder-{Stage}-AppStack` — API, frontends (auto-deployed by CI/CD)

**DynamoDB**: All tables use single-table-ish design with `tenantId` as partition key. PAY_PER_REQUEST billing, point-in-time recovery enabled. Key tables: UsersTable, MenuItemsTable, SchedulesTable, OrdersTable — each with purpose-specific GSIs.

**PII Handling**: Emails stored as SHA-256 hash (for GSI lookups) + AES-256 encrypted copy (for display). Display names encrypted. KMS envelope encryption via `alias/fooder/DEFAULT/pii` key.

**TypeScript**: Base config at `tsconfig.base.json` (ES2022, ESNext modules, bundler resolution, strict). Each workspace extends it.

## Testing

TDD approach: write failing tests first, then implement. Infrastructure tests use CDK Assertions (`Template.fromStack`, `hasResourceProperties`). Backend tests use Vitest with mocked AWS SDK clients. Target: 80% backend, 70% frontend coverage.

## Git

Remote is named `Fooder` (not `origin`): `git push Fooder main`

## pnpm Workspace Gotchas

- Root scripts: use `pnpm -w run <script>`, not `pnpm <script>`
- Filter syntax: `pnpm --filter @fooder/<package> <command>`
- `pnpm-workspace.yaml` has `onlyBuiltDependencies: [esbuild]`

## CDK Gotchas

- Use `pointInTimeRecoverySpecification` (not deprecated `pointInTimeRecovery`)
- Don't import `source-map-support/register` — tsx handles this
- Default region: `us-east-1`

## CI/CD Pipeline

Two-environment strategy: DEV (auto-deploy on merge to main) and PROD (deploy on git tag `v*`).

### Workflows
- **CI** (`.github/workflows/ci.yml`) — Runs on all PRs and pushes to main: build, test, cdk synth
- **Deploy DEV** (`.github/workflows/deploy-dev.yml`) — Auto-deploys `Fooder-Dev-AppStack` on merge to main (path-filtered). Manual `workflow_dispatch` with `deploy_infra=true` for infra changes.
- **Deploy PROD** (`.github/workflows/deploy-prod.yml`) — Deploys `Fooder-Prod-AppStack` on tag push (`v*`). Manual `workflow_dispatch` with `deploy_infra=true` for infra changes (requires environment approval).

### CDK Deploy Commands
```bash
# DEV
cd infra && npx cdk deploy Fooder-Dev-InfraStack -c stage=dev
cd infra && npx cdk deploy Fooder-Dev-AppStack -c stage=dev

# PROD
cd infra && npx cdk deploy Fooder-Prod-InfraStack -c stage=prod
cd infra && npx cdk deploy Fooder-Prod-AppStack -c stage=prod

# Synth both stages
cd infra && npx cdk synth -c stage=dev
cd infra && npx cdk synth -c stage=prod
```

### Release Process
1. Merge to main → DEV auto-deploys
2. QA on DEV
3. `git tag v1.x.x && git push Fooder v1.x.x` → PROD deploys

### GitHub Secrets Required
- `AWS_DEV_DEPLOY_ROLE_ARN` / `AWS_PROD_DEPLOY_ROLE_ARN` — OIDC role ARNs
- `DEV_COGNITO_*` / `PROD_COGNITO_*` — Cognito config (Phase 2+)

## Phase Status

- **Phase 1**: COMPLETE (scaffolding, shared types, DynamoDB tables, KMS key, 12 CDK tests passing)
- **CI/CD**: COMPLETE (GitHub Actions: CI, DEV deploy, PROD deploy; stack split into InfraStack + AppStack)
- **Phase 2**: NOT STARTED (Authentication — Cognito)
- **Phases 3-6**: NOT STARTED (API, admin frontend, customer frontend, deployment)

## Documentation
- Update prd.md with status of phases and completion of steps
- Create plan files for approved plans during plan mode

## Version Control
- Do not push directly to main branch. 
- Always create a new branch for changes and open a PR unless addressing comments directly on a branch that already has a PR open.