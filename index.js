const { version: platformVersion } = require("zapier-platform-core");
const packageJson = require("./package.json");
const { authentication, addApiKeyHeader } = require("./src/authentication.js");
const { runAgent } = require("./src/actions/runAgent.js");
const { agentsResource } = require("./src/resources/agents.js");

module.exports = {
  version: packageJson.version,
  platformVersion,
  authentication,
  beforeRequest: [addApiKeyHeader],
  resources: {
    [agentsResource.key]: agentsResource,
  },
  triggers: {},
  searches: {},
  creates: {
    [runAgent.key]: runAgent,
  },
};
