"use client";

import { useState, useEffect } from "react";
import { Database } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import {
  getUserCategories,
  createUserCategory,
  updateUserCategory,
  deleteUserCategory,
  getAllUserCategories,
} from "@/lib/categories";

type UserCategory = Database["public"]["Tables"]["user_categories"]["Row"];

interface CategoryManagerProps {
  onCategoriesChange?: () => void;
}

export default function CategoryManager({
  onCategoriesChange,
}: CategoryManagerProps) {
  const [categories, setCategories] = useState<{
    income: UserCategory[];
    expense: UserCategory[];
    taxation: UserCategory[];
  }>({ income: [], expense: [], taxation: [] });

  const [activeTab, setActiveTab] = useState<"income" | "expense" | "taxation">(
    "expense"
  );
  const [editingCategory, setEditingCategory] = useState<UserCategory | null>(
    null
  );
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const allCategories = await getAllUserCategories();
      setCategories(allCategories);
    } catch (err) {
      setError("Failed to load categories");
      console.error("Error loading categories:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      // Get the current user
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("User not authenticated");
        return;
      }

      const newCategory = await createUserCategory({
        user_id: user.id,
        type: activeTab,
        name: newCategoryName.trim(),
      });

      if (newCategory) {
        setCategories((prev) => ({
          ...prev,
          [activeTab]: [...prev[activeTab], newCategory].sort((a, b) =>
            a.name.localeCompare(b.name)
          ),
        }));
        setNewCategoryName("");
        onCategoriesChange?.();
      } else {
        setError("Failed to create category");
      }
    } catch (err) {
      setError("Failed to create category");
      console.error("Error creating category:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditCategory = async (
    category: UserCategory,
    newName: string
  ) => {
    if (!newName.trim() || newName.trim() === category.name) {
      setEditingCategory(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const updatedCategory = await updateUserCategory(category.id, {
        name: newName.trim(),
      });

      if (updatedCategory) {
        setCategories((prev) => ({
          ...prev,
          [activeTab]: prev[activeTab]
            .map((c) => (c.id === category.id ? updatedCategory : c))
            .sort((a, b) => a.name.localeCompare(b.name)),
        }));
        setEditingCategory(null);
        onCategoriesChange?.();
      } else {
        setError("Failed to update category");
      }
    } catch (err) {
      setError("Failed to update category");
      console.error("Error updating category:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCategory = async (category: UserCategory) => {
    if (!confirm(`Are you sure you want to delete "${category.name}"?`)) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const success = await deleteUserCategory(category.id);

      if (success) {
        setCategories((prev) => ({
          ...prev,
          [activeTab]: prev[activeTab].filter((c) => c.id !== category.id),
        }));
        onCategoriesChange?.();
      } else {
        setError("Failed to delete category");
      }
    } catch (err) {
      setError("Failed to delete category");
      console.error("Error deleting category:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const currentCategories = categories[activeTab];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Manage Categories
        </h2>
        <p className="text-muted-foreground">
          Customize your transaction categories for better organization.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: "expense", label: "Expense Categories" },
            { key: "income", label: "Income Sources" },
            { key: "taxation", label: "Tax Types" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Add new category */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleAddCategory()}
          placeholder={`Add new ${activeTab} category...`}
          className="flex-1 px-3 py-2 border border-input rounded-md shadow-sm bg-background text-foreground placeholder-muted-foreground"
          disabled={isLoading}
        />
        <button
          onClick={handleAddCategory}
          disabled={!newCategoryName.trim() || isLoading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>

      {/* Categories list */}
      <div className="space-y-2">
        {isLoading && currentCategories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading categories...
          </div>
        ) : currentCategories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No {activeTab} categories found. Add one above to get started.
          </div>
        ) : (
          currentCategories.map((category) => (
            <div
              key={category.id}
              className="flex items-center justify-between p-3 border border-border rounded-md bg-background"
            >
              {editingCategory?.id === category.id ? (
                <input
                  type="text"
                  defaultValue={category.name}
                  onBlur={(e) => handleEditCategory(category, e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleEditCategory(category, e.currentTarget.value);
                    } else if (e.key === "Escape") {
                      setEditingCategory(null);
                    }
                  }}
                  className="flex-1 px-2 py-1 border border-input rounded bg-background text-foreground"
                  autoFocus
                />
              ) : (
                <span className="text-foreground">{category.name}</span>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setEditingCategory(category)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                  disabled={isLoading}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteCategory(category)}
                  className="text-sm text-red-600 hover:text-red-700"
                  disabled={isLoading}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
