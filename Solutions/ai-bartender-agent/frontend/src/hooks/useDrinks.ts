import { useState, useEffect } from 'react';
import { drinksApi } from '../services/api';
import { Drink, DrinkFilters } from '../types';
import toast from 'react-hot-toast';

export const useDrinks = (filters?: DrinkFilters) => {
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDrinks = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await drinksApi.getAll(filters);
      setDrinks(data);
    } catch (err: any) {
      console.error('Error fetching drinks:', err);
      setError(err.message || 'Failed to fetch drinks');
      toast.error('Failed to load drinks');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDrinks();
  }, [filters?.section_id, filters?.search]);

  const refetch = () => {
    fetchDrinks();
  };

  return {
    drinks,
    isLoading,
    error,
    refetch,
  };
};

export const useDrink = (id: string | null) => {
  const [drink, setDrink] = useState<Drink | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setDrink(null);
      return;
    }

    const fetchDrink = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await drinksApi.getById(id);
        setDrink(data);
      } catch (err: any) {
        console.error('Error fetching drink:', err);
        setError(err.message || 'Failed to fetch drink');
        toast.error('Failed to load drink details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDrink();
  }, [id]);

  return {
    drink,
    isLoading,
    error,
  };
};