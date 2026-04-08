import { useState, useEffect } from "react";

const STORAGE_KEY = "freshflow:favorites";

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) as string[] : [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (productOptionId: string) => {
    setFavorites((prev) => {
      if (prev.includes(productOptionId)) {
        return prev.filter((id) => id !== productOptionId);
      }
      return [...prev, productOptionId];
    });
  };

  const isFavorite = (productOptionId: string) => {
    return favorites.includes(productOptionId);
  };

  const clearFavorites = () => {
    setFavorites([]);
  };

  return {
    favorites,
    toggleFavorite,
    isFavorite,
    clearFavorites,
    count: favorites.length,
  };
}
