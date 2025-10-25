const agentsResource = {
  key: "agents",
  noun: "Agent",
  sample: {
    id: 123,
    name: "Test Agent",
  },
  outputFields: [
    { key: "id", label: "ID", type: "integer" },
    { key: "name", label: "Name", type: "string" },
  ],
  list: {
    display: {
      label: "List Agents",
      description: "Load available agents",
      hidden: true,
    },
    operation: {
      perform: async (z) => {
        let page = 1;
        const perPage = 100;
        const allAgents = [];

        for (;;) {
          const resp = await z.request({
            url: "https://api.promptlayer.com/workflows",
            params: { page, per_page: perPage },
          });

          const items = resp.json?.items ?? [];
          allAgents.push(...items);

          if (!resp.json?.has_next) break;
          page = resp.json?.next_num ?? page + 1;
        }

        return allAgents;
      },
      sample: {
        id: 123,
        name: "Test Agent",
      },
      outputFields: [
        { key: "id", type: "integer" },
        { key: "name", type: "string" },
      ],
    },
  },
};

module.exports = { agentsResource };
