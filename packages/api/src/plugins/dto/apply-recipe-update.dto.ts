import type { UpdateItemType } from '../services/recipe-update-diff.js'
import { Type } from 'class-transformer'
import { IsArray, IsIn, IsString, ValidateNested } from 'class-validator'
import { UPDATE_ITEM_TYPES } from '../services/recipe-update-diff.js'

class RecipeUpdateSelectionDto {
  @IsIn(UPDATE_ITEM_TYPES)
  itemType: UpdateItemType

  @IsString()
  key: string
}

export class ApplyRecipeUpdateDto {
  @IsString()
  contentHash: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeUpdateSelectionDto)
  apply: RecipeUpdateSelectionDto[]
}
