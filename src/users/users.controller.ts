import { Controller, Get, Body, Patch, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { UsersService, CreateUserDto } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { UserDocument } from 'src/schemas/user.schema';

@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Get user details' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing token' })
  @Get()
  findOne(@CurrentUser() user: UserDocument) {
    return this.usersService.findOne(user._id.toString());
  }

  @ApiOperation({ summary: 'Update user details' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing token' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  @Patch()
  update(
    @CurrentUser() user: UserDocument,
    @Body() updateUserDto: Partial<CreateUserDto>,
  ) {
    return this.usersService.update(user._id.toString(), updateUserDto);
  }
}
