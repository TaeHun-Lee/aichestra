import type { IncomingMessage, ServerResponse } from "node:http";
import { createCollaborationApiService } from "../services/collaboration.ts";
import type { ApiServiceResult, CollaborationApiServiceContext } from "../services/collaboration.ts";

type JsonValue = Record<string, unknown> | unknown[];

export type CollaborationRouteRequest = {
  method: string;
  segments: string[];
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  context: CollaborationApiServiceContext;
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

export async function handleCollaborationRoute(input: CollaborationRouteRequest): Promise<boolean> {
  const { method, segments, request, response, url, context } = input;
  const service = createCollaborationApiService(context);

  if (segments[0] === "branches" && segments[1] === "leases" && method === "GET") {
    sendResult(response, service.listBranchLeases(url.searchParams));
    return true;
  }

  if (segments[0] === "conflicts" && segments[1] === "risks" && method === "GET") {
    sendResult(response, service.listConflictRisks(url.searchParams));
    return true;
  }

  if (segments[0] === "merge-simulations") {
    if (method === "GET" && segments.length === 1) {
      sendResult(response, service.listMergeSimulations(url.searchParams));
      return true;
    }
    if (method === "POST" && segments.length === 1) {
      sendResult(response, await service.createMergeSimulation(await readJson(request) as Record<string, unknown>));
      return true;
    }
  }

  if (segments[0] === "merge-queue") {
    if (method === "GET" && segments.length === 1) {
      sendResult(response, service.listMergeQueue(url.searchParams));
      return true;
    }
    if (method === "POST" && segments[2] === "mark-merged") {
      sendResult(response, service.markMergeQueueEntryMerged(segments[1]));
      return true;
    }
    if (method === "POST" && segments[2] === "cancel") {
      const body = await readJson(request) as { reason?: string };
      sendResult(response, service.cancelMergeQueueEntry(segments[1], body.reason));
      return true;
    }
  }

  return false;
}
