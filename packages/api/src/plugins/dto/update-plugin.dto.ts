import type { PluginKind } from '../entities/plugin.entity.js'
import { OmitType, PartialType } from '@nestjs/mapped-types'
import { IsIn, IsOptional } from 'class-validator'
import { PLUGIN_KINDS } from '../entities/plugin.entity.js'
import { CreatePluginDto } from './create-plugin.dto.js'

// `kind` and `sourceRecipeId` are create-only: `kind` is fixed at creation (enforced by
// PluginsService.update, see #828) so it's redeclared below without CreatePluginDto's
// @MatchesPluginKind() constraint, which assumes a full creation-shaped payload and would
// misfire against a partial update body. `sourceRecipeId` has no update semantics at all.
export class UpdatePluginDto extends PartialType(OmitType(CreatePluginDto, ['kind', 'sourceRecipeId'] as const)) {
  @IsOptional()
  @IsIn(PLUGIN_KINDS)
  kind?: PluginKind
}
