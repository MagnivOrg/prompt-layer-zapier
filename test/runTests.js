/**
 * Simple test runner for the Zapier integration
 * Tests the main functionality without external dependencies
 */

const { runAgent } = require("../src/actions/runAgent.js");
const { agentsResource } = require("../src/resources/agents.js");
const { authentication } = require("../src/authentication.js");

// Simple test framework
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log("🧪 Running Zapier Integration Tests\n");

    for (const test of this.tests) {
      try {
        await test.fn();
        console.log(`✅ ${test.name}`);
        this.passed++;
      } catch (error) {
        console.log(`❌ ${test.name}`);
        console.log(`   Error: ${error.message}`);
        this.failed++;
      }
    }

    console.log(
      `\n📊 Test Results: ${this.passed} passed, ${this.failed} failed`
    );
    return this.failed === 0;
  }
}

const runner = new TestRunner();

// Mock z object for testing
const createMockZ = (requestResponses = []) => {
  let callCount = 0;
  const requestCalls = [];

  // Create a proper Error class for Zapier errors
  class ZapierError extends Error {
    constructor(message, code, status) {
      super(message);
      this.name = "ZapierError";
      this.code = code;
      this.status = status;
    }
  }

  return {
    request: (options) => {
      requestCalls.push(options);
      const response =
        requestResponses[callCount] ||
        requestResponses[requestResponses.length - 1];
      callCount++;
      return Promise.resolve(response);
    },
    generateCallbackUrl: async () => "https://hooks.zapier.com/test-callback-url",
    errors: { Error: ZapierError },
    getRequestCalls: () => requestCalls,
    getCallCount: () => callCount,
  };
};

// Mock bundle for testing
const createMockBundle = (inputData = {}) => ({
  authData: { apiKey: "test-key-12345" },
  inputData: {
    agentName: "test-agent",
    inputVariables: '{"key": "value"}',
    ...inputData,
  },
});

// Test authentication configuration
runner.test("Authentication should have correct structure", () => {
  if (authentication.type !== "custom") {
    throw new Error("Authentication type should be custom");
  }
  if (!authentication.fields || authentication.fields.length === 0) {
    throw new Error("Authentication should have fields");
  }
  if (authentication.fields[0].key !== "apiKey") {
    throw new Error("First field should be apiKey");
  }
  if (!authentication.test || !authentication.test.url) {
    throw new Error("Authentication should have test URL");
  }
});

// Test agents resource structure
runner.test("Agents resource should have correct structure", () => {
  if (agentsResource.key !== "agents") {
    throw new Error('Agents resource key should be "agents"');
  }
  if (!agentsResource.list || !agentsResource.list.operation) {
    throw new Error("Agents resource should have list operation");
  }
  if (typeof agentsResource.list.operation.perform !== "function") {
    throw new Error("Agents resource perform should be a function");
  }
});

// Test run agent action structure
runner.test("Run agent action should have correct structure", () => {
  if (runAgent.key !== "run_agent") {
    throw new Error('Run agent key should be "run_agent"');
  }
  if (!runAgent.operation || !runAgent.operation.inputFields) {
    throw new Error("Run agent should have operation with inputFields");
  }
  if (typeof runAgent.operation.perform !== "function") {
    throw new Error("Run agent perform should be a function");
  }

  // Check required input fields
  const fieldKeys = runAgent.operation.inputFields.map((f) => f.key);
  const requiredFields = ["agentName", "inputVariables"];
  for (const field of requiredFields) {
    if (!fieldKeys.includes(field)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
});

// Test successful agent execution
runner.test("Run agent should complete successfully", async () => {
  const mockZ = createMockZ([
    { json: { workflow_version_execution_id: 123 } },
  ]);
  const mockBundle = createMockBundle();

  const result = await runAgent.operation.perform(mockZ, mockBundle);

  if (result.workflow_version_execution_id !== 123) {
    throw new Error("Expected workflow_version_execution_id in result");
  }
  if (mockZ.getCallCount() !== 1) {
    throw new Error("Expected 1 API call (start with callback)");
  }
  const startCall = mockZ.getRequestCalls()[0];
  if (!startCall.body.callback_url) {
    throw new Error("Expected callback_url in request body");
  }
});

// Test callback URL generation
runner.test("Run agent should generate callback URL", async () => {
  const mockZ = createMockZ([
    { json: { workflow_version_execution_id: 123 } },
  ]);
  const mockBundle = createMockBundle();

  await runAgent.operation.perform(mockZ, mockBundle);

  const startCall = mockZ.getRequestCalls()[0];
  if (startCall.body.callback_url !== "https://hooks.zapier.com/test-callback-url") {
    throw new Error("Expected callback URL to be set");
  }
});

// Test invalid JSON handling
runner.test(
  "Run agent should handle invalid JSON in input variables",
  async () => {
    const mockZ = createMockZ();
    const mockBundle = createMockBundle({ inputVariables: "invalid json" });

    try {
      await runAgent.operation.perform(mockZ, mockBundle);
      throw new Error("Expected JSON parsing error");
    } catch (error) {
      if (!error.message.includes("Invalid JSON in Input Variables")) {
        throw new Error("Expected JSON parsing error message");
      }
    }
  }
);

// Test invalid JSON in metadata
runner.test("Run agent should handle invalid JSON in metadata", async () => {
  const mockZ = createMockZ();
  const mockBundle = createMockBundle({ metadata: "invalid json" });

  try {
    await runAgent.operation.perform(mockZ, mockBundle);
    throw new Error("Expected JSON parsing error");
  } catch (error) {
    if (!error.message.includes("Invalid JSON in Metadata")) {
      throw new Error("Expected JSON parsing error message");
    }
  }
});

// Test missing execution ID
runner.test("Run agent should handle missing execution ID", async () => {
  const mockZ = createMockZ([{ json: {} }]); // No workflow_version_execution_id
  const mockBundle = createMockBundle();

  try {
    await runAgent.operation.perform(mockZ, mockBundle);
    throw new Error("Expected missing execution ID error");
  } catch (error) {
    if (!error.message.includes("Missing workflow_version_execution_id")) {
      throw new Error("Expected missing execution ID error message");
    }
  }
});

// Test performResume with webhook callback
runner.test("Run agent should handle webhook callback", async () => {
  const mockZ = createMockZ();
  const resumeBundle = {
    cleanedRequest: {
      content: {
        workflow_version_execution_id: 123,
        final_output: "test result",
      },
    },
  };

  const result = await runAgent.operation.performResume(mockZ, resumeBundle);

  if (result.result !== "test result") {
    throw new Error("Expected result from webhook callback");
  }
  if (result.status !== "completed") {
    throw new Error("Expected status to be completed");
  }
});

// Test agent version number handling
runner.test("Run agent should handle agent version number", async () => {
  const mockZ = createMockZ([
    { json: { workflow_version_execution_id: 123 } },
  ]);
  const mockBundle = createMockBundle({
    agentVersionNumber: 5,
  });

  await runAgent.operation.perform(mockZ, mockBundle);

  const startCall = mockZ.getRequestCalls()[0];
  const requestBody = startCall.body;

  if (requestBody.workflow_version_number !== 5) {
    throw new Error("Expected workflow_version_number to be set");
  }
  if (!requestBody.callback_url) {
    throw new Error("Expected callback_url to be set");
  }
});

// Test agent label name handling
runner.test("Run agent should handle agent label name", async () => {
  const mockZ = createMockZ([
    { json: { workflow_version_execution_id: 123 } },
  ]);
  const mockBundle = createMockBundle({
    agentLabelName: "production",
  });

  await runAgent.operation.perform(mockZ, mockBundle);

  const startCall = mockZ.getRequestCalls()[0];
  const requestBody = startCall.body;

  if (requestBody.workflow_label_name !== "production") {
    throw new Error("Expected workflow_label_name to be set");
  }
  if (!requestBody.callback_url) {
    throw new Error("Expected callback_url to be set");
  }
});

// Test return all outputs flag
runner.test("Run agent should handle return all outputs flag", async () => {
  const mockZ = createMockZ([
    { json: { workflow_version_execution_id: 123 } },
  ]);
  const mockBundle = createMockBundle({
    returnAllOutputs: true,
  });

  await runAgent.operation.perform(mockZ, mockBundle);

  const startCall = mockZ.getRequestCalls()[0];
  const requestBody = startCall.body;

  if (requestBody.return_all_outputs !== true) {
    throw new Error("Expected return_all_outputs to be true");
  }
  if (!requestBody.callback_url) {
    throw new Error("Expected callback_url to be set");
  }
});

// Test metadata handling
runner.test("Run agent should handle metadata", async () => {
  const mockZ = createMockZ([
    { json: { workflow_version_execution_id: 123 } },
  ]);
  const mockBundle = createMockBundle({
    metadata: '{"key": "value"}',
  });

  await runAgent.operation.perform(mockZ, mockBundle);

  const startCall = mockZ.getRequestCalls()[0];
  const requestBody = startCall.body;

  if (!requestBody.metadata || requestBody.metadata.key !== "value") {
    throw new Error("Expected metadata to be parsed and included");
  }
  if (!requestBody.callback_url) {
    throw new Error("Expected callback_url to be set");
  }
});

// Run all tests
runner
  .run()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("Test runner error:", error);
    process.exit(1);
  });
