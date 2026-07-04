import { Body, Controller, Post } from "@nestjs/common";
import {
  loginInput,
  registerInput,
  type AuthTokens,
} from "@soie/contracts";
import { AuthService } from "./auth.service.js";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(@Body() body: unknown): Promise<AuthTokens> {
    return this.auth.register(registerInput.parse(body));
  }

  @Post("login")
  login(@Body() body: unknown): Promise<AuthTokens> {
    return this.auth.login(loginInput.parse(body));
  }
}
