import type { ApplyRecipeUpdateInput, UpdateItemType } from 'kuroshiro-shared'
import { Type } from 'class-transformer'
import { IsArray, IsIn, IsString, ValidateNested } from 'class-validator'
import { UPDATE_ITEM_TYPES } from 'kuroshiro-shared'

class RecipeUpdateSelectionDto {
  @IsIn(UPDATE_ITEM_TYPES)
  itemType: UpdateItemType

  @IsString()
  key: string
}

export class ApplyRecipeUpdateDto implements ApplyRecipeUpdateInput {
  @IsString()
  contentHash: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeUpdateSelectionDto)
  apply: RecipeUpdateSelectionDto[]
}
