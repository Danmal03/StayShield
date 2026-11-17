import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './auth.dto';
import { Public } from './auth.decorators';
import { SESSION_COOKIE } from './auth.constants';
import { AuthenticatedRequest } from './auth.types';

@ApiTags('authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create a secure session using local credentials' })
  async login(
    @Body() input: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: object; expiresAt: Date }> {
    const result = await this.authService.login(input, request.ip);
    response.cookie(SESSION_COOKIE, result.token, this.cookieOptions(result.expiresAt));
    return { user: result.user, expiresAt: result.expiresAt };
  }

  @Get('me')
  @ApiOperation({ summary: 'Return the authenticated user and assigned roles' })
  me(@Req() request: AuthenticatedRequest): object {
    return request.auth;
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke the current session' })
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = request.cookies?.[SESSION_COOKIE];
    await this.authService.logout(token, request.auth.id, request.auth.tenantId);
    response.clearCookie(SESSION_COOKIE, this.cookieOptions(new Date(0)));
  }

  private cookieOptions(expires: Date): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict';
    path: string;
    expires: Date;
  } {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      expires,
    };
  }
}
