const runAgent = {
  key: "run_agent",
  noun: "Agent",
  display: {
    label: "Run Agent",
    description: "Execute a PromptLayer agent and wait for completion",
  },
  operation: {
    inputFields: [
      {
        key: "agentName",
        label: "Agent Name",
        type: "string",
        required: true,
        dynamic: "agents.id.name",
        helpText: "Select the agent to run",
      },
      {
        key: "useAgentLabel",
        label: "Use Agent Label Name",
        type: "boolean",
        required: false,
        default: "false",
        altersDynamicFields: true,
        helpText: "Use label name instead of version number",
      },
      {
        key: "agentVersionNumber",
        label: "Agent Version Number",
        type: "integer",
        required: false,
        helpText: "Specific version number to run",
      },
      {
        key: "agentLabelName",
        label: "Agent Label Name",
        type: "string",
        required: false,
        helpText: "Specific label name to run",
      },
      {
        key: "inputVariables",
        label: "Input Variables",
        type: "text",
        required: true,
        default: "{}",
        helpText: "JSON object of input variables for the agent",
      },
      {
        key: "returnAllOutputs",
        label: "Return All Outputs",
        type: "boolean",
        required: false,
        default: "false",
        helpText: "Return all outputs from agent execution",
      },
      {
        key: "metadata",
        label: "Metadata",
        type: "text",
        required: false,
        helpText: "Optional JSON metadata",
        default: "{}",
      },
      {
        key: "timeout",
        label: "Timeout (minutes)",
        type: "integer",
        required: false,
        default: "10",
        helpText: "Maximum time to wait for completion",
      },
    ],
    outputFields: [
      { key: "result", type: "string", label: "Primary Result" },
      { key: "data", type: "string", label: "Data" },
      { key: "status", type: "string", label: "Status" },
      { key: "raw_response", type: "string", label: "Raw Response" },
    ],
    sample: {
      result: "success",
      data: "test output",
    },
    perform: async (z, bundle) => {
      const {
        agentName,
        useAgentLabel,
        agentVersionNumber,
        agentLabelName,
        inputVariables,
        returnAllOutputs,
        metadata,
        timeout,
      } = bundle.inputData;

      // Parse JSON inputs
      let parsedInputVariables;
      try {
        parsedInputVariables =
          typeof inputVariables === "string"
            ? JSON.parse(inputVariables)
            : inputVariables;
      } catch (e) {
        throw new z.errors.Error(
          "Invalid JSON in Input Variables",
          "InvalidData",
          400
        );
      }

      const body = {
        input_variables: parsedInputVariables,
        return_all_outputs: Boolean(returnAllOutputs),
      };

      if (useAgentLabel && agentLabelName) {
        body.workflow_label_name = agentLabelName;
      } else if (!useAgentLabel && agentVersionNumber != null) {
        body.workflow_version_number = Number(agentVersionNumber);
      }

      if (metadata) {
        try {
          body.metadata =
            typeof metadata === "string" ? JSON.parse(metadata) : metadata;
        } catch (e) {
          throw new z.errors.Error(
            "Invalid JSON in Metadata",
            "InvalidData",
            400
          );
        }
      }

      // Start execution
      const startResp = await z.request({
        method: "POST",
        url: `https://api.promptlayer.com/workflows/${encodeURIComponent(
          agentName
        )}/run`,
        body,
      });

      const executionId = startResp.json?.workflow_version_execution_id;
      if (!executionId) {
        throw new z.errors.Error(
          "Missing workflow_version_execution_id in response",
          "InvalidResponse",
          500
        );
      }

      // Poll for completion
      const timeoutMs = (timeout ?? 10) * 60 * 1000;
      const startTime = Date.now();
      const pollIntervalMs = 5000;

      while (Date.now() - startTime < timeoutMs) {
        const pollResp = await z.request({
          method: "GET",
          url: "https://api.promptlayer.com/workflow-version-execution-results",
          params: {
            workflow_version_execution_id: executionId,
            return_all_outputs: Boolean(returnAllOutputs),
          },
          throwForStatus: false,
        });

        if (pollResp.status === 200) {
          // Ensure we always return an object
          const result = pollResp.json || pollResp.data || pollResp.body;

          if (typeof result === "string") {
            return { result: result, status: "completed" };
          }
          if (typeof result === "object" && result !== null) {
            return result;
          }
          // Fallback for any other type
          return {
            result: result,
            status: "completed",
            raw_response: pollResp,
          };
        } else if (pollResp.status === 202) {
          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        } else {
          throw new z.errors.Error(
            `Unexpected status ${pollResp.status}`,
            "PromptLayerError",
            pollResp.status
          );
        }
      }

      throw new z.errors.Error(
        `Execution timed out after ${timeout ?? 10} minutes`,
        "Timeout",
        408
      );
    },
  },
};

module.exports = { runAgent };
