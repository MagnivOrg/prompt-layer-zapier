# PromptLayer RunAgent Zapier Integration

This package provides a custom zapier action for running [PromptLayer Agents](https://promptlayer.com/) directly from your zapier workflows. The **PromptLayer** node allows you to execute PromptLayer Agents, pass input variables, select agent versions or labels, and retrieve results.

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
   - Add "PromptLayer" as an action
   - Configure your API key
   - Select an agent and provide input variables

## Usage

The integration provides one main action:

### Run Agent

Executes a PromptLayer agent and waits for completion.

**Input Fields:**

- `agentName` (required): Select from available agents
- `agentVersionNumber` (integer, optional): Specific version number to run (takes precedence)
- `agentLabelName` (string, optional): Specific label name to run (used if no version)
- `inputVariables` (JSON): Input variables for the agent
- `returnAllOutputs` (boolean): Return all outputs from execution
- `metadata` (JSON): Optional metadata
- `timeout` (integer): Maximum wait time in minutes (default: 10)

**Output:**
Returns the final execution result from the PromptLayer API.
