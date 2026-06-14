import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PinataClient from '@pinata/sdk';
import { Readable } from 'stream';

@Injectable()
export class IpfsService {
  private pinata: PinataClient;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('PINATA_API_KEY');
    const apiSecret = this.configService.get<string>('PINATA_API_SECRET');

    if (apiKey && apiSecret) {
      this.pinata = new PinataClient(apiKey, apiSecret);
    }
  }

  private ensureClient(): void {
    if (!this.pinata) {
      throw new InternalServerErrorException('IPFS client is not configured');
    }
  }

  async uploadFile(file: Buffer | Readable, fileName: string): Promise<string> {
    this.ensureClient();
    try {
      const stream = Buffer.isBuffer(file) ? Readable.from(file) : file;
      const result = await this.pinata.pinFileToIPFS(stream, {
        pinataMetadata: { name: fileName },
      });
      return result.IpfsHash;
    } catch (error) {
      throw new InternalServerErrorException(`Failed to upload file to IPFS: ${(error as Error).message}`);
    }
  }

  async uploadJSON(data: unknown, fileName: string): Promise<string> {
    this.ensureClient();
    try {
      const result = await this.pinata.pinJSONToIPFS(data, {
        pinataMetadata: { name: fileName },
      });
      return result.IpfsHash;
    } catch (error) {
      throw new InternalServerErrorException(`Failed to upload JSON to IPFS: ${(error as Error).message}`);
    }
  }

  async getFile(cid: string): Promise<Buffer> {
    const url = this.getGatewayUrl(cid);
    const res = await fetch(url);
    if (!res.ok) {
      throw new InternalServerErrorException(`Failed to retrieve file from IPFS: ${res.statusText}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  getGatewayUrl(cid: string): string {
    const gateway =
      this.configService.get<string>('PINATA_GATEWAY') ?? 'https://gateway.pinata.cloud/ipfs/';
    return `${gateway}${cid}`;
  }

  async testAuthentication(): Promise<boolean> {
    this.ensureClient();
    const result = await this.pinata.testAuthentication();
    return result.authenticated;
  }
}
