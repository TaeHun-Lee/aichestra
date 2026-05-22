import type { IncomingMessage, ServerResponse } from "node:http";
import { createTaskApiService } from "../services/tasks.ts";
import type { ApiServiceResult, TaskApiServiceContext } from "../services/tasks.ts";

type JsonValue = Record<string, unknown> | unknown[];

export type TaskRouteRequest = {
  method: string;
  segments: string[];
  request: IncomingMessage;
  response: ServerResponse;
  context: TaskApiServiceContext;
};

function sendJson(response: ServerResponse, statusCode: number, body: JsonValue): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body, null, 2));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendResult(response: ServerResponse, result: ApiServiceResult): void {
  sendJson(response, result.statusCode, result.body as JsonValue);
}

export async function handleTasksRoute(input: TaskRouteRequest): Promise<boolean> {
  const { method, segments, request, response, context } = input;
  if (segments[0] !== "tasks") return false;

  const service = createTaskApiService(context);

  if (method === "POST" && segments.length === 1) {
    sendResult(response, service.createTask(await readJson(request)));
    return true;
  }
  if (method === "GET" && segments.length === 1) {
    sendResult(response, service.listTasks());
    return true;
  }

  const task = service.getTaskOrThrow(segments[1]);

  if (method === "GET" && segments.length === 2) {
    sendResult(response, service.getTaskDetail(task));
    return true;
  }

  if (method === "POST" && segments[2] === "run") {
    sendResult(response, await service.runWorkflow(task));
    return true;
  }

  if (method === "POST" && segments[2] === "run-agent") {
    const requestContext = context.apiRequestContextMiddleware.requireApiContext(request);
    sendResult(response, await service.runAgent({ task, requestContext }));
    return true;
  }

  if (method === "GET" && segments[2] === "runs") {
    sendResult(response, service.listTaskRuns(task));
    return true;
  }
  if (method === "GET" && segments[2] === "agent-runs") {
    sendResult(response, service.listAgentRuns(task));
    return true;
  }
  if (method === "POST" && segments[2] === "plan") {
    sendResult(response, service.transitionTask(task, "planned"));
    return true;
  }
  if (method === "POST" && segments[2] === "start") {
    sendResult(response, service.startTask(task));
    return true;
  }
  if (method === "POST" && segments[2] === "cancel") {
    sendResult(response, service.transitionTask(task, "cancelled"));
    return true;
  }
  if (method === "POST" && segments[2] === "status") {
    const body = await readJson(request) as { status?: string };
    sendResult(response, service.updateTaskStatus(task, body));
    return true;
  }

  return false;
}
