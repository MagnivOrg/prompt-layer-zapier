/**
 * Jest tests for the Run Agent action
 * Run with: npx jest test/runAgent.test.js
 */

const { runAgent } = require("../src/actions/runAgent.js");

describe("Run Agent Action", () => {
  let mockZ;
  let mockBundle;

  beforeEach(() => {
    mockZ = {
      request: jest.fn(),
      errors: { Error: Error },
    };
    mockBundle = {
      authData: { apiKey: "test-key-12345" },
      inputData: {
        agentName: "test-agent",
        inputVariables: '{"key": "value"}',
        timeout: 1, // 1 minute for testing
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

    test("should have required input fields", () => {
      const fieldKeys = runAgent.operation.inputFields.map((f) => f.key);
      expect(fieldKeys).toContain("agentName");
      expect(fieldKeys).toContain("inputVariables");
    });
  });

  describe("Successful Execution", () => {
    test("should complete successfully", async () => {
      mockZ.request
        .mockResolvedValueOnce({
          json: { workflow_version_execution_id: 123 },
        })
        .mockResolvedValueOnce({
          status: 200,
          json: { result: "success", data: "test output" },
        });

      const result = await runAgent.operation.perform(mockZ, mockBundle);

      expect(result).toEqual({ result: "success", data: "test output" });
      expect(mockZ.request).toHaveBeenCalledTimes(2);
    });

    test("should make correct API calls", async () => {
      mockZ.request
        .mockResolvedValueOnce({
          json: { workflow_version_execution_id: 123 },
        })
        .mockResolvedValueOnce({
          status: 200,
          json: { result: "success" },
        });

      await runAgent.operation.perform(mockZ, mockBundle);

      // Check start call
      const startCall = mockZ.request.mock.calls[0];
      expect(startCall[0].method).toBe("POST");
      expect(startCall[0].url).toContain("/workflows/test-agent/run");
      expect(startCall[0].body).toEqual({
        input_variables: { key: "value" },
        return_all_outputs: false,
      });

      // Check poll call
      const pollCall = mockZ.request.mock.calls[1];
      expect(pollCall[0].method).toBe("GET");
      expect(pollCall[0].url).toContain("/workflow-version-execution-results");
      expect(pollCall[0].params.workflow_version_execution_id).toBe(123);
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

    test("should handle unexpected status code", async () => {
      mockZ.request
        .mockResolvedValueOnce({
          json: { workflow_version_execution_id: 123 },
        })
        .mockResolvedValueOnce({
          status: 500,
          json: { error: "Internal server error" },
        });

      await expect(
        runAgent.operation.perform(mockZ, mockBundle)
      ).rejects.toThrow("Unexpected status 500");
    });
  });

  describe("Timeout Handling", () => {
    test("should handle timeout", async () => {
      mockZ.request
        .mockResolvedValueOnce({
          json: { workflow_version_execution_id: 123 },
        })
        .mockResolvedValue({
          status: 202,
          json: { status: "pending" },
        });

      // Mock Date.now to simulate timeout
      const originalDateNow = Date.now;
      let callCount = 0;
      Date.now = jest.fn(() => {
        callCount++;
        return callCount === 1 ? 0 : 70000; // 70 seconds, past 1 minute timeout
      });

      await expect(
        runAgent.operation.perform(mockZ, mockBundle)
      ).rejects.toThrow("Execution timed out after 1 minutes");

      Date.now = originalDateNow;
    });
  });

  describe("Input Processing", () => {
    test("should handle agent version number", async () => {
      mockBundle.inputData.useAgentLabel = false;
      mockBundle.inputData.agentVersionNumber = 5;

      mockZ.request
        .mockResolvedValueOnce({
          json: { workflow_version_execution_id: 123 },
        })
        .mockResolvedValueOnce({
          status: 200,
          json: { result: "success" },
        });

      await runAgent.operation.perform(mockZ, mockBundle);

      const startCall = mockZ.request.mock.calls[0];
      expect(startCall[0].body.workflow_version_number).toBe(5);
    });

    test("should handle agent label name", async () => {
      mockBundle.inputData.useAgentLabel = true;
      mockBundle.inputData.agentLabelName = "production";

      mockZ.request
        .mockResolvedValueOnce({
          json: { workflow_version_execution_id: 123 },
        })
        .mockResolvedValueOnce({
          status: 200,
          json: { result: "success" },
        });

      await runAgent.operation.perform(mockZ, mockBundle);

      const startCall = mockZ.request.mock.calls[0];
      expect(startCall[0].body.workflow_label_name).toBe("production");
    });

    test("should handle return all outputs flag", async () => {
      mockBundle.inputData.returnAllOutputs = true;

      mockZ.request
        .mockResolvedValueOnce({
          json: { workflow_version_execution_id: 123 },
        })
        .mockResolvedValueOnce({
          status: 200,
          json: { result: "success" },
        });

      await runAgent.operation.perform(mockZ, mockBundle);

      const startCall = mockZ.request.mock.calls[0];
      expect(startCall[0].body.return_all_outputs).toBe(true);
    });

    test("should handle metadata", async () => {
      mockBundle.inputData.metadata = '{"key": "value"}';

      mockZ.request
        .mockResolvedValueOnce({
          json: { workflow_version_execution_id: 123 },
        })
        .mockResolvedValueOnce({
          status: 200,
          json: { result: "success" },
        });

      await runAgent.operation.perform(mockZ, mockBundle);

      const startCall = mockZ.request.mock.calls[0];
      expect(startCall[0].body.metadata).toEqual({ key: "value" });
    });
  });
});
