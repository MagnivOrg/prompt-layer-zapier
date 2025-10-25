const authentication = {
  type: "custom",
  fields: [
    {
      key: "apiKey",
      type: "string",
      required: true,
      label: "API Key",
      helpText: "Your PromptLayer API Key. See: https://docs.promptlayer.com",
    },
  ],
  test: {
    url: "https://api.promptlayer.com/prompt-templates",
  },

  connectionLabel: "PromptLayer Account",
};

const addApiKeyHeader = (request, z, bundle) => {
  request.headers = request.headers || {};
  request.headers["X-API-KEY"] = bundle.authData.apiKey;
  request.headers["Accept"] = "application/json";
  request.headers["Content-Type"] = "application/json";
  return request;
};

module.exports = { authentication, addApiKeyHeader };
