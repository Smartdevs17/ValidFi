import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { CreateIdentityDto } from './dto/create-identity.dto';
import { UpdateIdentityDto } from './dto/update-identity.dto';
import { PaginateIdentityDto } from './dto/paginate-identity.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('identities')
@UseGuards(JwtAuthGuard)
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Post()
  create(@Body() createIdentityDto: CreateIdentityDto, @Request() req) {
    return this.identityService.create({
      ...createIdentityDto,
      walletAddress: req.user.walletAddress,
    });
  }

  @Get()
  findAll(@Request() req, @Query() pagination: PaginateIdentityDto) {
    return this.identityService.findAll(req.user.walletAddress, pagination);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.identityService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateIdentityDto: UpdateIdentityDto) {
    return this.identityService.update(id, updateIdentityDto);
  }

  @Patch(':id/revoke')
  revoke(@Param('id') id: string) {
    return this.identityService.revoke(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.identityService.remove(id);
  }
}
