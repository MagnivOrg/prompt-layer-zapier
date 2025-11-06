const { normalizeJsonString } = require("../utils.js");

const runAgent = {
  key: "run_agent",
  noun: "Agent",
  display: {
    label: "Run Agent",
    description:
      "Execute a PromptLayer agent asynchronously via webhook callback",
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

      // Parse JSON inputs
      let parsedInputVariables;
      try {
        if (typeof inputVariables === "string") {
          // Try parsing as-is first
          try {
            parsedInputVariables = JSON.parse(inputVariables);
          } catch (firstError) {
            // If it fails with control character error, try normalizing newlines
            if (
              firstError.message &&
              firstError.message.includes("control character")
            ) {
              try {
                const normalized = normalizeJsonString(inputVariables);
                parsedInputVariables = JSON.parse(normalized);
              } catch (secondError) {
                // If normalization doesn't help, throw original error with helpful message
                throw new z.errors.Error(
                  `Invalid JSON in Input Variables: ${firstError.message}. ` +
                    `Tip: Multi-line strings in JSON need \\n escape sequences. ` +
                    `For example, use "line1\\nline2" instead of a multi-line string.`,
                  "InvalidData",
                  400
                );
              }
            } else {
              throw firstError;
            }
          }
        } else {
          parsedInputVariables = inputVariables;
        }
      } catch (e) {
        // If it's already a Zapier error, re-throw it
        if (e instanceof z.errors.Error) {
          throw e;
        }
        const errorMessage = e.message || "Invalid JSON in Input Variables";
        throw new z.errors.Error(
          `Invalid JSON in Input Variables: ${errorMessage}`,
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

      if (metadata) {
        try {
          if (typeof metadata === "string") {
            // Try parsing as-is first
            try {
              body.metadata = JSON.parse(metadata);
            } catch (firstError) {
              // If it fails with control character error, try normalizing newlines
              if (
                firstError.message &&
                firstError.message.includes("control character")
              ) {
                try {
                  const normalized = normalizeJsonString(metadata);
                  body.metadata = JSON.parse(normalized);
                } catch (secondError) {
                  // If normalization doesn't help, throw original error with helpful message
                  throw new z.errors.Error(
                    `Invalid JSON in Metadata: ${firstError.message}. ` +
                      `Tip: Multi-line strings in JSON need \\n escape sequences. ` +
                      `For example, use "line1\\nline2" instead of a multi-line string.`,
                    "InvalidData",
                    400
                  );
                }
              } else {
                throw firstError;
              }
            }
          } else {
            body.metadata = metadata;
          }
        } catch (e) {
          // If it's already a Zapier error, re-throw it
          if (e instanceof z.errors.Error) {
            throw e;
          }
          const errorMessage = e.message || "Invalid JSON in Metadata";
          throw new z.errors.Error(
            `Invalid JSON in Metadata: ${errorMessage}`,
            "InvalidData",
            400
          );
        }
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
