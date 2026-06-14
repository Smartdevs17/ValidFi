import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Keypair } from '@stellar/stellar-base';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateWallet(
    walletAddress: string,
    signature: string,
    message: string,
  ): Promise<boolean> {
    try {
      const keypair = Keypair.fromPublicKey(walletAddress);
      const messageBytes = Buffer.from(message, 'utf8');
      const signatureBytes = Buffer.from(signature, 'base64');
      return keypair.verify(messageBytes, signatureBytes);
    } catch {
      return false;
    }
  }

  async login(walletAddress: string): Promise<{ access_token: string; walletAddress: string }> {
    const payload = { walletAddress, iat: Math.floor(Date.now() / 1000) };
    return {
      access_token: this.jwtService.sign(payload),
      walletAddress,
    };
  }

  async verifyToken(token: string): Promise<{ walletAddress: string }> {
    return this.jwtService.verify<{ walletAddress: string }>(token);
  }

  async refreshToken(walletAddress: string): Promise<{ access_token: string }> {
    const payload = { walletAddress, iat: Math.floor(Date.now() / 1000) };
    return { access_token: this.jwtService.sign(payload) };
  }
}
