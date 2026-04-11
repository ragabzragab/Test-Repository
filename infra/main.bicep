// ── Azure Infrastructure for OpenAI Demo + Contract Management ────────────
// Provisions: Resource Group scope resources
//   - App Service Plan (Linux, B1 or higher)
//   - App Service (Node.js 20 LTS)
//
// Deploy:
//   az deployment group create \
//     --resource-group <RG_NAME> \
//     --template-file infra/main.bicep \
//     --parameters @infra/main.parameters.json
// ──────────────────────────────────────────────────────────────────────────

@description('Name of the Azure Web App. Must be globally unique.')
param appName string

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('App Service Plan SKU.')
@allowed(['B1', 'B2', 'B3', 'S1', 'S2', 'P1v3', 'P2v3'])
param sku string = 'B1'

@description('OpenAI API key, stored as an App Setting (never in source).')
@secure()
param openAiApiKey string = ''

@description('Optional: override the default OpenAI model used by the app.')
param openAiModel string = ''

@description('Resource tags applied to all resources.')
param tags object = {
  application: 'openai-contract-demo'
  environment: 'production'
}

// ── App Service Plan ───────────────────────────────────────────────────────

resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: '${appName}-plan'
  location: location
  tags: tags
  kind: 'linux'
  sku: {
    name: sku
  }
  properties: {
    reserved: true   // required for Linux
  }
}

// ── App Service ────────────────────────────────────────────────────────────

resource webApp 'Microsoft.Web/sites@2023-01-01' = {
  name: appName
  location: location
  tags: tags
  kind: 'app,linux'
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      appCommandLine: 'node server.js'
      alwaysOn: sku != 'B1' ? true : false   // Always On requires B2+
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      appSettings: [
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'OPENAI_API_KEY'
          value: openAiApiKey
        }
        {
          name: 'OPENAI_MODEL'
          value: openAiModel
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        // Azure sets PORT automatically — the app reads process.env.PORT || 3000
      ]
    }
  }
}

// ── Outputs ────────────────────────────────────────────────────────────────

output appName string = webApp.name
output defaultHostname string = webApp.properties.defaultHostName
output appUrl string = 'https://${webApp.properties.defaultHostName}'
output resourceId string = webApp.id
