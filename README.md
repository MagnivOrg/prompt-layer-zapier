# PromptLayer RunAgent Zapier Integration

This package provides a custom zapier action for running [PromptLayer Agents](https://promptlayer.com/) directly from your zapier workflows. The **PromptLayer RunAgent** node allows you to execute PromptLayer Agents, pass input variables, select agent versions or labels, and retrieve results programmatically.

## Features

- **Single Action**: Run Agent with internal polling (mirrors n8n behavior)
- **API Key Authentication**: Secure authentication via X-API-KEY header
- **Dynamic Agent Selection**: Loads available agents from PromptLayer API
- **Version Control**: Support for both version numbers and label names
- **Configurable Timeout**: Default 10 minutes, user-configurable
- **JavaScript**: Pure JavaScript implementation for Zapier compatibility

## Setup

1. Install dependencies:

   ```bash
   yarn install
   ```

## Deployment

1. Register with Zapier (if not already done):

   ```bash
   zapier register "PromptLayer"
   ```

2. Push to Zapier:

   ```bash
   zapier push
   ```

3. Test in Zapier Editor:
   - Create a new Zap
   - Add "PromptLayer RunAgent" as an action
   - Configure your API key
   - Select an agent and provide input variables

## Usage

The integration provides one main action:

### Run Agent

Executes a PromptLayer agent and waits for completion.

**Input Fields:**

- `agentName` (required): Select from available agents
- `useAgentLabel` (boolean): Use label name instead of version number
- `agentVersionNumber` (integer): Specific version number (when not using label)
- `agentLabelName` (string): Specific label name (when using label)
- `inputVariables` (JSON): Input variables for the agent
- `returnAllOutputs` (boolean): Return all outputs from execution
- `metadata` (JSON): Optional metadata
- `timeout` (integer): Maximum wait time in minutes (default: 10)

**Output:**
Returns the final execution result from the PromptLayer API.

## Development

- Source files are in `src/` (JavaScript)
- Main entry point is `index.js`
- No build step required
- Tests in `test/` directory with both simple runner and Jest

## Testing

The integration includes comprehensive tests covering:

- **Structure validation**: Authentication, resources, and action configuration
- **Successful execution**: Complete agent run with polling
- **Error handling**: Invalid JSON, missing execution ID, unexpected status codes
- **Timeout handling**: Proper timeout behavior
- **Input processing**: Version numbers, label names, metadata, return flags

Run tests with:

```bash
yarn test          # Simple test runner
yarn test:jest     # Jest test suite
```

## API Endpoints Used

- `GET /workflows` - List available agents
- `POST /workflows/{agentName}/run` - Start agent execution
- `GET /workflow-version-execution-results` - Check execution status

## Error Handling

- Invalid JSON parsing with clear error messages
- Timeout handling with configurable limits
- API error propagation with status codes
- Missing execution ID detection
