import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    const isValid = await this.authService.validateWallet(
      loginDto.walletAddress,
      loginDto.signature,
      loginDto.message,
    );

    if (!isValid) {
      throw new UnauthorizedException('Wallet signature is invalid');
    }

    return this.authService.login(loginDto.walletAddress);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Body('token') token: string) {
    if (!token) {
      throw new BadRequestException('token is required');
    }

    try {
      return await this.authService.verifyToken(token);
    } catch {
      throw new UnauthorizedException('Token is invalid or expired');
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body('walletAddress') walletAddress: string) {
    if (!walletAddress) {
      throw new BadRequestException('walletAddress is required');
    }
    return this.authService.refreshToken(walletAddress);
  }
}
