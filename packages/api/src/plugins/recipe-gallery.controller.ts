import type { RecipeGalleryPage } from 'kuroshiro-shared'
import { Controller, Get, Query } from '@nestjs/common'
import { RecipeGalleryQueryDto } from './dto/recipe-gallery-query.dto.js'
import { RecipeGalleryService } from './services/recipe-gallery.service.js'

/** The Recipe Gallery's reads of TRMNL's published Recipes (ADR-0073). Importing one is `POST /plugins/import-recipe`. */
@Controller('recipes')
export class RecipeGalleryController {
  constructor(private readonly gallery: RecipeGalleryService) {}

  @Get()
  async page(@Query() query: RecipeGalleryQueryDto): Promise<RecipeGalleryPage> {
    return this.gallery.page(query)
  }

  @Get('categories')
  async categories(): Promise<string[]> {
    return this.gallery.categories()
  }
}
