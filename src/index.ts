#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const RATE_LIMIT_MS = 200;
let last = 0;

function getConfig() {
  const domain = process.env.JIRA_DOMAIN; // e.g. "mycompany.atlassian.net"
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!domain || !email || !token) throw new Error("JIRA_DOMAIN, JIRA_EMAIL, JIRA_API_TOKEN required");
  return { base: `https://${domain}/rest/api/3`, auth: `Basic ${btoa(`${email}:${token}`)}` };
}

async function jiraFetch(path: string, method = "GET", body?: any): Promise<any> {
  const now = Date.now(); if (now - last < RATE_LIMIT_MS) await new Promise((r) => setTimeout(r, RATE_LIMIT_MS - (now - last)));
  last = Date.now();
  const { base, auth } = getConfig();
  const opts: RequestInit = { method, headers: { Authorization: auth, "Content-Type": "application/json", Accept: "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${base}${path}`, opts);
  if (!res.ok) throw new Error(`Jira ${res.status}: ${(await res.text()).slice(0, 500)}`);
  return res.json();
}

const server = new McpServer({ name: "mcp-jira", version: "1.0.0" });

server.tool("search_issues", "Search issues using JQL.", {
  jql: z.string().describe("JQL query (e.g. 'project = PROJ AND status = Open')"),
  maxResults: z.number().min(1).max(100).default(20),
  fields: z.string().default("summary,status,assignee,priority,created,updated"),
}, async ({ jql, maxResults, fields }) => {
  const d = await jiraFetch(`/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=${fields}`);
  const issues = d.issues?.map((i: any) => ({
    key: i.key, summary: i.fields?.summary, status: i.fields?.status?.name,
    assignee: i.fields?.assignee?.displayName, priority: i.fields?.priority?.name,
    created: i.fields?.created, updated: i.fields?.updated,
  }));
  return { content: [{ type: "text" as const, text: JSON.stringify({ total: d.total, issues }, null, 2) }] };
});

server.tool("get_issue", "Get issue details.", { issueKey: z.string() }, async ({ issueKey }) => {
  const d = await jiraFetch(`/issue/${issueKey}`);
  return { content: [{ type: "text" as const, text: JSON.stringify({
    key: d.key, summary: d.fields?.summary, description: d.fields?.description,
    status: d.fields?.status?.name, assignee: d.fields?.assignee?.displayName,
    reporter: d.fields?.reporter?.displayName, priority: d.fields?.priority?.name,
    labels: d.fields?.labels, created: d.fields?.created, updated: d.fields?.updated,
  }, null, 2) }] };
});

server.tool("create_issue", "Create a new issue.", {
  projectKey: z.string(), summary: z.string(), issueType: z.string().default("Task"),
  description: z.string().optional(), assigneeId: z.string().optional(), priority: z.string().optional(),
}, async ({ projectKey, summary, issueType, description, assigneeId, priority }) => {
  const fields: any = { project: { key: projectKey }, summary, issuetype: { name: issueType } };
  if (description) fields.description = { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: description }] }] };
  if (assigneeId) fields.assignee = { accountId: assigneeId };
  if (priority) fields.priority = { name: priority };
  const d = await jiraFetch("/issue", "POST", { fields });
  return { content: [{ type: "text" as const, text: JSON.stringify({ key: d.key, id: d.id, self: d.self }, null, 2) }] };
});

server.tool("transition_issue", "Change issue status.", {
  issueKey: z.string(), transitionId: z.string().describe("Transition ID (get from get_transitions)"),
}, async ({ issueKey, transitionId }) => {
  await jiraFetch(`/issue/${issueKey}/transitions`, "POST", { transition: { id: transitionId } });
  return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true, issueKey }) }] };
});

server.tool("get_transitions", "Get available transitions for an issue.", { issueKey: z.string() }, async ({ issueKey }) => {
  const d = await jiraFetch(`/issue/${issueKey}/transitions`);
  return { content: [{ type: "text" as const, text: JSON.stringify(d.transitions?.map((t: any) => ({ id: t.id, name: t.name, to: t.to?.name })), null, 2) }] };
});

server.tool("add_comment", "Add a comment to an issue.", {
  issueKey: z.string(), body: z.string(),
}, async ({ issueKey, body }) => {
  const d = await jiraFetch(`/issue/${issueKey}/comment`, "POST", {
    body: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: body }] }] },
  });
  return { content: [{ type: "text" as const, text: JSON.stringify({ id: d.id, created: d.created }, null, 2) }] };
});

async function main() { const t = new StdioServerTransport(); await server.connect(t); }
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
