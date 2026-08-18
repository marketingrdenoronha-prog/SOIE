import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { requestDeliverablesInput } from "@soie/contracts";
import { DeliverablesService } from "./deliverables.service.js";
import { AuthGuard } from "../../common/guards/auth.guard.js";

@Controller("deliverables")
@UseGuards(AuthGuard)
export class DeliverablesController {
  constructor(private readonly deliverables: DeliverablesService) {}

  @Get()
  list(@Query("projectId") projectId?: string) {
    return this.deliverables.list(projectId);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.deliverables.get(id);
  }

  @Post("request")
  request(@Body() body: unknown) {
    return this.deliverables.request(requestDeliverablesInput.parse(body));
  }

  @Post(":id/review-link")
  createReviewLink(@Param("id") id: string) {
    return this.deliverables.createReviewLink(id);
  }
}
