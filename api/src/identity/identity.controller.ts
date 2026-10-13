import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthCookies } from '../common/cookies.js';
import { CsrfService } from '../common/csrf.js';
import { Clock } from '../common/clock.js';
import { cookieValue, type AuthRequest } from '../common/request.js';
import { RateLimiter } from '../common/rate-limiter.js';
import { SecurityConfig } from '../common/security.config.js';
import { IdentityService } from './identity.service.js';
import { EmptyDto, EmailDto, LoginDto, RegisterDto, ResetPasswordDto, TokenDto } from './identity.dto.js';
import { Public } from './public.decorator.js';

const GENERIC_MESSAGE = 'Si los datos son válidos, recibirás instrucciones en tu correo.';

@Controller('auth')
export class IdentityController {
  constructor(
    private readonly identity: IdentityService,
    private readonly csrf: CsrfService,
    private readonly cookies: AuthCookies,
    private readonly limiter: RateLimiter,
    private readonly config: SecurityConfig,
    private readonly clock: Clock,
  ) {}

  private ip(request: Request): string {
    return request.ip || request.socket.remoteAddress || 'unknown';
  }

  @Get('csrf')
  @Public()
  async getCsrf(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.limiter.consume('csrf', this.ip(request), 60, 60_000);
    const csrfToken = this.csrf.issue(cookieValue(request, this.config.sessionCookie));
    this.cookies.csrf(response, csrfToken);
    response.setHeader('Cache-Control', 'no-store');
    return { csrfToken };
  }

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  async register(@Body() input: RegisterDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.limiter.consume('register-ip', this.ip(request), 5, 3_600_000);
    await this.identity.register(input);
    response.setHeader('Cache-Control', 'no-store');
    return { message: GENERIC_MESSAGE };
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(@Body() input: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.limiter.consume('login-ip', this.ip(request), 10, 60_000);
    await this.limiter.consume('login-email', input.email, 10, 900_000);
    const session = await this.identity.login(input.email, input.password, cookieValue(request, this.config.sessionCookie));
    this.cookies.session(response, session.token, Math.max(0, session.expiresAt.getTime() - this.clock.now().getTime()));
    const csrfToken = this.csrf.issue(session.token);
    this.cookies.csrf(response, csrfToken);
    response.setHeader('Cache-Control', 'no-store');
    return { user: session.user, csrfToken };
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response, @Body() _input: EmptyDto): Promise<void> {
    await this.identity.logout(cookieValue(request, this.config.sessionCookie));
    this.cookies.clear(response);
    response.setHeader('Cache-Control', 'no-store');
  }

  @Post('email-verification/request')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestVerification(@Req() request: AuthRequest, @Res({ passthrough: true }) response: Response, @Body() _input: EmptyDto) {
    await this.limiter.consume('verification-user', request.principal!.userId, 5, 3_600_000);
    await this.identity.requestVerification(request.principal!.userId);
    response.setHeader('Cache-Control', 'no-store');
    return { message: GENERIC_MESSAGE };
  }

  @Post('email-verification/confirm')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmVerification(@Body() input: TokenDto, @Req() request: Request): Promise<void> {
    await this.limiter.consume('token-confirm-ip', this.ip(request), 10, 900_000);
    await this.identity.confirmVerification(input.token);
  }

  @Post('password-reset/request')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  async requestPasswordReset(@Body() input: EmailDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.limiter.consume('password-reset-ip', this.ip(request), 10, 3_600_000);
    await this.limiter.consume('password-reset-email', input.email, 3, 3_600_000);
    await this.identity.requestPasswordReset(input.email);
    response.setHeader('Cache-Control', 'no-store');
    return { message: GENERIC_MESSAGE };
  }

  @Post('password-reset/confirm')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmPasswordReset(@Body() input: ResetPasswordDto, @Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.limiter.consume('token-confirm-ip', this.ip(request), 10, 900_000);
    await this.identity.confirmPasswordReset(input.token, input.password);
    this.cookies.clear(response);
  }
}
