/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";

type UserCategory = Database["public"]["Tables"]["user_categories"]["Row"];
type UserCategoryInsert =
  Database["public"]["Tables"]["user_categories"]["Insert"];
type UserCategoryUpdate =
  Database["public"]["Tables"]["user_categories"]["Update"];

export async function getUserCategories(
  type: "income" | "expense" | "taxation"
): Promise<UserCategory[]> {
  const supabase = createClient();

  const { data, error } = await (supabase as any)
    .from("user_categories")
    .select("*")
    .eq("type", type)
    .order("name");

  if (error) {
    console.error("Error fetching categories:", error);
    return [];
  }

  return data || [];
}

export async function createUserCategory(
  category: UserCategoryInsert
): Promise<UserCategory | null> {
  const supabase = createClient();

  const { data, error } = await (supabase as any)
    .from("user_categories")
    .insert(category)
    .select()
    .single();

  if (error) {
    console.error("Error creating category:", error);
    return null;
  }

  return data;
}

export async function updateUserCategory(
  id: string,
  updates: UserCategoryUpdate
): Promise<UserCategory | null> {
  const supabase = createClient();

  const { data, error } = await (supabase as any)
    .from("user_categories")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating category:", error);
    return null;
  }

  return data;
}

export async function deleteUserCategory(id: string): Promise<boolean> {
  const supabase = createClient();

  const { error } = await (supabase as any)
    .from("user_categories")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting category:", error);
    return false;
  }

  return true;
}

export async function getAllUserCategories(): Promise<{
  income: UserCategory[];
  expense: UserCategory[];
  taxation: UserCategory[];
}> {
  const supabase = createClient();

  const { data, error } = await (supabase as any)
    .from("user_categories")
    .select("*")
    .order("type, name");

  if (error) {
    console.error("Error fetching all categories:", error);
    return { income: [], expense: [], taxation: [] };
  }

  const categories = data || [];

  return {
    income: categories.filter((c: UserCategory) => c.type === "income"),
    expense: categories.filter((c: UserCategory) => c.type === "expense"),
    taxation: categories.filter((c: UserCategory) => c.type === "taxation"),
  };
}
