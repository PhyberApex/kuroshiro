import type { RecipeGalleryQuery, RecipeSort } from 'kuroshiro-shared'
import { Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator'
import { RECIPE_CATEGORY_PATTERN, RECIPE_SORTS } from 'kuroshiro-shared'

export class RecipeGalleryQueryDto implements RecipeGalleryQuery {
  // No minimum length: a search too short for TRMNL is sent as none, not refused.
  @IsOptional()
  @IsString()
  search?: string

  // A slug only, so a category cannot carry further tokens into TRMNL's search.
  @IsOptional()
  @IsString()
  @Matches(RECIPE_CATEGORY_PATTERN)
  category?: string

  @IsOptional()
  @IsIn(RECIPE_SORTS)
  sort?: RecipeSort

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page?: number
}
