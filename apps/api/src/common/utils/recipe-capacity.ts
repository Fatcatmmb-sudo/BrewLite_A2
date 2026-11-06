export interface RecipeLine {
  quantity: number;
  ingredient: { stockQuantity: number; isActive: boolean };
}

/** Availability of one serving; basket reservation must aggregate ingredient demand. */
export function canPrepare(recipe: readonly RecipeLine[]): boolean {
  return recipe.length > 0 && recipe.every(({ quantity, ingredient }) =>
    ingredient.isActive && quantity > 0 && ingredient.stockQuantity >= quantity);
}
