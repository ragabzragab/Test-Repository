# Test-Repository

Express app with an OpenAI API demo (`/`), a contract tracker (`/contracts.html`) and a calculator (`/calculator.html`).

## Develop
```
cp .env.example .env   # then set OPENAI_API_KEY
npm ci
npm run dev
npm run check          # syntax checks, also run in CI
```

## Workflow
- Branch from `master`, open a pull request; CI (`.github/workflows/ci.yml`) must pass.
- Merging to `master` deploys to Azure Web Apps (`.github/workflows/azure-webapps-node.yml`).

## Deploy setup (one time, in GitHub Settings > Secrets and variables > Actions)
- Variable `AZURE_WEBAPP_NAME`: your Azure Web App name
- Secret `AZURE_WEBAPP_PUBLISH_PROFILE`: contents of the publish profile from the Azure portal
- Set `OPENAI_API_KEY` as an app setting in Azure, never in the repo.
