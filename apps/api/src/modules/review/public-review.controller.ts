import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { approveInput, requestChangesInput } from "@soie/contracts";
import { PublicReviewService } from "./public-review.service.js";

/**
 * Open review endpoints — intentionally NOT behind AuthGuard. Access is by
 * possession of the opaque token in the link shared with the client.
 */
@Controller("public/review")
export class PublicReviewController {
  constructor(private readonly review: PublicReviewService) {}

  @Get(":token")
  view(@Param("token") token: string) {
    return this.review.getByToken(token);
  }

  @Post(":token/approve")
  approve(@Param("token") token: string, @Body() body: unknown) {
    return this.review.approve(token, approveInput.parse(body ?? {}));
  }

  @Post(":token/request-changes")
  requestChanges(@Param("token") token: string, @Body() body: unknown) {
    return this.review.requestChanges(token, requestChangesInput.parse(body));
  }
}
