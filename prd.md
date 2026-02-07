# Fooder - Food Ordering App - Product Requirements & Implementation Plan

## Architecture Overview

**Monorepo** (pnpm workspaces):
- `apps/admin` - Management portal (Vite + React + TailwindCSS)
- `apps/customer` - Customer site (Vite + React + TailwindCSS)
- `packages/shared-ui` - Shared React component library
- `packages/shared-types` - Shared TypeScript types
- `api/` - Lambda function handlers (TypeScript)
- `infra/` - AWS CDK infrastructure

**AWS Services (Free Tier):**
- API Gateway REST API (1M calls/mo free)
- Lambda (1M requests/mo free)
- DynamoDB on-demand (25GB storage, 25 RCU/WCU free)
- Cognito Lite tier (10K MAU free, permanent)
- S3 + CloudFront (5GB storage, 1TB transfer free)
- KMS (20K free API calls/mo for PII encryption)

**Frontend Stack:** React 19, React Router 7, TanStack Query 5, Zustand 5 (customer cart), react-hook-form 7, Zod, Axios, TailwindCSS v4, aws-amplify v6 (auth only)

**Backend Stack:** TypeScript Lambda handlers, AWS SDK v3, Zod validation, ULID for IDs, esbuild bundling via CDK NodejsFunction

---

## Testing Strategy

### Approach: Test-Driven Development (TDD)

For each phase, tests are written **before** implementation. The workflow is:
1. Write failing tests that define expected behavior
2. Implement the minimum code to make tests pass
3. Refactor while keeping tests green
4. Run manual validation steps
5. **Wait for user confirmation** before proceeding to next phase

### Testing Frameworks

| Layer | Framework | Key Packages |
|-------|-----------|-------------|
| Backend (Lambda handlers) | Vitest | `vitest`, `@aws-sdk/client-dynamodb-mock` (custom mocks) |
| Backend (middleware) | Vitest | `vitest` |
| Backend (crypto/validation) | Vitest | `vitest` |
| Infrastructure (CDK) | CDK Assertions | `aws-cdk-lib/assertions` (built-in) |
| Frontend (components) | Vitest + Testing Library | `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` |
| Frontend (hooks/stores) | Vitest | `vitest`, `@testing-library/react` (renderHook) |

### Test Configuration
- `vitest.config.ts` at root and per-package for workspace-aware testing
- `pnpm test` runs all tests across the monorepo
- `pnpm test:api` / `pnpm test:admin` / `pnpm test:customer` / `pnpm test:infra` for scoped runs
- Coverage thresholds: 80% for backend, 70% for frontend

### Mocking Strategy
- **DynamoDB**: Mock `DynamoDBDocumentClient.send()` using vitest `vi.mock()`. Each test provides expected input/output for `PutCommand`, `GetCommand`, `QueryCommand`, etc.
- **KMS**: Mock `KMSClient.send()` — `encryptPII` returns predictable base64, `decryptPII` returns original plaintext
- **Cognito events**: Use typed fixtures for `PostConfirmationConfirmSignUpTriggerEvent`
- **API Gateway events**: Factory function `createMockApiEvent({ method, path, body, claims })` for building `APIGatewayProxyEvent` objects
- **React components**: Mock API client with `msw` (Mock Service Worker) or inline vitest mocks on TanStack Query hooks
- **Zustand stores**: Test directly by calling actions and asserting state

---

## Data Privacy: PII Handling

**Principle**: No plaintext human identifiers stored in DynamoDB. All PII is either hashed (for lookup) or encrypted (for display).

### Approach: Hash for Lookup, Encrypt for Display

- **emailHash**: SHA-256 of lowercased, trimmed email. Used as GSI key for user lookup. One-way — cannot recover email from hash.
- **encryptedEmail**: AES-256 envelope encryption using AWS KMS. Stored alongside the hash. Decrypted at the API layer when PII needs to be displayed (e.g., admin viewing order details).
- **encryptedDisplayName**: Same encryption approach for user display names.
- **Admin role assignment**: Admin emails are configured as hashes in env var `ADMIN_EMAIL_HASHES`. Post-confirmation Lambda hashes the incoming email and compares against the list.

### KMS Key Setup
- One KMS symmetric key per tenant (initially one for `DEFAULT` tenant)
- Key alias: `alias/fooder/{tenantId}/pii`
- Lambda functions get `kms:Encrypt` and `kms:Decrypt` permissions
- 20K free KMS API calls/month is sufficient for this scale

### PII Encryption Utility
```typescript
// api/src/lib/crypto.ts
// - hashEmail(email: string): string — SHA-256 hex digest
// - encryptPII(plaintext: string, tenantId: string): Promise<string> — KMS envelope encrypt, returns base64
// - decryptPII(ciphertext: string, tenantId: string): Promise<string> — KMS envelope decrypt
```

### Where PII Appears
| Location | Field | Storage |
|----------|-------|---------|
| Users table | email | `emailHash` (GSI) + `encryptedEmail` |
| Users table | displayName | `encryptedDisplayName` |
| Orders table | userEmail | `encryptedUserEmail` |
| Orders table | userDisplayName | `encryptedUserDisplayName` |
| Cognito | email, name | Managed by Cognito (not our DB) |

**Order display flow**: Admin views orders → API fetches order → decrypts `encryptedUserEmail` and `encryptedUserDisplayName` → returns plaintext to authorized admin only.

---

## DynamoDB Tables

### Users Table
- **PK**: `tenantId` — Partition key
- **SK**: `userId` (Cognito sub) — Sort key
- Attributes: emailHash, encryptedEmail, encryptedDisplayName, role (`admin`|`customer`), createdAt, updatedAt
- **GSI `email-hash-index`**: PK: `emailHash` — lookup user by hashed email (cross-tenant uniqueness check)

### MenuItems Table
- **PK**: `tenantId`
- **SK**: `menuItemId` (ULID)
- Attributes: name, description, price, imageUrl, category, isActive, createdAt, updatedAt

### Schedules Table
- **PK**: `tenantId`
- **SK**: `scheduleId` (ULID)
- Attributes: title, description, pickupInstructions, startTime, endTime, status (`draft`|`active`|`closed`), items (list of `{menuItemId, name, price, totalQuantity, remainingQuantity}`), createdAt, updatedAt
- **GSI `schedule-status-index`**: PK: `tenantId`, SK: `status#startTime` — query active schedules efficiently

**Design note**: Schedule items are embedded as a list (denormalized). Menu item names/prices are snapshot at schedule creation time. `remainingQuantity` is decremented atomically via DynamoDB condition expressions.

### Orders Table
- **PK**: `tenantId#scheduleId` — composite partition for schedule-scoped queries
- **SK**: `orderId` (ULID)
- Attributes: userId, encryptedUserEmail, encryptedUserDisplayName, items (list of `{menuItemId, name, price, quantity}`), totalPrice, status (`pending`|`confirmed`|`fulfilled`|`cancelled`), pickupInstructions, notes, createdAt, updatedAt, fulfilledAt
- **GSI `user-orders-index`**: PK: `tenantId#userId`, SK: `createdAt` — list a user's orders
- **GSI `order-status-index`**: PK: `tenantId`, SK: `status#createdAt` — admin filter by status

---

## API Endpoints

### Auth
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| POST | /auth/post-confirmation | Cognito trigger | Creates user in DynamoDB (hashed/encrypted PII) |
| GET | /api/me | User | Returns current user profile (decrypts PII) |

### Menu Items (Admin only)
| Method | Path | Handler |
|--------|------|---------|
| POST | /api/menu-items | createMenuItem |
| GET | /api/menu-items | listMenuItems |
| GET | /api/menu-items/:id | getMenuItem |
| PUT | /api/menu-items/:id | updateMenuItem |
| DELETE | /api/menu-items/:id | deleteMenuItem |

### Schedules
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| POST | /api/schedules | Admin | createSchedule |
| GET | /api/schedules | User | listSchedules (admin: all, customer: active only) |
| GET | /api/schedules/:id | User | getSchedule |
| PUT | /api/schedules/:id | Admin | updateSchedule |
| DELETE | /api/schedules/:id | Admin | deleteSchedule |

### Orders
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| POST | /api/orders | User | createOrder (atomic quantity decrement) |
| GET | /api/orders | Admin | listOrders (filterable by schedule/status, decrypts PII) |
| GET | /api/orders/mine | User | listMyOrders |
| GET | /api/orders/:id | User | getOrder (admin: any + decrypted PII, customer: own only) |
| PUT | /api/orders/:id/fulfill | Admin | fulfillOrder |
| PUT | /api/orders/:id/cancel | Admin | cancelOrder (restores quantities) |

---

## Authentication Flow

1. Cognito User Pool with Google as federated identity provider
2. Cognito Hosted UI for login (redirect-based OAuth flow)
3. Frontend uses `aws-amplify` Auth module for token management
4. API Gateway uses Cognito Authorizer to validate JWTs
5. Post-confirmation Lambda trigger:
   - Hashes email → `emailHash`
   - Encrypts email and display name via KMS
   - Compares emailHash against `ADMIN_EMAIL_HASHES` env var for role assignment
   - Creates user record in DynamoDB with `tenantId=DEFAULT`
6. `withAuth` middleware extracts `userId` and `tenantId` from JWT claims + DynamoDB lookup
7. `withAdminAuth` middleware additionally verifies `role=admin`

---

## Lambda Handler Pattern

Composable middleware chain:
```
withErrorHandling(withAdminAuth(withValidation(schema)(handler)))
```

- `withErrorHandling` — catches AppError subclasses, maps to HTTP responses, logs errors
- `withAuth` — extracts userId from Cognito JWT claims, fetches user from DynamoDB, injects tenantId/role into event
- `withAdminAuth` — extends withAuth, rejects if role !== admin
- `withValidation(schema)` — validates request body against Zod schema

---

## Ordering Logic (Critical Path)

`createOrder` uses DynamoDB `TransactWriteItems` for atomic all-or-nothing execution:

1. Validate schedule is active (`startTime <= now <= endTime`)
2. Validate all items exist in the schedule with sufficient remaining quantity
3. Build transaction:
   - For each cart item: `UpdateItem` on Schedules table decrementing `items[i].remainingQuantity` with condition `remainingQuantity >= requestedQty`
   - `PutItem` the new Order document (with encrypted user PII)
4. Execute transaction
5. If `TransactionCanceledException` → return 409 with details on which items were unavailable
6. On success → return created order with orderId

---

## Frontend Architecture

### State Management
- **Server state**: TanStack Query (caching, background refetching, optimistic updates)
- **Client state (cart)**: Zustand store in customer app, persisted to localStorage
- **Auth state**: React Context via AuthProvider

### API Client
- Axios instance with interceptor that attaches Cognito ID token to Authorization header
- TanStack Query hooks wrapping each API endpoint
- Automatic retry on 401 (token refresh)

### Shared UI Components (`packages/shared-ui`)
- Button, Card, Input, Modal, Badge, Spinner, EmptyState
- Layout: Header, PageContainer
- Built with TailwindCSS, published as library via Vite library mode

### Admin App Pages
- Dashboard (summary cards, quick links)
- MenuItems (list/grid, add/edit/delete)
- MenuItemForm (create/edit with react-hook-form + Zod)
- Schedules (list with status badges)
- ScheduleForm (date/time pickers, multi-select items, set quantities)
- ScheduleDetail (items, remaining quantities, activate/close)
- Orders (filterable table by schedule/status)
- OrderDetail (full info, mark fulfilled/cancel)

### Customer App Pages
- Home (active schedules list)
- ScheduleView (items with prices, remaining quantities, add-to-cart, countdown timer)
- Cart (quantity adjusters, total, place order, notes field)
- OrderConfirmation (summary, pickup instructions, status)
- MyOrders (order history with status badges)
- Login

---

## CDK Infrastructure

### Stacks/Constructs
Two stacks per stage (`dev` / `prod`):
- `Fooder-{Stage}-InfraStack` — Infrastructure (manual deploy only)
  - `DatabaseConstruct` — 4 DynamoDB tables with GSIs, on-demand billing
  - `KmsConstruct` — KMS key for PII encryption
  - SSM parameter exports for cross-stack references
- `Fooder-{Stage}-AppStack` — Application (auto-deployed by CI/CD)
  - `AuthConstruct` — Cognito User Pool, Google IdP, User Pool Client, Hosted UI domain, post-confirmation Lambda
  - `ApiConstruct` — API Gateway REST API, Cognito Authorizer, Lambda functions per handler, IAM roles
  - `FrontendConstruct` — S3 buckets + CloudFront distributions for admin and customer apps

### CI/CD Pipeline (COMPLETE)
- **CI**: GitHub Actions on all PRs and pushes to main — build, test, cdk synth
- **DEV Deploy**: Auto-deploys `AppStack` on merge to main (path-filtered). Manual `workflow_dispatch` for infra.
- **PROD Deploy**: Deploys `AppStack` on git tag (`v*`). Manual `workflow_dispatch` for infra with environment approval.
- **OIDC Auth**: GitHub Actions assumes IAM roles via OIDC (no static credentials)

### GitHub Secrets Required

The following secrets must be configured in the GitHub repository settings (Settings > Secrets and variables > Actions) for the deploy workflows to succeed.

#### AWS OIDC Deployment Roles (Phase 1+)

| Secret | Description |
|--------|-------------|
| `AWS_DEV_DEPLOY_ROLE_ARN` | IAM role ARN for DEV deployments, assumed via OIDC |
| `AWS_PROD_DEPLOY_ROLE_ARN` | IAM role ARN for PROD deployments, assumed via OIDC |

#### Google OAuth Credentials (Phase 2+)

These are passed as CDK context values when deploying the AppStack. They configure the Cognito User Pool's Google identity provider.

| Secret | Description |
|--------|-------------|
| `DEV_GOOGLE_CLIENT_ID` | Google OAuth client ID for DEV environment |
| `DEV_GOOGLE_CLIENT_SECRET` | Google OAuth client secret for DEV environment |
| `DEV_ADMIN_EMAIL_HASHES` | Comma-separated SHA-256 hashes of admin email addresses for DEV |
| `PROD_GOOGLE_CLIENT_ID` | Google OAuth client ID for PROD environment |
| `PROD_GOOGLE_CLIENT_SECRET` | Google OAuth client secret for PROD environment |
| `PROD_ADMIN_EMAIL_HASHES` | Comma-separated SHA-256 hashes of admin email addresses for PROD |

#### Cognito Configuration (Phase 2+, populated after first AppStack deploy)

These are used as Vite build-time environment variables when building the frontend apps in CI.

| Secret | Description |
|--------|-------------|
| `DEV_COGNITO_USER_POOL_ID` | Cognito User Pool ID from DEV AppStack outputs |
| `DEV_COGNITO_CLIENT_ID` | Cognito User Pool Client ID from DEV AppStack outputs |
| `DEV_COGNITO_DOMAIN` | Cognito Hosted UI domain for DEV (e.g. `fooder-dev.auth.us-east-1.amazoncognito.com`) |
| `PROD_COGNITO_USER_POOL_ID` | Cognito User Pool ID from PROD AppStack outputs |
| `PROD_COGNITO_CLIENT_ID` | Cognito User Pool Client ID from PROD AppStack outputs |
| `PROD_COGNITO_DOMAIN` | Cognito Hosted UI domain for PROD |

### Manual Setup Steps (Phase 2)

These steps must be completed before the CI/CD pipeline can deploy the AppStack with authentication.

#### 1. Create Google Cloud OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Navigate to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth client ID**
5. Application type: **Web application**
6. Authorized redirect URIs — add:
   - `https://fooder-dev.auth.us-east-1.amazoncognito.com/oauth2/idpresponse` (DEV)
   - `https://fooder-prod.auth.us-east-1.amazoncognito.com/oauth2/idpresponse` (PROD)
   - `http://localhost:5173/auth/callback` (local development)
7. Copy the **Client ID** and **Client Secret**
8. Set as GitHub secrets: `DEV_GOOGLE_CLIENT_ID`, `DEV_GOOGLE_CLIENT_SECRET`, `PROD_GOOGLE_CLIENT_ID`, `PROD_GOOGLE_CLIENT_SECRET`

**Note**: You can use the same Google OAuth app for both DEV and PROD (just add both redirect URIs), or create separate apps for isolation.

#### 2. Generate Admin Email Hashes

Admin role assignment is based on SHA-256 hashes of email addresses (compared at user registration time).

```bash
# Generate the hash for an admin email:
echo -n "admin@example.com" | tr '[:upper:]' '[:lower:]' | tr -d ' ' | shasum -a 256 | cut -d' ' -f1

# For multiple admins, comma-separate:
# hash1,hash2,hash3
```

Set as GitHub secrets: `DEV_ADMIN_EMAIL_HASHES`, `PROD_ADMIN_EMAIL_HASHES`

#### 3. Deploy AppStack and Collect Cognito Outputs

After the first successful AppStack deployment (which creates the Cognito resources):

```bash
# Get outputs from the deployed stack
aws cloudformation describe-stacks \
  --stack-name Fooder-Dev-AppStack \
  --query "Stacks[0].Outputs" --output table

# You need:
#   AuthUserPoolId      → DEV_COGNITO_USER_POOL_ID
#   AuthUserPoolClientId → DEV_COGNITO_CLIENT_ID
#   Cognito domain      → DEV_COGNITO_DOMAIN (format: fooder-dev.auth.us-east-1.amazoncognito.com)
```

Set these values as GitHub secrets so subsequent deploys can build the frontend apps with the correct Cognito configuration.

**Bootstrap order for a fresh environment:**
1. Set Google OAuth + admin hash secrets
2. Trigger AppStack deploy (manually or via merge) — this creates Cognito resources
3. Collect Cognito outputs from CloudFormation
4. Set Cognito secrets
5. Future deploys will build and deploy frontend apps with correct auth config

---

## Extensibility Hooks (Designed For, Not Implemented)

- **Payments**: `totalPrice` on orders. Add `paymentStatus` field + Stripe integration to order flow.
- **Multi-tenancy**: `tenantId` on every entity. Tables partitioned by tenant. KMS key per tenant. Middleware extracts tenant from user. Currently defaults to `DEFAULT`.
- **Notifications**: After order creation, publish to SNS topic → fan out to SES/SMS/WhatsApp subscribers.
- **Order confirmations**: SES triggered from order creation Lambda or SNS subscriber.

---

## Implementation Phases

### Phase 1: Project Scaffolding + Infrastructure
**Goal**: Monorepo set up, shared types defined, DynamoDB tables deployed.

**Step 1 — Write tests first:**
- `infra/test/database.test.ts` — CDK assertions:
  - Users table exists with `tenantId` PK, `userId` SK, on-demand billing, `email-hash-index` GSI
  - MenuItems table exists with `tenantId` PK, `menuItemId` SK, on-demand billing
  - Schedules table exists with `tenantId` PK, `scheduleId` SK, `schedule-status-index` GSI
  - Orders table exists with composite PK `tenantId#scheduleId`, `orderId` SK, `user-orders-index` and `order-status-index` GSIs
  - All tables have point-in-time recovery enabled
  - All tables use PAY_PER_REQUEST billing
- `infra/test/kms.test.ts` — CDK assertions:
  - KMS key exists with alias `alias/fooder/DEFAULT/pii`
  - Key rotation is enabled

**Step 2 — Implement:**
- `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.nvmrc`
- `packages/shared-types/package.json`, `tsconfig.json`
- `packages/shared-types/src/index.ts`, `user.ts`, `menu.ts`, `schedule.ts`, `order.ts`, `cart.ts`, `api.ts`
- `infra/package.json`, `tsconfig.json`, `cdk.json`, `vitest.config.ts`
- `infra/bin/fooder.ts`
- `infra/lib/fooder-stack.ts`
- `infra/lib/constructs/database.ts`
- `infra/lib/constructs/kms.ts`

**Step 3 — Run tests:** `pnpm test:infra` — all CDK assertions pass

**Step 4 — Manual validation (wait for user confirmation):**
- [X] `pnpm install` completes without errors
- [X] `pnpm build:types` compiles shared types successfully
- [X] `cd infra && npx cdk synth` generates valid CloudFormation template
- [X] Review CloudFormation output: confirm 4 DynamoDB tables, GSIs, KMS key
- [X] All tests pass: `pnpm test:infra`

**Step 5 — Deploy to AWS:**
```bash
# Prerequisites: AWS CLI configured with credentials (aws configure)
# Ensure CDK is bootstrapped in target account/region (one-time)
cd infra && npx cdk bootstrap

# Preview changes before deploying
npx cdk diff

# Deploy the stack (DynamoDB tables + KMS key)
npx cdk deploy --require-approval broadening

# Verify deployment
aws dynamodb list-tables --query 'TableNames[?starts_with(@, `Fooder`)]'
aws kms list-aliases --query 'Aliases[?starts_with(AliasName, `alias/fooder`)]'
```
- [ ] `cdk bootstrap` completes (first time only)
- [ ] `cdk deploy` succeeds — 4 DynamoDB tables and KMS key created
- [ ] Verify tables exist in AWS Console or via CLI
- [ ] Verify KMS key alias `alias/fooder/DEFAULT/pii` exists

**CHECKPOINT: Wait for user confirmation before proceeding to Phase 2.**

### Phase 2: Authentication
**Goal**: Users can log in with Google, user records created in DynamoDB with hashed/encrypted PII.

**Prerequisite**: Create Google Cloud OAuth credentials manually at console.cloud.google.com.

**Step 1 — Write tests first:**

Backend tests:
- `api/src/lib/__tests__/crypto.test.ts`:
  - `hashEmail` produces consistent SHA-256 hex for same input
  - `hashEmail` is case-insensitive (lowercases before hashing)
  - `hashEmail` trims whitespace
  - `encryptPII` calls KMS encrypt and returns base64 string
  - `decryptPII` calls KMS decrypt and returns original plaintext
  - `encryptPII` → `decryptPII` roundtrip preserves original value
- `api/src/lib/__tests__/errors.test.ts`:
  - Each error subclass has correct statusCode and code
- `api/src/lib/__tests__/response.test.ts`:
  - `success()` returns correct status code, JSON body, CORS headers
  - `error()` returns correct error format
- `api/src/middleware/__tests__/withErrorHandling.test.ts`:
  - Catches `AppError` and maps to correct HTTP response
  - Catches unknown errors and returns 500
  - Passes through successful responses unchanged
- `api/src/middleware/__tests__/withValidation.test.ts`:
  - Rejects invalid body with 400
  - Passes valid body to inner handler
- `api/src/middleware/__tests__/withAuth.test.ts`:
  - Extracts userId from Cognito JWT claims
  - Rejects missing/invalid claims with 401
  - Injects user record (tenantId, role) into event context
- `api/src/middleware/__tests__/withAdminAuth.test.ts`:
  - Allows admin role through
  - Rejects customer role with 403
- `api/src/handlers/auth/__tests__/postConfirmation.test.ts`:
  - Creates user in DynamoDB with hashed email, encrypted PII
  - Assigns admin role when emailHash matches ADMIN_EMAIL_HASHES
  - Assigns customer role for non-admin emails
  - Idempotent: does not overwrite existing user
  - Sets tenantId to DEFAULT
- `api/src/handlers/auth/__tests__/getMe.test.ts`:
  - Returns decrypted user profile for authenticated user
  - Returns 401 for unauthenticated request

Infrastructure tests:
- `infra/test/auth.test.ts` — CDK assertions:
  - Cognito User Pool exists with Google IdP configured
  - User Pool Client exists with correct OAuth scopes and callback URLs
  - Post-confirmation Lambda trigger is attached
  - Lambda has permissions to write to Users table and use KMS key

Frontend tests:
- `apps/admin/src/auth/__tests__/AuthProvider.test.tsx`:
  - Renders children when authenticated
  - Redirects to login when unauthenticated
  - Provides user context (userId, role, tenantId)
- `apps/admin/src/auth/__tests__/ProtectedRoute.test.tsx`:
  - Renders route for admin users
  - Redirects non-admin users to unauthorized page

**Step 2 — Implement:**
- `api/package.json`, `tsconfig.json`, `vitest.config.ts`
- `api/src/lib/dynamodb.ts`, `api/src/lib/crypto.ts`, `api/src/lib/response.ts`, `api/src/lib/errors.ts`
- `api/src/test-utils/mockApiEvent.ts` — factory for `APIGatewayProxyEvent` fixtures
- `api/src/test-utils/mockCognitoEvent.ts` — factory for Cognito trigger event fixtures
- `api/src/middleware/withErrorHandling.ts`, `withAuth.ts`, `withAdminAuth.ts`, `withValidation.ts`
- `api/src/handlers/auth/postConfirmation.ts`, `api/src/handlers/auth/getMe.ts`
- `infra/lib/constructs/auth.ts`
- Update `infra/lib/fooder-stack.ts`
- `apps/admin/` scaffold: package.json, vite.config.ts, vitest.config.ts, index.html, tsconfig.json, tailwind.config.ts, postcss.config.cjs
- `apps/admin/src/main.tsx`, `App.tsx`, `config.ts`
- `apps/admin/src/auth/cognito.ts`, `AuthProvider.tsx`, `AuthCallback.tsx`, `ProtectedRoute.tsx`
- `apps/admin/src/pages/Login.tsx`, `Dashboard.tsx`
- `apps/admin/src/api/client.ts`

**Step 3 — Run tests:** `pnpm test:api` and `pnpm test:infra` and `pnpm test:admin` — all pass (33 API + 20 infra + 4 admin = 57 tests)

**Step 4 — Manual validation (wait for user confirmation):**
- [X] All tests pass: `pnpm test`
- [ ] `pnpm build` succeeds across all packages
- [ ] `cd infra && npx cdk synth` — CloudFormation includes Cognito, Lambda triggers
- [ ] `pnpm dev:admin` — admin app starts on localhost
- [ ] Login page renders with "Sign in with Google" button
- [ ] (If Google credentials configured) Login flow works end-to-end
- [ ] Post-confirmation Lambda test: verify DynamoDB user record has `emailHash` and `encryptedEmail` (no plaintext)

**Step 5 — Deploy to AWS:**
```bash
# Prerequisite: Google OAuth credentials created at console.cloud.google.com
# Set environment variables for the deploy (or use cdk.context.json)
export GOOGLE_CLIENT_ID="your-google-client-id"
export GOOGLE_CLIENT_SECRET="your-google-client-secret"
export ADMIN_EMAIL_HASHES="sha256-hash-of-admin-email"

# Generate admin email hash:
echo -n "admin@example.com" | tr '[:upper:]' '[:lower:]' | tr -d ' ' | shasum -a 256 | cut -d' ' -f1

# Preview and deploy
cd infra && npx cdk diff
npx cdk deploy --require-approval broadening

# Note the outputs — you'll need:
#   - Cognito User Pool ID
#   - Cognito User Pool Client ID
#   - Cognito Hosted UI Domain
#   - API Gateway URL

# Verify Cognito setup
aws cognito-idp list-user-pools --max-results 10 --query 'UserPools[?starts_with(Name, `Fooder`)]'

# Test post-confirmation Lambda (after first Google sign-in):
aws dynamodb scan --table-name <UsersTableName> --limit 5
# Verify: emailHash and encryptedEmail present, no plaintext email
```
- [ ] Google OAuth credentials configured
- [ ] `cdk deploy` succeeds — Cognito User Pool, Lambda triggers created
- [ ] Cognito Hosted UI domain is accessible
- [ ] First Google login triggers post-confirmation Lambda
- [ ] DynamoDB user record contains `emailHash` + `encryptedEmail` (no plaintext)

**CHECKPOINT: Wait for user confirmation before proceeding to Phase 3.**

### Phase 3: Core API (Menu + Schedules) (COMPLETE)
**Goal**: All CRUD endpoints functional with full test coverage.

**Step 1 — Write tests first:**

Validation tests:
- `api/src/lib/validation/__tests__/menu.test.ts`:
  - `createMenuItemSchema` accepts valid input (name, description, price, category)
  - Rejects missing required fields (name, price)
  - Rejects negative price
  - Rejects empty string name
- `api/src/lib/validation/__tests__/schedule.test.ts`:
  - `createScheduleSchema` accepts valid input (title, startTime, endTime, pickupInstructions, items)
  - Rejects endTime before startTime
  - Rejects empty items array
  - Rejects negative quantities
  - Rejects items with quantity of 0

Handler tests:
- `api/src/handlers/menu/__tests__/createMenuItem.test.ts`:
  - Creates item in DynamoDB with ULID, tenantId, timestamps
  - Returns 201 with created item
  - Returns 400 for invalid input
  - Returns 403 for non-admin user
- `api/src/handlers/menu/__tests__/listMenuItems.test.ts`:
  - Queries by tenantId, returns all items
  - Returns empty array when no items exist
- `api/src/handlers/menu/__tests__/getMenuItem.test.ts`:
  - Returns item by tenantId + menuItemId
  - Returns 404 for non-existent item
- `api/src/handlers/menu/__tests__/updateMenuItem.test.ts`:
  - Updates specified fields, preserves others
  - Updates `updatedAt` timestamp
  - Returns 404 for non-existent item
  - Returns 400 for invalid input
- `api/src/handlers/menu/__tests__/deleteMenuItem.test.ts`:
  - Deletes item (or marks inactive)
  - Returns 404 for non-existent item
- `api/src/handlers/schedule/__tests__/createSchedule.test.ts`:
  - Creates schedule with embedded items (snapshot name/price from menu items)
  - Sets `remainingQuantity = totalQuantity` for each item
  - Sets initial status to `draft`
  - Returns 201 with created schedule
- `api/src/handlers/schedule/__tests__/listSchedules.test.ts`:
  - Admin: returns all schedules for tenant
  - Customer: returns only active schedules within time window
- `api/src/handlers/schedule/__tests__/getSchedule.test.ts`:
  - Returns schedule with all embedded items
  - Returns 404 for non-existent schedule
- `api/src/handlers/schedule/__tests__/updateSchedule.test.ts`:
  - Updates schedule fields (title, times, instructions)
  - Can change status: draft → active → closed
  - Cannot reopen a closed schedule
  - Returns 400 for invalid state transition
- `api/src/handlers/schedule/__tests__/deleteSchedule.test.ts`:
  - Deletes draft schedule
  - Returns 400 if schedule has orders (active/closed)

Infrastructure tests:
- `infra/test/api.test.ts` — CDK assertions:
  - API Gateway REST API exists
  - Cognito Authorizer attached
  - Lambda functions exist for each handler
  - Lambdas have DynamoDB read/write permissions
  - Lambdas have KMS permissions
  - CORS configured on API Gateway

**Step 2 — Implement:**
- `api/src/lib/validation/menu.ts`, `schedule.ts`
- `api/src/handlers/menu/createMenuItem.ts`, `listMenuItems.ts`, `getMenuItem.ts`, `updateMenuItem.ts`, `deleteMenuItem.ts`
- `api/src/handlers/schedule/createSchedule.ts`, `listSchedules.ts`, `getSchedule.ts`, `updateSchedule.ts`, `deleteSchedule.ts`
- `infra/lib/constructs/api.ts`
- Update `infra/lib/fooder-stack.ts`

**Step 3 — Run tests:** `pnpm test:api` and `pnpm test:infra` — all pass

**Step 4 — Manual validation (wait for user confirmation):**
- [x] All tests pass: `pnpm test` (129 tests: 30 infra + 95 API + 4 admin)
- [x] `pnpm build` succeeds
- [x] `cd infra && npx cdk synth` — CloudFormation includes API Gateway, all Lambda functions
- [x] curl test: create menu item with valid JWT → 201
- [x] curl test: create schedule with items → 201, verify embedded item snapshot
- [x] curl test: unauthorized request → 401
- [x] curl test: customer tries admin endpoint → 403

**Step 5 — Deploy to AWS:**
```bash
cd infra && npx cdk diff
npx cdk deploy --require-approval broadening

# Note the API Gateway URL from stack outputs
# Example: https://abc123.execute-api.us-east-1.amazonaws.com/prod

# Get a valid JWT token (sign in via Cognito Hosted UI, extract ID token)
# Then test API endpoints:

# Create a menu item (admin only)
curl -X POST https://<api-url>/api/menu-items \
  -H "Authorization: Bearer <admin-id-token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Item","description":"A test","price":9.99,"category":"main"}'
# Expected: 201

# List menu items
curl https://<api-url>/api/menu-items \
  -H "Authorization: Bearer <id-token>"
# Expected: 200 with array

# Test unauthorized
curl https://<api-url>/api/menu-items
# Expected: 401

# Test customer trying admin endpoint
curl -X POST https://<api-url>/api/menu-items \
  -H "Authorization: Bearer <customer-id-token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Blocked","description":"Should fail","price":1,"category":"test"}'
# Expected: 403
```
- [x] `cdk deploy` succeeds — API Gateway + Lambda functions created
- [x] API Gateway URL is accessible
- [x] Admin can create/list/update/delete menu items
- [x] Admin can create/list/update schedules
- [x] Unauthenticated requests return 401
- [x] Customer role requests to admin endpoints return 403

**CHECKPOINT: Wait for user confirmation before proceeding to Phase 4.**

### Phase 4: Admin Portal
**Goal**: Full admin UI for managing menu items, schedules, and viewing orders.

**Step 1 — Write tests first:**

Shared UI component tests:
- `packages/shared-ui/src/components/__tests__/Button.test.tsx`:
  - Renders with correct text
  - Fires onClick handler
  - Renders disabled state
  - Renders loading state with spinner
  - Applies variant styles (primary, secondary, danger)
- `packages/shared-ui/src/components/__tests__/Card.test.tsx`:
  - Renders children
  - Renders title and description
- `packages/shared-ui/src/components/__tests__/Input.test.tsx`:
  - Renders with label
  - Fires onChange handler
  - Displays error message
  - Supports disabled state
- `packages/shared-ui/src/components/__tests__/Modal.test.tsx`:
  - Renders when open
  - Does not render when closed
  - Fires onClose when backdrop clicked
  - Fires onClose when Escape pressed
- `packages/shared-ui/src/components/__tests__/Badge.test.tsx`:
  - Renders with correct text and variant color

Admin page tests:
- `apps/admin/src/pages/__tests__/MenuItems.test.tsx`:
  - Renders loading spinner while fetching
  - Renders list of menu items
  - Renders empty state when no items
  - "Add Item" button navigates to form
  - Delete button shows confirmation modal
- `apps/admin/src/pages/__tests__/MenuItemForm.test.tsx`:
  - Create mode: renders empty form
  - Edit mode: pre-fills form with existing item data
  - Validates required fields (name, price)
  - Submits valid form and calls API
  - Shows error toast on API failure
- `apps/admin/src/pages/__tests__/Schedules.test.tsx`:
  - Renders list of schedules with status badges
  - Filters by status
- `apps/admin/src/pages/__tests__/ScheduleForm.test.tsx`:
  - Renders date/time pickers
  - Allows selecting menu items and setting quantities
  - Validates endTime > startTime
  - Submits and creates schedule
- `apps/admin/src/pages/__tests__/ScheduleDetail.test.tsx`:
  - Renders schedule info with items and remaining quantities
  - Activate button changes status to active
  - Close button changes status to closed
- `apps/admin/src/pages/__tests__/Orders.test.tsx`:
  - Renders order table with columns
  - Filters by schedule and status
  - Shows decrypted customer name/email
- `apps/admin/src/pages/__tests__/OrderDetail.test.tsx`:
  - Renders full order info
  - "Mark as Fulfilled" button calls API

Infrastructure tests:
- `infra/test/frontend.test.ts` — CDK assertions:
  - S3 bucket exists for admin app with website hosting
  - CloudFront distribution exists with S3 origin
  - OAC (Origin Access Control) configured
  - Default root object set to `index.html`
  - Error pages route to `index.html` (SPA routing)

**Step 2 — Implement:**
- `packages/shared-ui/` scaffold: package.json, vite.config.ts, vitest.config.ts, tsconfig.json, src/index.ts
- `packages/shared-ui/src/components/` — Button, Card, Input, Modal, Badge, Spinner, EmptyState, Layout/Header, Layout/PageContainer
- `apps/admin/src/api/menu.ts`, `schedules.ts`, `orders.ts` (TanStack Query hooks)
- `apps/admin/src/pages/` — MenuItems, MenuItemForm, Schedules, ScheduleForm, ScheduleDetail, Orders, OrderDetail
- `apps/admin/src/components/` — MenuItemCard, ScheduleCard, OrderTable, OrderStatusBadge
- `infra/lib/constructs/frontend.ts`
- Update `infra/lib/fooder-stack.ts`

**Step 3 — Run tests:** `pnpm test:admin` and `pnpm test:shared-ui` and `pnpm test:infra` — all pass

**Step 4 — Manual validation (wait for user confirmation):**
- [ ] All tests pass: `pnpm test`
- [ ] `pnpm build` succeeds (including shared-ui library build)
- [ ] `pnpm dev:admin` — all pages render correctly
- [ ] Create a menu item via the UI → verify it appears in the list
- [ ] Edit a menu item → verify changes are saved
- [ ] Delete a menu item → verify it's removed
- [ ] Create a schedule with items and quantities → verify it appears with correct status
- [ ] Activate a schedule → verify status changes
- [ ] Orders page renders (empty list is fine, orders come in Phase 5)

**Step 5 — Deploy to AWS:**
```bash
cd infra && npx cdk diff
npx cdk deploy --require-approval broadening

# Build the admin app for production
cd apps/admin
echo "VITE_API_URL=https://<api-url>" > .env.production
echo "VITE_COGNITO_USER_POOL_ID=<user-pool-id>" >> .env.production
echo "VITE_COGNITO_CLIENT_ID=<client-id>" >> .env.production
echo "VITE_COGNITO_DOMAIN=<hosted-ui-domain>" >> .env.production
pnpm build

# Deploy admin static assets to S3
aws s3 sync dist/ s3://<admin-bucket-name> --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id <admin-cf-distribution-id> \
  --paths "/*"

# Verify admin app is accessible
echo "Admin app: https://<admin-cloudfront-domain>"
```
- [ ] `cdk deploy` succeeds — S3 bucket + CloudFront distribution created for admin
- [ ] Admin app builds with production env vars
- [ ] Static assets uploaded to S3
- [ ] Admin app loads at CloudFront URL
- [ ] Login with Google works through CloudFront domain
- [ ] Menu items CRUD works end-to-end in deployed environment
- [ ] Schedule management works end-to-end

**CHECKPOINT: Wait for user confirmation before proceeding to Phase 5.**

### Phase 5: Customer Site + Ordering
**Goal**: Customers can browse, add to cart, and place orders with quantity enforcement.

**Step 1 — Write tests first:**

Cart store tests:
- `apps/customer/src/store/__tests__/cartStore.test.ts`:
  - `addItem` adds new item to cart
  - `addItem` increments quantity for existing item
  - `addItem` does not exceed maxQuantity
  - `removeItem` removes item from cart
  - `updateQuantity` changes item quantity
  - `updateQuantity` removes item when quantity is 0
  - `clearCart` empties the cart
  - `getTotal` calculates correct total price
  - Cart persists to localStorage
  - Cart restores from localStorage on init

Order handler tests:
- `api/src/handlers/order/__tests__/createOrder.test.ts`:
  - Creates order with TransactWriteItems (atomic quantity decrement)
  - Returns 201 with created order including orderId
  - Encrypts user PII before storing
  - Returns 400 when schedule is not active
  - Returns 400 when schedule ordering window has not started
  - Returns 400 when schedule ordering window has ended
  - Returns 409 when requested quantity exceeds remaining
  - Returns 409 with details on which specific item was unavailable
  - Correctly decrements remainingQuantity for each item
  - Sets order status to `confirmed`
  - Calculates totalPrice from item prices * quantities
- `api/src/handlers/order/__tests__/getOrder.test.ts`:
  - Admin: returns any order with decrypted PII
  - Customer: returns own order only (no PII decryption needed — it's their own)
  - Returns 403 when customer tries to access another user's order
  - Returns 404 for non-existent order
- `api/src/handlers/order/__tests__/listOrders.test.ts`:
  - Returns orders for schedule, filterable by status
  - Decrypts user PII for admin view
  - Supports pagination via nextToken
- `api/src/handlers/order/__tests__/listMyOrders.test.ts`:
  - Returns only the authenticated user's orders
  - Sorted by createdAt descending
- `api/src/handlers/order/__tests__/fulfillOrder.test.ts`:
  - Updates order status to `fulfilled`
  - Sets `fulfilledAt` timestamp
  - Returns 400 if order is already fulfilled or cancelled
  - Returns 403 for non-admin
- `api/src/handlers/order/__tests__/cancelOrder.test.ts`:
  - Updates order status to `cancelled`
  - Restores remainingQuantity on the schedule (atomic increment)
  - Returns 400 if order is already fulfilled or cancelled

Validation tests:
- `api/src/lib/validation/__tests__/order.test.ts`:
  - `createOrderSchema` accepts valid input (scheduleId, items array, notes)
  - Rejects empty items array
  - Rejects items with quantity <= 0
  - Rejects missing scheduleId

Customer page tests:
- `apps/customer/src/pages/__tests__/Home.test.tsx`:
  - Renders loading spinner while fetching
  - Renders active schedules as cards
  - Renders empty state when no active schedules
  - Schedule card shows title, time window, item count
  - Clicking schedule navigates to ScheduleView
- `apps/customer/src/pages/__tests__/ScheduleView.test.tsx`:
  - Renders items with name, price, remaining quantity
  - "Add to Cart" button adds item to cart store
  - Disables "Add to Cart" when remainingQuantity is 0
  - Shows "Sold Out" badge for items with 0 remaining
  - Shows countdown timer for ordering window
  - Disables all ordering when outside time window
- `apps/customer/src/pages/__tests__/Cart.test.tsx`:
  - Renders cart items from store
  - Quantity +/- buttons update cart store
  - Cannot exceed maxQuantity
  - Shows total price
  - "Place Order" button calls createOrder API
  - Shows login prompt when unauthenticated
  - Shows success and redirects to OrderConfirmation on success
  - Shows error toast on 409 (quantity unavailable)
- `apps/customer/src/pages/__tests__/OrderConfirmation.test.tsx`:
  - Renders order summary with items and total
  - Shows pickup instructions
  - Shows order status
- `apps/customer/src/pages/__tests__/MyOrders.test.tsx`:
  - Renders list of user's orders
  - Shows status badges (confirmed, fulfilled, cancelled)
  - Clicking order navigates to detail

Customer component tests:
- `apps/customer/src/components/__tests__/QuantitySelector.test.tsx`:
  - Renders current quantity
  - + button increments (up to max)
  - - button decrements (down to 1 or removes)
  - Disabled when max is 0
- `apps/customer/src/components/__tests__/ScheduleTimer.test.tsx`:
  - Shows countdown to end time
  - Shows "Ordering opens in..." when before start time
  - Shows "Ordering closed" when after end time

**Step 2 — Implement:**
- `apps/customer/` scaffold: package.json, vite.config.ts, vitest.config.ts, index.html, tsconfig.json, tailwind.config.ts, postcss.config.cjs
- `apps/customer/src/main.tsx`, `App.tsx`, `config.ts`
- `apps/customer/src/auth/` — cognito.ts, AuthProvider.tsx, AuthCallback.tsx
- `apps/customer/src/api/` — client.ts, schedules.ts, orders.ts
- `apps/customer/src/store/cartStore.ts`
- `api/src/handlers/order/createOrder.ts`, `getOrder.ts`, `listOrders.ts`, `listMyOrders.ts`, `fulfillOrder.ts`, `cancelOrder.ts`
- `api/src/lib/validation/order.ts`
- `apps/customer/src/pages/` — Home, ScheduleView, Cart, OrderConfirmation, MyOrders, Login
- `apps/customer/src/components/` — MenuItemCard, CartDrawer, CartItem, QuantitySelector, ScheduleTimer
- Update `infra/lib/constructs/api.ts` — add order Lambda functions
- Update `infra/lib/fooder-stack.ts` — add customer frontend construct

**Step 3 — Run tests:** `pnpm test` — all pass across all packages

**Step 4 — Manual validation (wait for user confirmation):**
- [ ] All tests pass: `pnpm test`
- [ ] `pnpm build` succeeds
- [ ] `pnpm dev:customer` — customer app starts on localhost
- [ ] Home page shows active schedules
- [ ] Schedule view shows items with prices and quantities
- [ ] Add items to cart → cart updates correctly
- [ ] Place order → order confirmation page shows
- [ ] My Orders page shows the placed order
- [ ] (If deployed) End-to-end: Admin creates schedule → Customer places order → Admin sees order in portal
- [ ] (If deployed) Quantity enforcement: order exceeding remaining → 409
- [ ] (If deployed) Time window enforcement: order outside window → rejected
- [ ] (If deployed) DynamoDB inspection: no plaintext PII in orders table

**Step 5 — Deploy to AWS:**
```bash
cd infra && npx cdk diff
npx cdk deploy --require-approval broadening

# Build the customer app for production
cd apps/customer
echo "VITE_API_URL=https://<api-url>" > .env.production
echo "VITE_COGNITO_USER_POOL_ID=<user-pool-id>" >> .env.production
echo "VITE_COGNITO_CLIENT_ID=<client-id>" >> .env.production
echo "VITE_COGNITO_DOMAIN=<hosted-ui-domain>" >> .env.production
pnpm build

# Deploy customer static assets to S3
aws s3 sync dist/ s3://<customer-bucket-name> --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id <customer-cf-distribution-id> \
  --paths "/*"

# Verify customer app is accessible
echo "Customer app: https://<customer-cloudfront-domain>"

# End-to-end test:
# 1. Admin: create menu items + schedule + activate
# 2. Customer: browse schedule → add to cart → place order
# 3. Admin: verify order appears in orders list
# 4. Verify quantity enforcement (order more than remaining → 409)
# 5. Verify time window enforcement (order outside window → rejected)

# Verify PII encryption in DynamoDB
aws dynamodb scan --table-name <OrdersTableName> --limit 5
# Confirm: encryptedUserEmail and encryptedUserDisplayName present, no plaintext
```
- [ ] `cdk deploy` succeeds — order Lambdas + customer S3/CloudFront created
- [ ] Customer app builds and deploys to CloudFront
- [ ] Customer can browse active schedules, add to cart, place orders
- [ ] Quantity enforcement works (409 when exceeding remaining)
- [ ] Time window enforcement works (rejected outside window)
- [ ] DynamoDB orders table has no plaintext PII

**CHECKPOINT: Wait for user confirmation before proceeding to Phase 6.**

### Phase 6: Order Fulfillment + Polish
**Goal**: Production-ready deployment with polished admin order management and full E2E flow.

**Step 1 — Write tests first:**

Admin enhancement tests:
- `apps/admin/src/pages/__tests__/Dashboard.test.tsx`:
  - Renders summary cards: active schedules count, pending orders count, total revenue
  - Quick links navigate to correct pages
  - Shows "No active schedules" when none exist
- `apps/admin/src/pages/__tests__/Orders.test.tsx` (enhanced):
  - Polling: refetches orders at configurable interval
  - Bulk select: checkboxes select multiple orders
  - Bulk fulfill: marks all selected as fulfilled
  - Schedule filter dropdown filters orders
- `apps/admin/src/pages/__tests__/OrderDetail.test.tsx` (enhanced):
  - "Mark as Fulfilled" shows confirmation modal
  - Confirmation modal calls fulfillOrder API
  - "Cancel Order" shows reason input and confirmation
  - Shows fulfilled timestamp after fulfillment

Infrastructure tests:
- `infra/test/frontend.test.ts` (enhanced):
  - Two CloudFront distributions exist (admin + customer)
  - Cognito callback URLs include CloudFront domain URLs

**Step 2 — Implement:**
- Update `apps/admin/src/pages/Dashboard.tsx` — summary cards, quick links
- Update `apps/admin/src/pages/Orders.tsx` — polling, bulk fulfillment, schedule filter
- Update `apps/admin/src/pages/OrderDetail.tsx` — fulfill/cancel with confirmation modals
- `apps/admin/.env.production`, `apps/customer/.env.production`
- Update CDK: CloudFront callback URLs for Cognito

**Step 3 — Run tests:** `pnpm test` — all pass across all packages

**Step 4 — Manual validation (wait for user confirmation):**
- [ ] All tests pass: `pnpm test`
- [ ] `pnpm build` succeeds for all packages
- [ ] `cd infra && npx cdk synth` — final CloudFormation is valid
- [ ] Admin Dashboard shows summary cards
- [ ] Admin Orders page auto-refreshes
- [ ] Bulk fulfillment works for multiple orders
- [ ] Schedule filter narrows order list
- [ ] Fulfill order → confirmation modal → status updated
- [ ] Cancel order → confirmation modal → quantities restored
- [ ] (If deployed) Full production flow on CloudFront URLs:
  1. Admin logs in with Google → creates menu items → creates schedule → activates
  2. Customer logs in with Google → browses → adds to cart → places order
  3. Admin sees new order → marks as fulfilled
  4. Customer sees order status updated to "fulfilled"
  5. Inspect DynamoDB: no plaintext PII anywhere

**Step 5 — Deploy to AWS (final production release):**
```bash
cd infra && npx cdk diff
npx cdk deploy --require-approval broadening

# Update Cognito callback URLs to include both CloudFront domains
# (handled by CDK if FrontendConstruct passes URLs to AuthConstruct)

# Rebuild and deploy both frontend apps with final env vars
cd apps/admin && pnpm build
aws s3 sync dist/ s3://<admin-bucket-name> --delete
aws cloudfront create-invalidation --distribution-id <admin-cf-distribution-id> --paths "/*"

cd ../../apps/customer && pnpm build
aws s3 sync dist/ s3://<customer-bucket-name> --delete
aws cloudfront create-invalidation --distribution-id <customer-cf-distribution-id> --paths "/*"

# Full production E2E validation:
# 1. Admin: login → create menu items → create schedule → activate
# 2. Customer: login → browse → add to cart → place order
# 3. Admin: see order → mark fulfilled
# 4. Customer: see order updated to "fulfilled"
# 5. Admin: cancel an order → verify quantities restored on schedule
# 6. DynamoDB inspection: aws dynamodb scan --table-name <table> --limit 5
#    Confirm zero plaintext PII across all tables

# Optional: set up custom domain with Route 53 + ACM certificate
# aws acm request-certificate --domain-name admin.yourdomain.com
# aws acm request-certificate --domain-name order.yourdomain.com
# Then add alternate domain names to CloudFront distributions
```
- [ ] `cdk deploy` succeeds — all resources up to date
- [ ] Both admin and customer apps redeployed with final config
- [ ] Cognito callback URLs include CloudFront domains
- [ ] Full E2E flow works: admin creates → customer orders → admin fulfills
- [ ] Bulk fulfillment works for multiple orders
- [ ] Cancel order restores quantities on schedule
- [ ] DynamoDB: zero plaintext PII across all tables
- [ ] (Optional) Custom domains configured

**CHECKPOINT: Phase 6 complete. All features implemented and tested.**

---

## Verification Summary

### Automated Test Coverage

| Package | Test Command | Coverage Target |
|---------|-------------|----------------|
| `@fooder/infra` | `pnpm test:infra` | CDK assertions for all constructs |
| `@fooder/api` | `pnpm test:api` | 80% — all handlers, middleware, validation, crypto |
| `@fooder/admin` | `pnpm test:admin` | 70% — all pages, auth flow, key components |
| `@fooder/customer` | `pnpm test:customer` | 70% — all pages, cart store, key components |
| `@fooder/shared-ui` | `pnpm test:shared-ui` | 70% — all shared components |
| All | `pnpm test` | Runs all of the above |

### End-to-End Acceptance Criteria (Post Phase 6)
1. Admin logs in → creates menu items → creates schedule with items/quantities → sets ordering window
2. Customer logs in → sees active schedule → adds items to cart → places order
3. Admin sees new order (with decrypted customer info) → marks as fulfilled
4. Customer sees order status updated
5. Quantity limits: ordering more than available → 409 error
6. Time window: ordering outside window → rejected
7. PII verification: inspect DynamoDB directly → confirm no plaintext emails or names
