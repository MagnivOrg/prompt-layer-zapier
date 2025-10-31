const authentication = {
  type: "custom",
  fields: [
    {
      key: "apiKey",
      type: "string",
      required: true,
      label: "PromptLayer API Key",
      helpText:
        "Generate a new PromptLayer API Key in the dashboard. Log into PromptLayer, navigate to settings, generate a new PromptLayer API Key\nhttps://dashboard.promptlayer.com/",
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
