import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { OrchestrationKind } from "@soie/contracts";
import { AiService } from "./ai.service.js";
import { AuthGuard } from "../../common/guards/auth.guard.js";

const startRunBody = z.object({
  kind: OrchestrationKind,
  input: z.unknown().default({}),
});

@Controller("ai")
@UseGuards(AuthGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get("executions")
  executions() {
    return this.ai.listExecutions();
  }

  @Get("runs/:runId")
  run(@Param("runId") runId: string) {
    return this.ai.getRun(runId);
  }

  @Post("projects/:projectId/run")
  startRun(@Param("projectId") projectId: string, @Body() body: unknown) {
    const { kind, input } = startRunBody.parse(body);
    return this.ai.startRun(projectId, kind, input);
  }
}
