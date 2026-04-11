Test-Repository
===============

A Node.js web application with two main features:

1. **OpenAI API Demo** — interactive UI for the top 10 OpenAI APIs
2. **Contract Management System** — full CRUD contract tracker with dashboard, search, and CSV export

---

## Setup

```bash
npm install
cp .env.example .env   # then add your OPENAI_API_KEY
npm start              # production
npm run dev            # development (auto-restart)
```

Server runs at `http://localhost:3000` (configurable via `PORT` in `.env`).

---

## Deploying to Azure Web App

> **One command** — run this on your local machine (needs [Azure CLI](https://aka.ms/installazurecli) and `git`):
>
> ```bash
> chmod +x deploy.sh && ./deploy.sh
> ```
>
> The script provisions all Azure resources, sets up GitHub Actions OIDC auth, does the first deployment, and prints your live URL. After that, every push to `main` auto-deploys.

For full details see the [step-by-step guide](#step-by-step-azure-deployment-guide) below.

---

## Contract Management System

Navigate to **`/contracts.html`** after starting the server.

### Features

- **Dashboard** — live stats: total, active, expiring soon, expired, draft count, total value
- **Expiring alerts** — banner highlights contracts expiring within 30 days (orange → red by urgency)
- **Contracts table** — sortable columns, search by title/number/party, filter by status and type
- **Add / Edit contracts** — modal form with full field set and multi-party support
- **Auto-expiry** — active contracts past their end date are automatically marked expired
- **CSV export** — download all visible contracts as a spreadsheet
- **Validation** — both client-side (with inline error messages) and server-side

### Contract Fields

| Field | Description |
|-------|-------------|
| Title | Contract name (required) |
| Contract # | Auto-generated: `CNT-YEAR-###` |
| Type | service, employment, vendor, lease, NDA, partnership, other |
| Status | draft → pending → active → expired / terminated |
| Parties | Multiple parties with name, role, and email |
| Dates | Start date and end date |
| Value | Monetary value + currency (USD, EUR, GBP, CAD, AUD, JPY) |
| Tags | Free-form comma-separated labels |
| Description / Notes | Long-form text fields |
| Renewal Reminder | Days before end date to highlight for renewal |

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/contracts` | List all — supports `?status=`, `?type=`, `?search=` |
| `POST` | `/api/contracts` | Create a contract |
| `GET` | `/api/contracts/stats` | Dashboard statistics |
| `GET` | `/api/contracts/expiring` | Contracts expiring soon (`?days=30`) |
| `GET` | `/api/contracts/:id` | Get a single contract |
| `PUT` | `/api/contracts/:id` | Update a contract |
| `DELETE` | `/api/contracts/:id` | Delete a contract |

### Data Storage

Contracts are stored in `data/contracts.json` (created automatically on first run). This file is excluded from git — the `data/` directory is tracked via `data/.gitkeep`.

---

## OpenAI API Demo

Navigate to **`/`** after starting the server. Supports:

1. Chat Completions
2. Single-turn Responses
3. Vision (image analysis)
4. Image Generation
5. Image Editing
6. Image Variations
7. Speech-to-Text
8. Text-to-Speech
9. Embeddings
10. Moderations

Set your `OPENAI_API_KEY` in `.env` or paste it directly in the browser (stored in `localStorage`).

---

## Deploying to Azure Web App

The project includes a GitHub Actions workflow (`.github/workflows/azure-deploy.yml`) and Bicep infrastructure templates (`infra/`) for one-command provisioning and CI/CD deployment to Azure App Service.

### Prerequisites

- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) installed and logged in (`az login`)
- An Azure subscription
- This repo pushed to GitHub

---

### Step 1 — Provision Azure resources

Create a resource group and deploy the App Service infrastructure:

```bash
# Create resource group (choose a region close to you)
az group create --name rg-openai-demo --location eastus

# Edit infra/main.parameters.json — set appName to a globally unique value
# e.g. "my-openai-demo-abc123"

# Deploy infrastructure
az deployment group create \
  --resource-group rg-openai-demo \
  --template-file infra/main.bicep \
  --parameters @infra/main.parameters.json \
  --parameters openAiApiKey="sk-your-key-here"
```

The `openAiApiKey` parameter is marked `@secure()` so it will not appear in deployment logs or state files.

---

### Step 2 — Create a service principal for GitHub Actions

```bash
# Replace <SUBSCRIPTION_ID> and <APP_NAME> with your values
az ad sp create-for-rbac \
  --name "github-openai-demo-deploy" \
  --role contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/rg-openai-demo \
  --json-auth
```

Copy the JSON output — you will need `clientId`, `tenantId`, and `subscriptionId`.

---

### Step 3 — Add federated credentials (OIDC — no passwords)

Replace `<CLIENT_ID>`, `<GITHUB_ORG>`, and `<REPO>` below:

```bash
az ad app federated-credential create \
  --id <CLIENT_ID> \
  --parameters '{
    "name": "github-main",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:<GITHUB_ORG>/<REPO>:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

---

### Step 4 — Add GitHub repository secrets

In your GitHub repo go to **Settings → Secrets and variables → Actions** and add:

| Secret name | Value |
|-------------|-------|
| `AZURE_CLIENT_ID` | `clientId` from step 2 |
| `AZURE_TENANT_ID` | `tenantId` from step 2 |
| `AZURE_SUBSCRIPTION_ID` | `subscriptionId` from step 2 |
| `AZURE_WEBAPP_NAME` | The app name from `main.parameters.json` |

---

### Step 5 — Deploy

Push to `main` (or `master`) — the workflow triggers automatically:

```bash
git push origin main
```

Monitor progress under **Actions** in your GitHub repo. After a successful run the app is live at:

```
https://<AZURE_WEBAPP_NAME>.azurewebsites.net
```

---

### Environment variables on Azure

All app configuration is managed via **App Settings** in the Azure portal (or re-deploy via Bicep with updated parameters). The following are set automatically by the Bicep template:

| Setting | Description |
|---------|-------------|
| `NODE_ENV` | Set to `production` |
| `OPENAI_API_KEY` | Your OpenAI key (passed as a secure Bicep parameter) |
| `OPENAI_MODEL` | Optional model override |
| `PORT` | Set automatically by Azure — the app reads `process.env.PORT` |

To update the OpenAI key after initial deployment:

```bash
az webapp config appsettings set \
  --resource-group rg-openai-demo \
  --name <APP_NAME> \
  --settings OPENAI_API_KEY="sk-new-key"
```

---

### Important notes

- **Persistent data**: `data/contracts.json` is written to the App Service filesystem (ephemeral — lost on redeploy or restart). For production, replace the JSON store with Azure Blob Storage or Azure Cosmos DB.
- **File uploads**: the `uploads/` directory is similarly ephemeral. For production, stream uploads to Azure Blob Storage.
- **Scaling**: the B1 SKU supports one instance. To scale, upgrade to B2/B3 or a Premium plan in `infra/main.parameters.json` and redeploy.
- **Windows vs Linux**: `web.config` is included for Windows App Service compatibility (iisnode). The Bicep template provisions a Linux plan by default — on Linux `web.config` is ignored.
