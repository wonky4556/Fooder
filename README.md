# Fooder

A food ordering platform where administrators create menus and schedules, and customers browse available offerings, build carts, and place orders — all with real-time quantity enforcement and encrypted PII.

## How It Works

1. **Admin** logs in and creates **menu items** (name, price, category, description)
2. **Admin** creates a **schedule** — a time-bound ordering window that includes selected menu items with set quantities
3. **Admin** activates the schedule, making it visible to customers
4. **Customers** browse active schedules, add items to their cart, and place orders
5. Orders atomically decrement remaining quantities — if an item sells out, further orders for it are rejected (409)
6. **Admin** views incoming orders (with decrypted customer info) and marks them as fulfilled or cancelled
7. Cancelling an order restores the item quantities back to the schedule

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, React Router 7, TanStack Query 5, Zustand (cart), TailwindCSS v4, Vite |
| Backend | TypeScript Lambda handlers, AWS SDK v3, Zod validation, ULID IDs |
| Infrastructure | AWS CDK v2, DynamoDB (on-demand), Cognito (Google OAuth), API Gateway, S3 + CloudFront, KMS |
| Testing | Vitest, CDK Assertions, Testing Library |
| Monorepo | pnpm workspaces |

All AWS services are configured for free-tier usage.

## Project Structure

```
fooder/
├── apps/
│   ├── admin/           # Admin management portal (Vite + React)
│   └── customer/        # Customer ordering site (Vite + React)
├── packages/
│   ├── shared-types/    # TypeScript domain types (user, menu, schedule, order, cart, API)
│   └── shared-ui/       # Shared React component library
├── api/                 # Lambda function handlers
├── infra/               # AWS CDK infrastructure-as-code
├── prd.md               # Full product requirements document
└── pnpm-workspace.yaml
```

## Prerequisites

- **Node.js >= 22** (see `.nvmrc`)
- **pnpm >= 10** — install with `npm install -g pnpm`
- **AWS CLI** configured with credentials (`aws configure`) — required for deployment
- **AWS CDK CLI** — installed as a dev dependency, or globally with `npm install -g aws-cdk`

## Getting Started

```bash
# Clone the repository
git clone https://github.com/wonky4556/Fooder.git
cd Fooder

# Use the correct Node version
nvm use

# Install all dependencies
pnpm install

# Build shared types (downstream packages depend on this)
pnpm -w run build:types

# Run all tests
pnpm -w run test

# Start the admin portal dev server
pnpm -w run dev:admin

# Start the customer site dev server
pnpm -w run dev:customer
```

## Development Commands

All root-level scripts must be run with `pnpm -w run`:

```bash
# Build
pnpm -w run build              # Build all packages
pnpm -w run build:types        # Build shared-types only

# Test
pnpm -w run test               # Run all tests across the monorepo
pnpm -w run test:infra         # CDK infrastructure tests
pnpm -w run test:api           # Lambda handler tests
pnpm -w run test:admin         # Admin portal tests
pnpm -w run test:customer      # Customer site tests
pnpm -w run test:shared-ui     # Shared UI component tests

# Run a single test file
cd infra && pnpm vitest run test/database.test.ts

# Watch mode
cd infra && pnpm test:watch

# Lint
pnpm -w run lint
```

## Infrastructure & Deployment

The infrastructure is defined in `infra/` using AWS CDK. A single `FooderStack` composes these constructs:

| Construct | Resources |
|-----------|-----------|
| `DatabaseConstruct` | 4 DynamoDB tables (Users, MenuItems, Schedules, Orders) with GSIs |
| `KmsConstruct` | KMS key for PII encryption (`alias/fooder/DEFAULT/pii`) |
| `AuthConstruct` | Cognito User Pool with Google IdP, post-confirmation Lambda trigger |
| `ApiConstruct` | API Gateway REST API with Cognito Authorizer, Lambda functions per endpoint |
| `FrontendConstruct` | S3 buckets + CloudFront distributions for admin and customer apps |

### Deploying

```bash
cd infra

# First-time setup: bootstrap CDK in your AWS account
npx cdk bootstrap

# Preview changes
npx cdk diff

# Deploy
npx cdk deploy --require-approval broadening

# Synthesize CloudFormation template (no deploy)
npx cdk synth
```

### Deploying Frontend Apps

After `cdk deploy`, build and upload the frontend apps to their S3 buckets:

```bash
# Set environment variables in apps/admin/.env.production and apps/customer/.env.production:
#   VITE_API_URL, VITE_COGNITO_USER_POOL_ID, VITE_COGNITO_CLIENT_ID, VITE_COGNITO_DOMAIN

# Build and deploy admin portal
cd apps/admin && pnpm build
aws s3 sync dist/ s3://<admin-bucket-name> --delete
aws cloudfront create-invalidation --distribution-id <dist-id> --paths "/*"

# Build and deploy customer site
cd apps/customer && pnpm build
aws s3 sync dist/ s3://<customer-bucket-name> --delete
aws cloudfront create-invalidation --distribution-id <dist-id> --paths "/*"
```

## Authentication

Authentication uses **Amazon Cognito** with **Google as a federated identity provider**:

1. Users sign in via Cognito Hosted UI (Google OAuth redirect flow)
2. A **post-confirmation Lambda trigger** fires on first sign-in and:
   - Hashes the user's email (SHA-256) for indexed lookups
   - Encrypts the email and display name via KMS for secure storage
   - Assigns `admin` or `customer` role based on an allow-list of email hashes
   - Creates the user record in DynamoDB
3. API Gateway validates JWTs using a Cognito Authorizer
4. Frontend apps use `aws-amplify` (auth module only) for token management

**Setting up Google OAuth:** Create OAuth credentials at [console.cloud.google.com](https://console.cloud.google.com) and provide `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as environment variables or CDK context values before deploying the Auth construct.

## Data Privacy

No plaintext PII is stored in DynamoDB. All personal data follows a **hash-for-lookup, encrypt-for-display** pattern:

- **emailHash** — SHA-256 of the lowercased, trimmed email. Used as a GSI key for user lookups. Irreversible.
- **encryptedEmail / encryptedDisplayName** — AES-256 envelope encryption via AWS KMS. Decrypted at the API layer only when needed (e.g., admin viewing order details).
- Orders store encrypted copies of customer email and display name at the time of ordering.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/me` | User | Current user profile (decrypted PII) |
| POST | `/api/menu-items` | Admin | Create menu item |
| GET | `/api/menu-items` | User | List menu items |
| GET | `/api/menu-items/:id` | User | Get menu item |
| PUT | `/api/menu-items/:id` | Admin | Update menu item |
| DELETE | `/api/menu-items/:id` | Admin | Delete menu item |
| POST | `/api/schedules` | Admin | Create schedule |
| GET | `/api/schedules` | User | List schedules (admin: all, customer: active only) |
| GET | `/api/schedules/:id` | User | Get schedule |
| PUT | `/api/schedules/:id` | Admin | Update schedule |
| DELETE | `/api/schedules/:id` | Admin | Delete schedule |
| POST | `/api/orders` | User | Place order (atomic quantity decrement) |
| GET | `/api/orders` | Admin | List orders (filterable, decrypted PII) |
| GET | `/api/orders/mine` | User | List own orders |
| GET | `/api/orders/:id` | User | Get order (admin: any, customer: own only) |
| PUT | `/api/orders/:id/fulfill` | Admin | Mark order fulfilled |
| PUT | `/api/orders/:id/cancel` | Admin | Cancel order (restores quantities) |

## Implementation Phases

The project is built incrementally with a test-driven development approach. Each phase writes failing tests first, then implements to pass them.

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Project scaffolding, shared types, DynamoDB tables, KMS key | Complete |
| 2 | Authentication (Cognito, Google OAuth, post-confirmation Lambda, middleware) | Not started |
| 3 | Core API (menu items CRUD, schedules CRUD, API Gateway + Lambda) | Not started |
| 4 | Admin portal (shared UI components, menu/schedule/order management pages) | Not started |
| 5 | Customer site (browsing, cart with Zustand, ordering with atomic quantity enforcement) | Not started |
| 6 | Order fulfillment, admin dashboard polish, production deployment | Not started |

See `prd.md` for the full product requirements, detailed test specifications, and deployment checklists for each phase.

## License

Private project.
