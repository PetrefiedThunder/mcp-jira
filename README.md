# mcp-jira

Search issues with JQL, create/update issues, manage transitions and comments in Jira.

## Tools

| Tool | Description |
|------|-------------|
| `search_issues` | Search issues using JQL. |
| `get_issue` | Get issue details. |
| `create_issue` | Create a new issue. |
| `transition_issue` | Change issue status. |
| `get_transitions` | Get available transitions for an issue. |
| `add_comment` | Add a comment to an issue. |

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `JIRA_DOMAIN` | Yes | Jira domain (e.g. mycompany.atlassian.net) |
| `JIRA_EMAIL` | Yes | Jira account email |
| `JIRA_API_TOKEN` | Yes | Jira API token |

## Installation

```bash
git clone https://github.com/PetrefiedThunder/mcp-jira.git
cd mcp-jira
npm install
npm run build
```

## Usage with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "jira": {
      "command": "node",
      "args": ["/path/to/mcp-jira/dist/index.js"],
      "env": {
        "JIRA_DOMAIN": "your-jira-domain",
        "JIRA_EMAIL": "your-jira-email",
        "JIRA_API_TOKEN": "your-jira-api-token"
      }
    }
  }
}
```

## Usage with npx

```bash
npx mcp-jira
```

## License

MIT
