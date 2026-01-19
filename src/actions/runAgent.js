const runAgent = {
  key: "run_agent",
  noun: "Agent",
  display: {
    label: "Run Agent",
    description: "Runs an agent.",
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
        type: "string",
        required: true,
        dict: true,
        helpText: "Input variables for the agent",
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
        type: "string",
        required: false,
        dict: true,
        helpText: "Optional metadata",
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
        agentVersionNumber,
        agentLabelName,
        inputVariables,
        returnAllOutputs,
        metadata,
      } = bundle.inputData;

      // With dict type, inputVariables will be passed as an object
      // Just validate it's an object
      const parsedInputVariables =
        typeof inputVariables === "object" && inputVariables !== null
          ? inputVariables
          : {};

      if (
        typeof parsedInputVariables !== "object" ||
        parsedInputVariables === null
      ) {
        throw new z.errors.Error(
          "Input Variables must be a valid object",
          "InvalidData",
          400
        );
      }

      const body = {
        input_variables: parsedInputVariables,
        return_all_outputs: Boolean(returnAllOutputs),
      };

      // Prefer explicit version number if provided; otherwise fall back to label.
      if (agentVersionNumber != null) {
        body.workflow_version_number = Number(agentVersionNumber);
      } else if (agentLabelName) {
        body.workflow_label_name = agentLabelName;
      }

      // With dict type, metadata will be passed as an object
      if (
        metadata &&
        typeof metadata === "object" &&
        metadata !== null &&
        Object.keys(metadata).length > 0
      ) {
        body.metadata = metadata;
      }

      // Generate callback URL for webhook
      const callbackUrl = await z.generateCallbackUrl();

      // Add callback URL to request body
      body.callback_url = callbackUrl;

      // Start execution with callback URL
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

      // Return minimal object - Zap will wait for webhook callback
      return {
        workflow_version_execution_id: executionId,
        agentName: agentName,
        returnAllOutputs: Boolean(returnAllOutputs),
      };
    },
    performResume: async (z, bundle) => {
      // Parse the webhook payload from PromptLayer
      const payload = bundle.cleanedRequest.content || bundle.cleanedRequest;

      // Check if payload is missing or empty
      if (
        !payload ||
        (typeof payload === "object" &&
          Object.keys(payload).length === 0 &&
          !Array.isArray(payload))
      ) {
        throw new z.errors.Error("Missing webhook payload", "InvalidData", 400);
      }

      // Extract final_output from the callback payload
      // According to PromptLayer docs, the callback payload structure is:
      // {
      //   "workflow_version_execution_id": 123,
      //   "final_output": { ... } // or just the value if return_all_outputs is false
      // }
      const finalOutput = payload.final_output || payload;

      // If return_all_outputs was true, final_output will be an object with node outputs
      if (
        typeof finalOutput === "object" &&
        finalOutput !== null &&
        !Array.isArray(finalOutput)
      ) {
        // Check if it's the node outputs structure (has status, value, etc.)
        const firstKey = Object.keys(finalOutput)[0];
        if (
          firstKey &&
          typeof finalOutput[firstKey] === "object" &&
          finalOutput[firstKey] !== null &&
          ("status" in finalOutput[firstKey] ||
            "value" in finalOutput[firstKey])
        ) {
          // This is the all outputs format - return it directly
          return finalOutput;
        }
        // Otherwise, it might be a simple object result
        return finalOutput;
      }

      // If it's a string or primitive value, normalize it
      if (typeof finalOutput === "string") {
        return { result: finalOutput, status: "completed" };
      }

      // For any other type, return with status
      return {
        result: finalOutput,
        status: "completed",
        raw_response: JSON.stringify(payload),
      };
    },
  },
};

module.exports = { runAgent };
