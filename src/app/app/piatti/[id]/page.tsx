import { RecipeEditor } from "@/components/RecipeEditor";
import { requireRestaurant } from "@/lib/session";

export default async function DishPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { restaurant } = await requireRestaurant();
  return <RecipeEditor restaurant={restaurant} recipeId={id} kind="dish" />;
}
