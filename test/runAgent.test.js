/**
 * Jest tests for the Run Agent action
 * Run with: npx jest test/runAgent.test.js
 */

const { runAgent } = require("../src/actions/runAgent.js");

describe("Run Agent Action", () => {
  let mockZ;
  let mockBundle;

  beforeEach(() => {
    // Create a proper Error class for Zapier errors
    class ZapierError extends Error {
      constructor(message, code, status) {
        super(message);
        this.name = "ZapierError";
        this.code = code;
        this.status = status;
      }
    }

    mockZ = {
      request: jest.fn(),
      generateCallbackUrl: jest.fn(),
      errors: { Error: ZapierError },
    };
    mockZ.generateCallbackUrl.mockResolvedValue(
      "https://hooks.zapier.com/test-callback-url"
    );
    mockBundle = {
      authData: { apiKey: "test-key-12345" },
      inputData: {
        agentName: "test-agent",
        inputVariables: '{"key": "value"}',
      },
    };
  });

  describe("Structure", () => {
    test("should have correct key", () => {
      expect(runAgent.key).toBe("run_agent");
    });

    test("should have correct noun", () => {
      expect(runAgent.noun).toBe("Agent");
    });

    test("should have operation with inputFields", () => {
      expect(runAgent.operation).toBeDefined();
      expect(runAgent.operation.inputFields).toBeDefined();
      expect(Array.isArray(runAgent.operation.inputFields)).toBe(true);
    });

    test("should have perform function", () => {
      expect(typeof runAgent.operation.perform).toBe("function");
    });

    test("should have performResume function", () => {
      expect(typeof runAgent.operation.performResume).toBe("function");
    });

    test("should have required input fields", () => {
      const fieldKeys = runAgent.operation.inputFields.map((f) => f.key);
      expect(fieldKeys).toContain("agentName");
      expect(fieldKeys).toContain("inputVariables");
    });
  });

  describe("Successful Execution", () => {
    test("should generate callback URL and start execution", async () => {
      mockZ.request.mockResolvedValueOnce({
        json: { workflow_version_execution_id: 123 },
      });

      const result = await runAgent.operation.perform(mockZ, mockBundle);

      expect(mockZ.generateCallbackUrl).toHaveBeenCalledTimes(1);
      expect(mockZ.request).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        workflow_version_execution_id: 123,
        agentName: "test-agent",
        returnAllOutputs: false,
      });
    });

    test("should make correct API call with callback URL", async () => {
      mockZ.request.mockResolvedValueOnce({
        json: { workflow_version_execution_id: 123 },
      });

      await runAgent.operation.perform(mockZ, mockBundle);

      // Check start call includes callback_url
      const startCall = mockZ.request.mock.calls[0];
      expect(startCall[0].method).toBe("POST");
      expect(startCall[0].url).toContain("/workflows/test-agent/run");
      expect(startCall[0].body).toEqual({
        input_variables: { key: "value" },
        return_all_outputs: false,
        callback_url: "https://hooks.zapier.com/test-callback-url",
      });
    });
  });

  describe("Error Handling", () => {
    test("should handle invalid JSON in input variables", async () => {
      mockBundle.inputData.inputVariables = "invalid json";

      await expect(
        runAgent.operation.perform(mockZ, mockBundle)
      ).rejects.toThrow("Invalid JSON in Input Variables");
    });

    test("should handle invalid JSON in metadata", async () => {
      mockBundle.inputData.metadata = "invalid json";

      await expect(
        runAgent.operation.perform(mockZ, mockBundle)
      ).rejects.toThrow("Invalid JSON in Metadata");
    });

    test("should handle missing execution ID", async () => {
      mockZ.request.mockResolvedValueOnce({
        json: {}, // No workflow_version_execution_id
      });

      await expect(
        runAgent.operation.perform(mockZ, mockBundle)
      ).rejects.toThrow("Missing workflow_version_execution_id in response");
    });
  });

  describe("PerformResume - Webhook Callback Handling", () => {
    test("should handle callback with final_output as string", async () => {
      const resumeBundle = {
        cleanedRequest: {
          content: {
            workflow_version_execution_id: 123,
            final_output: "test result",
          },
        },
      };

      const result = await runAgent.operation.performResume(
        mockZ,
        resumeBundle
      );

      expect(result).toEqual({
        result: "test result",
        status: "completed",
      });
    });

    test("should handle callback with final_output as object (all outputs)", async () => {
      const allOutputs = {
        "Node 1": {
          status: "SUCCESS",
          value: "First node",
          error_message: null,
          raw_error_message: null,
          is_output_node: false,
        },
        "Node 2": {
          status: "SUCCESS",
          value: "Second node",
          error_message: null,
          raw_error_message: null,
          is_output_node: true,
        },
      };

      const resumeBundle = {
        cleanedRequest: {
          content: {
            workflow_version_execution_id: 123,
            final_output: allOutputs,
          },
        },
      };

      const result = await runAgent.operation.performResume(
        mockZ,
        resumeBundle
      );

      expect(result).toEqual(allOutputs);
    });

    test("should handle callback with final_output as simple object", async () => {
      const simpleObject = { result: "success", data: "test output" };

      const resumeBundle = {
        cleanedRequest: {
          content: {
            workflow_version_execution_id: 123,
            final_output: simpleObject,
          },
        },
      };

      const result = await runAgent.operation.performResume(
        mockZ,
        resumeBundle
      );

      expect(result).toEqual(simpleObject);
    });

    test("should handle callback payload without final_output key", async () => {
      const resumeBundle = {
        cleanedRequest: {
          content: {
            workflow_version_execution_id: 123,
            result: "direct result",
          },
        },
      };

      const result = await runAgent.operation.performResume(
        mockZ,
        resumeBundle
      );

      expect(result).toEqual({
        workflow_version_execution_id: 123,
        result: "direct result",
      });
    });

    test("should handle missing webhook payload", async () => {
      const resumeBundle = {
        cleanedRequest: {},
      };

      await expect(
        runAgent.operation.performResume(mockZ, resumeBundle)
      ).rejects.toThrow("Missing webhook payload");
    });

    test("should handle callback with cleanedRequest as direct payload", async () => {
      const resumeBundle = {
        cleanedRequest: {
          workflow_version_execution_id: 123,
          final_output: "test result",
        },
      };

      const result = await runAgent.operation.performResume(
        mockZ,
        resumeBundle
      );

      expect(result).toEqual({
        result: "test result",
        status: "completed",
      });
    });
  });

  describe("Input Processing", () => {
    test("should handle agent version number", async () => {
      mockBundle.inputData.agentVersionNumber = 5;

      mockZ.request.mockResolvedValueOnce({
        json: { workflow_version_execution_id: 123 },
      });

      await runAgent.operation.perform(mockZ, mockBundle);

      const startCall = mockZ.request.mock.calls[0];
      expect(startCall[0].body.workflow_version_number).toBe(5);
      expect(startCall[0].body.callback_url).toBe(
        "https://hooks.zapier.com/test-callback-url"
      );
    });

    test("should handle agent label name", async () => {
      mockBundle.inputData.agentLabelName = "production";

      mockZ.request.mockResolvedValueOnce({
        json: { workflow_version_execution_id: 123 },
      });

      await runAgent.operation.perform(mockZ, mockBundle);

      const startCall = mockZ.request.mock.calls[0];
      expect(startCall[0].body.workflow_label_name).toBe("production");
      expect(startCall[0].body.callback_url).toBe(
        "https://hooks.zapier.com/test-callback-url"
      );
    });

    test("should handle return all outputs flag", async () => {
      mockBundle.inputData.returnAllOutputs = true;

      mockZ.request.mockResolvedValueOnce({
        json: { workflow_version_execution_id: 123 },
      });

      await runAgent.operation.perform(mockZ, mockBundle);

      const startCall = mockZ.request.mock.calls[0];
      expect(startCall[0].body.return_all_outputs).toBe(true);
      expect(startCall[0].body.callback_url).toBe(
        "https://hooks.zapier.com/test-callback-url"
      );
    });

    test("should handle metadata", async () => {
      mockBundle.inputData.metadata = '{"key": "value"}';

      mockZ.request.mockResolvedValueOnce({
        json: { workflow_version_execution_id: 123 },
      });

      await runAgent.operation.perform(mockZ, mockBundle);

      const startCall = mockZ.request.mock.calls[0];
      expect(startCall[0].body.metadata).toEqual({ key: "value" });
      expect(startCall[0].body.callback_url).toBe(
        "https://hooks.zapier.com/test-callback-url"
      );
    });
  });
});
